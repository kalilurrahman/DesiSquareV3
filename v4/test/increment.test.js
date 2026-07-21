// V3 increment: popular/hot feed + top-N ranks, public teaser, posting penalties (remove+ban),
// community calendar, and engagement-only karma + leaderboard. Same HTTP-surface style as the
// other suites; one shared seeded server per file.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client } from './helpers.mjs';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.stop());

const CURRENCY = /[$₹£]\s?\d/;              // any dollar/rupee/pound amount
const E164 = /\+[1-9][0-9\-\s().]{7,}[0-9]/; // phone-shaped

test('feed: popular is the default; hotScore ranks and top 3 carry popRank 1..3', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });

  const def = await c('GET', '/api/feed');
  assert.equal(def.status, 200);
  assert.equal(def.body.sort, 'popular', 'default sort is popular');

  const pop = await c('GET', '/api/feed?sort=popular');
  const posts = pop.body.posts;
  // p03 has the highest hot score (126 reactions + 2*1 comment = 128).
  assert.equal(posts[0].id, 'p03');
  assert.equal(posts[0].score, 128);
  assert.equal(posts[0].popRank, 1);
  assert.equal(posts[1].popRank, 2);
  assert.equal(posts[2].popRank, 3);
  assert.equal(posts[3].popRank, undefined, 'only the top 3 are badged');
  // non-increasing hot score down the list
  for (let i = 1; i < posts.length; i++) assert.ok(posts[i - 1].score >= posts[i].score);
  // existing postVM fields survive
  assert.ok('reactions' in posts[0] && 'author' in posts[0] && 'timeAgo' in posts[0]);
});

test('feed: sort=new is strict recency and differs from popular', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const fresh = await c('GET', '/api/feed?sort=new');
  assert.equal(fresh.body.sort, 'new');
  const posts = fresh.body.posts;
  assert.equal(posts[0].id, 'p01', 'newest post first (minsAgo 120)');
  for (let i = 1; i < posts.length; i++) assert.ok(posts[i - 1].createdAt >= posts[i].createdAt);
  assert.equal(posts[0].popRank, undefined, 'new sort carries no popRank');
});

test('teaser: public (no auth), public spaces only, no bodies/email/phone/currency', async () => {
  const anon = client(srv.base);
  // The full member feed stays gated…
  assert.equal((await anon('GET', '/api/feed')).status, 401);
  // …but the teaser is the single unauthenticated content path.
  const res = await anon('GET', '/api/teaser');
  assert.equal(res.status, 200);
  const { posts } = res.body;
  assert.ok(posts.length >= 1 && posts.length <= 6);
  assert.equal(posts[0].id, 'p03', 'highest-hot public post leads the teaser');
  // p07 lives in the member-only "re" space -> must never surface here (even though it is top-3 hot)
  assert.ok(!posts.some((p) => p.id === 'p07'), 'member-only space excluded');
  assert.ok(!posts.some((p) => p.space === 'Real Estate'));

  const blob = JSON.stringify(res.body);
  assert.equal(blob.match(E164), null, 'no phone number');
  assert.equal(blob.match(CURRENCY), null, 'no currency amount (e.g. p03 "$10k" is scrubbed)');
  assert.ok(!blob.includes('@'), 'no email');
  for (const p of posts) {
    assert.ok(!('body' in p) && !('bodyFull' in p), 'never a full body');
    assert.equal(typeof p.author, 'string', 'author is a pseudonym string, not a card');
    assert.ok(p.snippet.length <= 160);
    for (const k of ['id', 'title', 'snippet', 'space', 'reactions', 'commentCount', 'age']) assert.ok(k in p, `missing ${k}`);
  }
});

test('moderation: remove + ban suspends the author (403 on POST /api/posts); dismiss leaves content', async () => {
  // A registered account we can hold a live session for, so we can prove the 403 after the ban.
  const spammer = client(srv.base);
  const reg = await spammer('POST', '/api/register', { username: 'spam_bot', email: 'spam@example.com', password: 'longenough1' });
  assert.equal(reg.status, 201);
  const made = await spammer('POST', '/api/posts', { title: 'join my paid signals', body: 'dm me', space: 'help' });
  const postId = made.body.post.id;

  // A member flags it into the queue.
  const flagger = client(srv.base);
  await flagger('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  assert.equal((await flagger('POST', `/api/posts/${postId}/flag`, { reason: 'Spam' })).status, 200);

  // Moderator sees the enriched queue VM and removes + bans for 3 days.
  const mod = client(srv.base);
  await mod('POST', '/api/session', { mode: 'demo', userId: 'desisquare_mod' });
  const q = (await mod('GET', '/api/review-queue')).body.items.find((it) => it.postId === postId);
  assert.ok(q, 'flagged post is in the queue');
  assert.equal(q.reason, 'Spam');
  assert.equal(q.quote, 'dm me', 'quote is the post body');
  assert.equal(q.removed, false);
  assert.ok(q.flagCount >= 1 && typeof q.author === 'string');

  const removed = await mod('POST', `/api/review-queue/${q.id}/remove`, { banDays: 3 });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.status, 'removed');
  assert.equal(removed.body.banned, true);
  assert.ok(typeof removed.body.banUntil === 'number' && removed.body.banUntil > Date.now());

  // The banned author can no longer post…
  const blocked = await spammer('POST', '/api/posts', { title: 'again', body: 'x', space: 'help' });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error, 'posting suspended');
  assert.equal(blocked.body.until, removed.body.banUntil);
  // …nor comment.
  const blockedC = await spammer('POST', '/api/posts/p01/comments', { text: 'hi' });
  assert.equal(blockedC.status, 403);
  // …and the post is gone from the feed.
  const feed = await mod('GET', '/api/feed?space=all');
  assert.ok(!feed.body.posts.some((p) => p.id === postId), 'removed post left the feed');

  // Dismiss (on a seeded item) leaves the content untouched.
  const q2 = (await mod('GET', '/api/review-queue')).body.items.find((it) => it.postId === 'p12' && it.status === 'pending');
  assert.ok(q2, 'seeded misleading post is pending');
  const dis = await mod('POST', `/api/review-queue/${q2.id}/dismiss`);
  assert.equal(dis.body.status, 'dismissed');
  const still = await mod('GET', '/api/posts/p12');
  assert.equal(still.status, 200, 'dismissed post is still visible');
});

test('review-queue seed: q1 = 9 flags / Self-Marketing, q2 = 5 flags / Misleading', async () => {
  const mod = client(srv.base);
  await mod('POST', '/api/session', { mode: 'demo', userId: 'desisquare_mod' });
  const items = (await mod('GET', '/api/review-queue')).body.items;
  const q1 = items.find((q) => q.id === 'q1');
  const q2 = items.find((q) => q.id === 'q2');
  assert.equal(q1.reason, 'Self-Marketing');
  assert.equal(q1.flagCount, 9);
  assert.equal(q2.reason, 'Misleading');
  assert.equal(q2.flagCount, 5);
});

test('calendar: member-only read has the 3 seeded events (chronological); POST/DELETE are mod-only', async () => {
  const anon = client(srv.base);
  assert.equal((await anon('GET', '/api/calendar')).status, 401);

  const member = client(srv.base);
  await member('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const seeded = await member('GET', '/api/calendar');
  assert.equal(seeded.status, 200);
  assert.equal(seeded.body.events.length, 3);
  assert.deepEqual(seeded.body.events.map((e) => e.date), ['Jul 14', 'Jul 18', 'Jul 25'], 'chronological');
  assert.equal(seeded.body.events[0].title, 'Office hours: cross-border tax');
  assert.equal(seeded.body.events[1].scope, 'mavens');
  assert.equal(seeded.body.events[2].scope, 'everyone');
  for (const e of seeded.body.events) for (const k of ['id', 'date', 'title', 'host', 'kind', 'scope']) assert.ok(k in e, `missing ${k}`);

  // members cannot add or remove
  assert.equal((await member('POST', '/api/calendar', { date: 'Aug 2', title: 'nope' })).status, 403);

  const mod = client(srv.base);
  await mod('POST', '/api/session', { mode: 'demo', userId: 'desisquare_mod' });
  const add = await mod('POST', '/api/calendar', { date: 'Aug 2', title: 'AMA: RSU season', host: 'Arjun Rao', kind: 'group call', scope: 'everyone' });
  assert.equal(add.status, 201);
  assert.ok(add.body.event.id);
  const after = await member('GET', '/api/calendar');
  assert.equal(after.body.events.length, 4);
  assert.equal(after.body.events[3].date, 'Aug 2', 'new event sorts after July');

  const del = await mod('DELETE', `/api/calendar/${add.body.event.id}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.status, 'deleted');
  assert.equal((await member('GET', '/api/calendar')).body.events.length, 3);
  assert.equal((await member('DELETE', `/api/calendar/${add.body.event.id}`)).status, 403);
});

test('karma: engagement-only surfaces on me/profile/search; leaderboard ranks it with no money leak', async () => {
  const c = client(srv.base);
  const login = await c('POST', '/api/session', { mode: 'demo', userId: 'nikhil_cfa' });
  assert.equal(typeof login.body.me.karma, 'number');
  assert.ok(['New Arrival', 'Regular', 'Trusted', 'Anchor', 'Luminary'].includes(login.body.me.tier));

  const prof = await c('GET', '/api/users/nikhil_cfa');
  assert.equal(typeof prof.body.profile.karma, 'number');
  assert.ok('tier' in prof.body.profile);

  const search = await c('GET', '/api/search?q=nikhil');
  assert.ok(search.body.profiles.length >= 1);
  assert.equal(typeof search.body.profiles[0].karma, 'number');
  assert.ok('tier' in search.body.profiles[0]);

  const lb = await c('GET', '/api/leaderboard');
  assert.equal(lb.status, 200);
  const rows = lb.body.contributors;
  assert.ok(Array.isArray(rows) && rows.length >= 1 && rows.length <= 10);
  for (const r of rows) {
    for (const k of ['id', 'name', 'karma', 'tier', 'isMaven']) assert.ok(k in r, `missing ${k}`);
    assert.equal(typeof r.karma, 'number');
  }
  // ranked by karma, descending
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].karma >= rows[i].karma);
  // #9 guard: recognition never rides on money or % returns
  const blob = JSON.stringify(lb.body);
  assert.equal(blob.match(CURRENCY), null, 'no currency in the leaderboard');
  assert.ok(!blob.includes('%'), 'no percentage in the leaderboard');
  assert.ok(!/pct|ytd|return|cumulative|annualized|portfolio/i.test(blob), 'no portfolio/return field');
  // leaderboard read is member-only
  assert.equal((await client(srv.base)('GET', '/api/leaderboard')).status, 401);
});

test('feed never carries karma (Phase-1 invariant holds after the karma increment)', async () => {
  const c = client(srv.base);
  await c('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
  const feed = await c('GET', '/api/feed?space=all&sort=popular');
  assert.ok(!JSON.stringify(feed.body).toLowerCase().includes('karma'), 'karma stays off the feed author chips');
});
