// Non-negotiable #1 (CI-enforced): no phone numbers on any member-facing surface.
// Scans (a) every shippable file in phase1-mvp, (b) every live API response, for E.164 shapes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, client } from './helpers.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// E.164-ish: +country then 8..14 digits allowing separators. Deliberately broad.
const E164 = /\+[1-9][0-9\-\s().]{7,}[0-9]/;

// test/ is excluded: tests inject reserved-for-fiction 555 numbers as INPUTS to prove the
// stripping works — the live-response scan below is the gate for what members can ever see.
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'db.json', 'test'].some((skip) => name.includes(skip))) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

test('no E.164 phone number in any shipped file (seed, src, public, docs)', () => {
  for (const file of walk(ROOT)) {
    if (!/\.(json|mjs|js|css|html|md|yml|yaml|sh)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    const hit = text.match(E164);
    assert.equal(hit, null, `${file} leaks a phone-like string: ${hit?.[0]}`);
  }
});

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.stop());

test('no E.164 phone number in any live API response', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const endpoints = [
    '/api/bootstrap', '/api/feed?space=all', '/api/posts/p02', '/api/posts/p04',
    '/api/users/quiet_lotus', '/api/users/dallas_desi', '/api/users/nikhil_cfa',
    '/api/communities?country=US', '/api/demo/status', '/categories.json',
  ];
  for (const path of endpoints) {
    const { body } = await c('GET', path);
    const hit = JSON.stringify(body).match(E164);
    assert.equal(hit, null, `${path} leaks a phone-like string: ${hit?.[0]}`);
  }
});

test('phone numbers pasted into posts/comments are stripped before storage', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const post = await c('POST', '/api/posts', {
    title: 'Reach me on +1 (415) 555-0172 anytime',
    body: 'Or WhatsApp +919876543210 — I reply fast.',
    space: 'help',
  });
  assert.equal(post.status, 201);
  const text = JSON.stringify(post.body);
  assert.equal(text.match(E164), null, `stored post leaks: ${text.match(E164)?.[0]}`);
  assert.ok(text.includes('[number removed]'));
  const comment = await c('POST', `/api/posts/${post.body.post.id}/comments`, { text: 'call +14155550100 now' });
  assert.equal(JSON.stringify(comment.body).match(E164), null);
});

test('pseudonyms only: display names never derived from email', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const { body } = await c('GET', '/api/bootstrap');
  assert.ok(!JSON.stringify(body.me).includes('@demo.desisquare.local'), 'email never appears in member payloads');
});
