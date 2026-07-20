import { test } from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Store } from '../src/store.js';
import { handleInbound, isAllowedGroup, notify } from '../src/bridge.js';
import { normalizePhone, hashPhone } from '../src/util.js';

function fresh() {
  const file = path.join(os.tmpdir(), `wa-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  return { store: new Store(file), file };
}
const baseConfig = {
  allowedGroups: [],
  discourse: { mirrorCategory: 'ask-the-community', guestUsername: 'system' },
  phoneHashSalt: 'salt',
};
function fakeDiscourse() { return { posts: [], async postAsUser(p) { this.posts.push(p); return { mock: true }; } }; }

test('normalizePhone handles separators and country code', () => {
  assert.strictEqual(normalizePhone('+1 (415) 555-0172'), '+14155550172');
  assert.strictEqual(normalizePhone('00971 50 123 4567'.replace(/^00/, '+')), '+971501234567');
  assert.strictEqual(normalizePhone('abc'), null);
});

test('allow-list: empty allows all; set restricts', () => {
  assert.ok(isAllowedGroup('g1', { allowedGroups: [] }));
  assert.ok(isAllowedGroup('g1', { allowedGroups: ['g1'] }));
  assert.ok(!isAllowedGroup('g2', { allowedGroups: ['g1'] }));
});

test('mapped sender is mirrored as that user; idempotent on message id', async () => {
  const { store } = fresh();
  store.mapPhone('+14155550172', 'rohit', 42);
  const d = fakeDiscourse();
  const msg = { id: 'm1', groupJid: 'g', phone: '+1 415 555 0172', text: 'DTAA question' };
  const r1 = await handleInbound(msg, { store, discourse: d, config: baseConfig, log() {} });
  const r2 = await handleInbound(msg, { store, discourse: d, config: baseConfig, log() {} });
  assert.strictEqual(r1.status, 'mirrored');
  assert.strictEqual(r1.as, 'rohit');
  assert.strictEqual(r2.status, 'duplicate_ignored');
  assert.strictEqual(d.posts.length, 1); // idempotent
});

test('unmapped sender -> guest, and the phone number never appears in the post', async () => {
  const { store } = fresh();
  const d = fakeDiscourse();
  const r = await handleInbound({ id: 'm2', groupJid: 'g', phone: '+14150000000', text: 'hello' }, { store, discourse: d, config: baseConfig, log() {} });
  assert.strictEqual(r.status, 'mirrored_guest');
  assert.strictEqual(d.posts[0].username, 'system');
  assert.ok(!JSON.stringify(d.posts[0]).includes('4150000000'));
});

test('opted-out member is treated as unmapped (guest)', async () => {
  const { store } = fresh();
  store.mapPhone('+14155550172', 'rohit', 42);
  store.optOut('+14155550172');
  const d = fakeDiscourse();
  const r = await handleInbound({ id: 'm3', groupJid: 'g', phone: '+14155550172', text: 'hi' }, { store, discourse: d, config: baseConfig, log() {} });
  assert.strictEqual(r.status, 'mirrored_guest');
});

test('notify sends when a phone is mapped, and dedupes', async () => {
  const { store } = fresh();
  store.mapPhone('+14155550172', 'rohit', 42);
  const sent = [];
  const cloudApi = { async sendTemplate(to, params) { sent.push({ to, params }); return { mock: true }; } };
  const cfg = { ...baseConfig, discourse: { ...baseConfig.discourse, url: 'http://x' } };
  const payload = { notification: { id: 9, user_id: 42, topic_id: 100, data: { display_username: 'meera' } } };
  const a = await notify(payload, { store, cloudApi, config: cfg, log() {} });
  const b = await notify(payload, { store, cloudApi, config: cfg, log() {} });
  assert.strictEqual(a.status, 'notified');
  assert.strictEqual(b.status, 'duplicate_ignored');
  assert.strictEqual(sent.length, 1);
});

test('hashPhone never returns the raw number', () => {
  const h = hashPhone('+14155550172', 'salt');
  assert.ok(!h.includes('4155550172'));
  assert.strictEqual(h.length, 12);
});

test('B6: alerts log, ring-buffer, webhook with cooldown', async () => {
  const { Alerts } = await import('../src/alerts.js');
  const sent = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => { sent.push(JSON.parse(opts.body).text); return { ok: true }; };
  try {
    const a = new Alerts({ webhookUrl: 'http://alerts.local/hook', log() {} });
    const t0 = 1_000_000;
    assert.strictEqual((await a.fire('bridge_disconnected', 'gone', 'critical', t0)).status, 'sent');
    assert.strictEqual((await a.fire('bridge_disconnected', 'still gone', 'critical', t0 + 60_000)).status, 'cooldown');
    assert.strictEqual((await a.fire('bridge_disconnected', 'gone again', 'critical', t0 + 6 * 60_000)).status, 'sent');
    assert.strictEqual((await a.fire('bridge_auth_failure', 'bad', 'critical', t0 + 61_000)).status, 'sent'); // per-kind cooldown
    assert.strictEqual(sent.length, 3);
    assert.ok(sent[0].includes('bridge_disconnected'));
    assert.strictEqual(a.recent.length, 4); // ring buffer keeps even cooldown-suppressed entries
    const b = new Alerts({ log() {} }); // no webhook -> logged only
    assert.strictEqual((await b.fire('x', 'y')).status, 'logged_only');
  } finally { global.fetch = realFetch; }
});

test('B7: media message embeds a hosted upload; falls back to source link; text-only default', async () => {
  const { handleInbound } = await import('../src/bridge.js');
  const posts = [];
  const mkStore = () => { const seen = new Set(); return {
    seen: (id) => seen.has(id), markSeen: (id) => seen.add(id),
    getUserByPhone: () => ({ username: 'maya' }),
  }; };
  const cfg = { allowedGroups: [], phoneHashSalt: 's', discourse: { mirrorCategory: 'ask', guestUsername: 'system' } };
  // hosted upload succeeds
  let d = { uploadFromUrl: async () => '/uploads/x.jpg', postAsUser: async (p) => { posts.push(p); return {}; } };
  let r = await handleInbound({ id: 'm1', groupJid: 'g', phone: '+14155550100', text: 'chart attached', media: { url: 'http://cdn/x.jpg', type: 'image' } }, { store: mkStore(), discourse: d, config: cfg, log() {} });
  assert.strictEqual(r.media, true);
  assert.ok(posts[0].raw.includes('![shared media](/uploads/x.jpg)'));
  // upload fails -> plain link, never a broken image embed
  d = { uploadFromUrl: async () => null, postAsUser: async (p) => { posts.push(p); return {}; } };
  await handleInbound({ id: 'm2', groupJid: 'g', phone: '+14155550100', media: { url: 'http://cdn/y.jpg' } }, { store: mkStore(), discourse: d, config: cfg, log() {} });
  assert.ok(posts[1].raw.includes('[shared media](http://cdn/y.jpg)') && !posts[1].raw.includes('!['));
  assert.strictEqual(posts[1].title, 'Shared a photo'); // media-only message gets a default title
  // no media, no text -> still skipped
  r = await handleInbound({ id: 'm3', groupJid: 'g', phone: '+14155550100', text: '' }, { store: mkStore(), discourse: d, config: cfg, log() {} });
  assert.strictEqual(r.status, 'skipped_empty');
});
