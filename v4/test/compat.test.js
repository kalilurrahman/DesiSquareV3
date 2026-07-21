// Discourse-compat surface: the contract wa-bridge (Script 1) depends on.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client } from './helpers.mjs';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.stop());

test('GET /categories.json exposes spaces with slug->id resolution (incl. ask-the-community)', async () => {
  const res = await fetch(`${srv.base}/categories.json`);
  const { category_list } = await res.json();
  const cats = category_list.categories;
  assert.ok(cats.length >= 7);
  const help = cats.find((c) => c.slug === 'ask-the-community');
  assert.ok(help, 'wa-bridge MIRROR_CATEGORY default resolves');
  assert.equal(typeof help.id, 'number');
});

test('POST /posts.json as a mapped member -> attributed via-WhatsApp post', async () => {
  const cats = (await (await fetch(`${srv.base}/categories.json`)).json()).category_list.categories;
  const help = cats.find((c) => c.slug === 'ask-the-community');
  const res = await fetch(`${srv.base}/posts.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Api-Key': 'demo-local-key', 'Api-Username': 'quant_aunty' },
    body: JSON.stringify({ title: 'From WA: NPS vs PPF for returning NRIs', raw: 'Long text of the message here.', category: help.id }),
  });
  assert.equal(res.status, 200);
  const { id, topic_id } = await res.json();
  assert.ok(id && topic_id);
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const feed = await c('GET', '/api/feed?space=all');
  const post = feed.body.posts.find((p) => p.id === id);
  assert.equal(post.author.id, 'quant_aunty');
  assert.equal(post.via, 'whatsapp');
  assert.equal(post.spaceName, 'Ask the community');
});

test('POST /posts.json as the guest user -> bridge guest attribution, phone stripped', async () => {
  const res = await fetch(`${srv.base}/posts.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Api-Key': 'demo-local-key', 'Api-Username': 'system' },
    body: JSON.stringify({ title: 'unlinked sender message', raw: 'ping me +14155550172 please', category: 5 }),
  });
  assert.equal(res.status, 200);
  const { id } = await res.json();
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const view = await c('GET', `/api/posts/${id}`);
  assert.equal(view.body.post.author.id, 'wa_guest');
  assert.ok(!JSON.stringify(view.body).match(/\+[0-9][0-9\-\s().]{7,}[0-9]/), 'phone stripped');
});

test('POST /posts.json without Api-Key is rejected', async () => {
  const res = await fetch(`${srv.base}/posts.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'x', raw: 'y', category: 1 }),
  });
  assert.equal(res.status, 403);
});

test('GET /t/:id redirects to the SPA post page (WhatsApp deep links)', async () => {
  const res = await fetch(`${srv.base}/t/p01`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/#/post/p01');
});

test('GET /u/:username.json resolves members for theme parity', async () => {
  const res = await fetch(`${srv.base}/u/quiet_lotus.json`);
  const { user } = await res.json();
  assert.equal(user.username, 'quiet_lotus');
});
