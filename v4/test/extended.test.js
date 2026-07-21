// Phase-1 extension: open registration, admin management, search, maven performance.
// Same HTTP-surface style as api.test.js; one shared server per file (seeded, isolated dir).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client } from './helpers.mjs';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.stop());

const CURRENCY = /\$\s?\d|[₹£]\s?\d/; // any dollar/rupee/pound amount — must never appear in performance

test('register: happy path creates a signed-in peer; me carries isAdmin=false', async () => {
  const c = client(srv.base);
  const reg = await c('POST', '/api/register', { username: 'new_member', email: 'new@example.com', password: 'hunter2secret' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.me.name, 'new_member');
  assert.equal(reg.body.me.isAdmin, false);
  assert.equal(reg.body.me.isMaven, false);
  assert.ok(!JSON.stringify(reg.body.me).includes('@example.com'), 'email never rides in the me payload');
  // session is live for the returned cookie
  const feed = await c('GET', '/api/feed');
  assert.equal(feed.status, 200);
});

test('register: duplicate username or email -> 409 with a non-enumerating message', async () => {
  await client(srv.base)('POST', '/api/register', { username: 'dup_user', email: 'dup@example.com', password: 'hunter2secret' });
  const dupName = await client(srv.base)('POST', '/api/register', { username: 'dup_user', email: 'other@example.com', password: 'hunter2secret' });
  assert.equal(dupName.status, 409);
  assert.match(dupName.body.error, /already in use/);
  const dupEmail = await client(srv.base)('POST', '/api/register', { username: 'other_user', email: 'dup@example.com', password: 'hunter2secret' });
  assert.equal(dupEmail.status, 409);
  assert.equal(dupEmail.body.error, dupName.body.error, 'same message whether username or email collides');
});

test('register: validation rejects bad username, bad email, short password', async () => {
  const short = await client(srv.base)('POST', '/api/register', { username: 'AB', email: 'ab@example.com', password: 'longenough1' });
  assert.equal(short.status, 422);
  const digits = await client(srv.base)('POST', '/api/register', { username: '4155550172', email: 'd@example.com', password: 'longenough1' });
  assert.equal(digits.status, 422, 'all-digit username reads like a phone number (#1)');
  const badEmail = await client(srv.base)('POST', '/api/register', { username: 'good_name', email: 'not-an-email', password: 'longenough1' });
  assert.equal(badEmail.status, 422);
  const shortPw = await client(srv.base)('POST', '/api/register', { username: 'good_name', email: 'g@example.com', password: 'short' });
  assert.equal(shortPw.status, 422);
});

test('session: registered user logs in by username or email; demo personas still work unchanged', async () => {
  await client(srv.base)('POST', '/api/register', { username: 'login_user', email: 'lu@example.com', password: 'sup3rsecret' });
  const byName = await client(srv.base)('POST', '/api/session', { username: 'login_user', password: 'sup3rsecret' });
  assert.equal(byName.status, 200);
  assert.equal(byName.body.me.name, 'login_user');
  const byEmail = await client(srv.base)('POST', '/api/session', { username: 'lu@example.com', password: 'sup3rsecret' });
  assert.equal(byEmail.status, 200);
  const wrong = await client(srv.base)('POST', '/api/session', { username: 'login_user', password: 'nope' });
  assert.equal(wrong.status, 401);
  // demo persona: no password on the account, still selectable via mode:'demo'
  const demo = await client(srv.base)('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  assert.equal(demo.status, 200);
  const asPw = await client(srv.base)('POST', '/api/session', { username: 'quiet_lotus', password: 'anything' });
  assert.equal(asPw.status, 401, 'a persona can never be password-logged-in');
});

test('admin: 403 for non-admin, 401 for anon, overview for admin', async () => {
  const member = client(srv.base);
  await member('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  assert.equal((await member('GET', '/api/admin/overview')).status, 403);
  assert.equal((await client(srv.base)('GET', '/api/admin/overview')).status, 401);

  const admin = client(srv.base);
  const login = await admin('POST', '/api/session', { mode: 'demo', userId: 'desisquare_admin' });
  assert.equal(login.body.me.isAdmin, true);
  const ov = await admin('GET', '/api/admin/overview');
  assert.equal(ov.status, 200);
  assert.ok(ov.body.users > 0 && ov.body.communities > 0);
  assert.ok(typeof ov.body.pendingFlags === 'number');
  assert.ok(Array.isArray(ov.body.recentSignups) && 'username' in ov.body.recentSignups[0]);
});

test('admin: users list exposes email (the single admin-scoped exception), role grant/revoke works', async () => {
  const admin = client(srv.base);
  await admin('POST', '/api/session', { mode: 'demo', userId: 'desisquare_admin' });
  const users = await admin('GET', '/api/admin/users');
  assert.ok(Array.isArray(users.body));
  assert.ok(users.body.some((u) => typeof u.email === 'string' && u.email.includes('@')), 'admin sees email');
  assert.ok(users.body.every((u) => 'groups' in u && 'postCount' in u));

  const grant = await admin('POST', '/api/admin/users/quant_aunty/role', { role: 'mavens', action: 'grant', credential: 'CFA candidate' });
  assert.equal(grant.status, 200);
  assert.equal(grant.body.user.isMaven, true);
  assert.equal(grant.body.user.credential, 'CFA candidate');
  const revoke = await admin('POST', '/api/admin/users/quant_aunty/role', { role: 'mavens', action: 'revoke' });
  assert.equal(revoke.body.user.isMaven, false);
  assert.equal(revoke.body.user.credential, null);
});

test('admin: create / rename+archive a space, and hard-remove a post', async () => {
  const admin = client(srv.base);
  await admin('POST', '/api/session', { mode: 'demo', userId: 'desisquare_admin' });
  const create = await admin('POST', '/api/admin/spaces', { name: 'Crypto & Web3', description: 'BTC, ETH and the desi crypto tax mess.' });
  assert.equal(create.status, 201);
  assert.equal(create.body.space.id, 'crypto-web3');
  const put = await admin('PUT', `/api/admin/spaces/${create.body.space.id}`, { name: 'Crypto Corner', archived: true });
  assert.equal(put.body.space.name, 'Crypto Corner');
  assert.equal(put.body.space.archived, true);

  const rm = await admin('POST', '/api/admin/posts/p05/remove');
  assert.equal(rm.status, 200);
  const member = client(srv.base);
  await member('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const feed = await member('GET', '/api/feed?space=all');
  assert.ok(!feed.body.posts.some((p) => p.id === 'p05'), 'admin-removed post leaves the feed');
});

test('search: member-only, returns the 5 buckets, ranks matches, empty q -> zeros', async () => {
  const anon = await client(srv.base)('GET', '/api/search?q=tax');
  assert.equal(anon.status, 401);

  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const res = await c('GET', '/api/search?q=tax');
  assert.equal(res.status, 200);
  for (const k of ['posts', 'communities', 'comments', 'profiles']) assert.ok(Array.isArray(res.body[k]), `${k} is an array`);
  for (const k of ['all', 'posts', 'communities', 'comments', 'profiles']) assert.equal(typeof res.body.counts[k], 'number', `counts.${k}`);
  assert.ok(res.body.counts.all > 0);
  assert.equal(res.body.counts.all, res.body.counts.posts + res.body.counts.communities + res.body.counts.comments + res.body.counts.profiles);
  assert.ok(!JSON.stringify(res.body.profiles).includes('@'), 'profiles never leak email');

  const empty = await c('GET', '/api/search?q=');
  assert.equal(empty.body.counts.all, 0);
  assert.deepEqual(empty.body.posts, []);
});

test('maven performance: percent-only, no currency, 404 for non-mavens, ~150-point index', async () => {
  const anon = await client(srv.base)('GET', '/api/mavens/nikhil_cfa/performance');
  assert.equal(anon.status, 401);

  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const notMaven = await c('GET', '/api/mavens/quiet_lotus/performance');
  assert.equal(notMaven.status, 404, 'only mavens have a performance card');

  const perf = await c('GET', '/api/mavens/nikhil_cfa/performance');
  assert.equal(perf.status, 200);
  const p = perf.body;
  // shape
  assert.ok(typeof p.overall.cumulativePct === 'number');
  assert.ok(typeof p.overall.annualizedPct === 'number' && typeof p.overall.ytdPct === 'number');
  assert.ok(p.overall.riskScore >= 1 && p.overall.riskScore <= 7);
  assert.ok(Array.isArray(p.yearly) && p.yearly.length >= 1);
  assert.ok(Array.isArray(p.monthly) && p.monthly.length >= 12);
  assert.ok(Array.isArray(p.series) && p.series.length >= 120);
  assert.equal(p.series[0].index, 100, 'index starts at 100 (percent index, not currency)');
  const allocSum = p.allocation.reduce((s, a) => s + a.pct, 0);
  assert.ok(Math.abs(allocSum - 100) <= 2, 'allocation sums to ~100%');
  assert.ok(p.recent.every((r) => r.side === 'BUY' || r.side === 'SELL'));
  // the guard: absolutely no currency / absolute value anywhere in the payload
  assert.ok(!CURRENCY.test(JSON.stringify(p)), 'no dollar/rupee/pound amount');
  assert.ok(!JSON.stringify(p).includes('"value"'), 'no absolute value field');
});

test('review-queue: /remove and /dismiss sub-paths work for moderator or admin, 403 for members', async () => {
  const mod = client(srv.base);
  await mod('POST', '/api/session', { mode: 'demo', userId: 'desisquare_mod' });
  const queue = await mod('GET', '/api/review-queue');
  const first = queue.body.items.find((q) => q.status === 'pending');
  assert.ok(first, 'seed has pending flags');
  const dismissed = await mod('POST', `/api/review-queue/${first.id}/dismiss`);
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.body.status, 'dismissed');

  // The queue GET stays moderator-scoped; an admin acts on an id the moderator surfaces.
  const admin = client(srv.base);
  await admin('POST', '/api/session', { mode: 'demo', userId: 'desisquare_admin' });
  const queue2 = await mod('GET', '/api/review-queue');
  const second = queue2.body.items.find((q) => q.status === 'pending');
  if (second) {
    const removed = await admin('POST', `/api/review-queue/${second.id}/remove`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.status, 'removed');
  }

  const member = client(srv.base);
  await member('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const forbid = await member('POST', `/api/review-queue/${first.id}/dismiss`);
  assert.equal(forbid.status, 403);
});
