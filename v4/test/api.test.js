// Phase-1 acceptance tests over the real HTTP surface (PRD §5 + non-negotiables §6).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client } from './helpers.mjs';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.stop());

test('non-negotiable #7: signed-out users get 401 on every member route', async () => {
  const anon = client(srv.base);
  for (const path of ['/api/feed', '/api/posts/p01', '/api/users/quiet_lotus', '/api/review-queue']) {
    const { status } = await anon('GET', path);
    assert.equal(status, 401, path);
  }
  // but the landing bootstrap works
  const { status, body } = await anon('GET', '/api/bootstrap');
  assert.equal(status, 200);
  assert.equal(body.me, null);
  assert.ok(body.stats.members > 0);
});

test('demo sign-in -> seeded feed with a via-WhatsApp post and no karma anywhere', async () => {
  const c = client(srv.base);
  const login = await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  assert.equal(login.status, 200);
  const { body } = await c('GET', '/api/feed?space=all');
  assert.ok(body.posts.length >= 12);
  assert.ok(body.posts.some((p) => p.via === 'whatsapp'), 'seed includes a via-WhatsApp post');
  assert.ok(!JSON.stringify(body).toLowerCase().includes('karma'), 'phase-2 karma never appears');
});

test('positive reactions toggle; exactly the 4 positive kinds accepted', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const on = await c('POST', '/api/posts/p01/react', { type: 'insightful' });
  assert.equal(on.body.reactions.insightful.on, true);
  const n = on.body.reactions.insightful.n;
  const off = await c('POST', '/api/posts/p01/react', { type: 'insightful' });
  assert.equal(off.body.reactions.insightful.on, false);
  assert.equal(off.body.reactions.insightful.n, n - 1);
  const bad = await c('POST', '/api/posts/p01/react', { type: 'downvote' });
  assert.equal(bad.status, 422);
});

test('non-negotiable #3: negative reactions route privately to the queue, never public', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const flag = await c('POST', '/api/posts/p05/flag', { reason: 'Low Effort' });
  assert.equal(flag.status, 200);
  // Post stays public and its payload carries no flag reason for OTHER members…
  const other = client(srv.base);
  await other('POST', '/api/session', { mode: 'demo', userId: 'nikhil_cfa' });
  const view = await other('GET', '/api/posts/p05');
  assert.equal(view.status, 200);
  assert.equal(view.body.post.myFlag, null, 'flag is private to the flagger');
  // …the flagger sees a quiet confirmation…
  const mine = await c('GET', '/api/posts/p05');
  assert.equal(mine.body.post.myFlag, 'Low Effort');
  // …and moderators see it in the queue.
  const mod = client(srv.base);
  await mod('POST', '/api/session', { mode: 'demo', userId: 'desisquare_mod' });
  const queue = await mod('GET', '/api/review-queue');
  assert.ok(queue.body.items.some((q) => q.post?.id === 'p05' && q.reason === 'Low Effort'));
  // members cannot read the queue
  const member = await c('GET', '/api/review-queue');
  assert.equal(member.status, 403);
});

test('moderator remove pulls the post from the feed', async () => {
  const mod = client(srv.base);
  await mod('POST', '/api/session', { mode: 'demo', userId: 'desisquare_mod' });
  const queue = await mod('GET', '/api/review-queue');
  const pending = queue.body.items.find((q) => q.status === 'pending' && q.post?.id === 'p12');
  assert.ok(pending, 'seeded misleading post sits in the queue');
  await mod('POST', `/api/review-queue/${pending.id}`, { action: 'remove' });
  const feed = await mod('GET', '/api/feed?space=all');
  assert.ok(!feed.body.posts.some((p) => p.id === 'p12'), 'removed post is gone');
});

test('non-negotiable #4: portfolio private by default; public = allocation % only', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  // another member's private portfolio
  const priya = await c('GET', '/api/users/priya_taxes');
  assert.equal(priya.body.portfolio.view, 'private');
  assert.ok(!('value' in priya.body.portfolio));
  // opted-in public portfolio: allocation only, never dollar values
  const nikhil = await c('GET', '/api/users/nikhil_cfa');
  assert.equal(nikhil.body.portfolio.view, 'public');
  assert.ok(!('value' in nikhil.body.portfolio), 'no dollar value on public view');
  assert.ok(nikhil.body.portfolio.holdings.every((h) => 'pc' in h && !('value' in h)));
  // owner sees everything
  const own = await c('GET', '/api/users/quiet_lotus');
  assert.equal(own.body.portfolio.view, 'owner');
  assert.equal(own.body.portfolio.value, 182400);
});

test('country switcher swaps the community list; private community join -> pending request', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const ca = await c('GET', '/api/communities?country=CA');
  assert.deepEqual(ca.body.communities.map((x) => x.id).sort(), ['cainv', 'maple']);
  const req = await c('POST', '/api/communities/fire/join');
  assert.equal(req.body.status, 'requested');
  const again = await c('GET', '/api/communities?country=US');
  assert.equal(again.body.communities.find((x) => x.id === 'fire').requested, true);
  const pub = await c('POST', '/api/communities/options/join');
  assert.equal(pub.body.status, 'joined');
});

test('invite signup: bad code rejected, good code creates pseudonymous member', async () => {
  const c = client(srv.base);
  const bad = await c('POST', '/api/session', { mode: 'invite', code: 'DSQ-NOPE', pseudonym: 'x_y' });
  assert.equal(bad.status, 403);
  const good = await c('POST', '/api/session', { mode: 'invite', code: 'dsq-2026', pseudonym: 'Test User!!' });
  assert.equal(good.status, 200);
  assert.equal(good.body.me.name, 'test_user__', 'pseudonym sanitized, never a real-name requirement');
  const feed = await c('GET', '/api/feed');
  assert.equal(feed.status, 200, 'new member is signed in');
});

test('experiments persist per member and only accept A/B', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const set = await c('PUT', '/api/me/experiments', { density: 'B', rail: 'Z' });
  assert.equal(set.body.experiments.density, 'B');
  assert.equal(set.body.experiments.rail, 'A', 'invalid variant ignored');
  await c('PUT', '/api/me/experiments', { density: 'A' });
});

test('theme: 5 options catalog, default warm, only known ids accepted, persists per member', async () => {
  const c = client(srv.base);
  const boot = await c('GET', '/api/bootstrap');
  assert.deepEqual(Object.keys(boot.body.themesCatalog), ['warm', 'midnight', 'sandalwood', 'porcelain', 'haldi']);
  const login = await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  assert.equal(login.body.me.theme, 'warm', 'default theme is warm');
  const bad = await c('PUT', '/api/me/theme', { theme: 'neon' });
  assert.equal(bad.status, 422);
  const ok = await c('PUT', '/api/me/theme', { theme: 'midnight' });
  assert.equal(ok.body.theme, 'midnight');
  const me = await c('GET', '/api/bootstrap');
  assert.equal(me.body.me.theme, 'midnight', 'theme persists on the member');
  await c('PUT', '/api/me/theme', { theme: 'warm' });
});

test('settings toggles round-trip', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const off = await c('PUT', '/api/me/settings', { waConsentMirror: false, portfolioPublic: true });
  assert.equal(off.body.me.waConsentMirror, false);
  assert.equal(off.body.me.portfolioPublic, true);
  const back = await c('PUT', '/api/me/settings', { waConsentMirror: true, portfolioPublic: false });
  assert.equal(back.body.me.waConsentMirror, true);
  assert.equal(back.body.me.portfolioPublic, false);
});
