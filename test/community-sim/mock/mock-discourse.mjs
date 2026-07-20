#!/usr/bin/env node
// In-memory mock of the Discourse endpoints used by run.mjs — lets the sim
// harness be exercised end-to-end without a live forum ("harness self-test").
// Simulates login_required: anonymous requests to member endpoints get 403.
// Usage: node test/community-sim/mock/mock-discourse.mjs [port]

import { createServer } from 'node:http';

const port = Number(process.argv[2] || 3939);
const db = {
  categories: [], topics: [], posts: [], users: [], reviewables: [],
  nextCat: 1, nextTopic: 1, nextPost: 1, nextUser: 1,
};

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const topicJson = t => {
  const posts = db.posts.filter(p => p.topicId === t.id);
  return {
    id: t.id, title: t.title, fancy_title: t.title, slug: t.slug, tags: t.tags,
    posts_count: posts.length, like_count: posts.reduce((s, p) => s + p.likes.length, 0),
  };
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://x`);
  const path = url.pathname;
  const authed = !!req.headers['api-key'];
  const asUser = req.headers['api-username'] || 'system';

  let body = '';
  for await (const chunk of req) body += chunk;
  let params = {};
  if (body) {
    if ((req.headers['content-type'] || '').includes('json')) { try { params = JSON.parse(body); } catch {} }
    else params = Object.fromEntries(new URLSearchParams(body));
  }

  // login_required simulation: everything except /about.json needs auth
  if (!authed && path !== '/about.json') return json(res, 403, { errors: ['login required'] });

  if (path === '/about.json') return json(res, 200, { about: { version: 'mock-3.5.0', login_required: true } });
  if (path === '/site.json') return json(res, 200, { login_required: true });

  if (path.match(/^\/admin\/users\/\d+\/trust_level\.json$/) && req.method === 'PUT')
    return json(res, 200, { success: 'OK' });
  if (path.match(/^\/admin\/site_settings\/[\w_]+\.json$/) && req.method === 'PUT')
    return json(res, 200, { success: 'OK' });
  if (path === '/tag_groups.json' && req.method === 'POST')
    return json(res, 200, { tag_group: { id: 1, name: params.name } });

  if (path === '/categories.json' && req.method === 'GET')
    return json(res, 200, { category_list: { categories: db.categories } });
  if (path === '/categories.json' && req.method === 'POST') {
    const c = { id: db.nextCat++, name: params.name, description: params.description };
    db.categories.push(c);
    return json(res, 200, { category: c });
  }

  if (path === '/users.json' && req.method === 'POST') {
    if (db.users.some(u => u.username === params.username))
      return json(res, 200, { success: false, message: 'Username already taken' });
    const u = { id: db.nextUser++, username: params.username, email: params.email, bio: '' };
    db.users.push(u);
    return json(res, 200, { success: true, active: true, user_id: u.id });
  }
  const uMatch = path.match(/^\/u\/([^/]+)\.json$/);
  if (uMatch && req.method === 'PUT') {
    const u = db.users.find(x => x.username === uMatch[1]);
    if (u) u.bio = params.bio_raw ?? u.bio;
    return json(res, 200, { success: 'OK' });
  }
  if (uMatch && req.method === 'GET') {
    const u = db.users.find(x => x.username === uMatch[1]);
    if (!u) return json(res, 404, { errors: ['not found'] });
    // member view: pseudonym only — no email in payload
    return json(res, 200, { user: { id: u.id, username: u.username, bio_raw: u.bio } });
  }

  if (path === '/posts.json' && req.method === 'POST') {
    if (params.title) {
      const t = { id: db.nextTopic++, title: params.title, slug: String(params.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), tags: params.tags ?? [], category: params.category };
      db.topics.push(t);
      const p = { id: db.nextPost++, topicId: t.id, number: 1, raw: params.raw, by: asUser, likes: [], flags: [] };
      db.posts.push(p);
      return json(res, 200, { id: p.id, topic_id: t.id, topic_slug: t.slug, post_number: 1 });
    }
    const t = db.topics.find(x => x.id === Number(params.topic_id));
    if (!t) return json(res, 422, { errors: ['no such topic'] });
    const n = db.posts.filter(p => p.topicId === t.id).length + 1;
    const p = { id: db.nextPost++, topicId: t.id, number: n, raw: params.raw, by: asUser, likes: [], flags: [] };
    db.posts.push(p);
    return json(res, 200, { id: p.id, topic_id: t.id, post_number: n });
  }

  if (path === '/post_actions.json' && req.method === 'POST') {
    const p = db.posts.find(x => x.id === Number(params.id));
    if (!p) return json(res, 422, { errors: ['no such post'] });
    const type = Number(params.post_action_type_id);
    if (type === 2) {
      if (p.likes.includes(asUser)) return json(res, 200, { already: true });
      p.likes.push(asUser);
    } else {
      p.flags.push({ by: asUser, type });
      if (!db.reviewables.some(r => r.postId === p.id)) db.reviewables.push({ id: db.reviewables.length + 1, postId: p.id, type: 'ReviewableFlaggedPost' });
    }
    return json(res, 200, { success: 'OK' });
  }

  if (path === '/solution/accept.json') {
    const p = db.posts.find(x => x.id === Number(params.id));
    if (p) p.accepted = true;
    return json(res, 200, { success: 'OK' });
  }

  if (path === '/search.json') {
    const q = url.searchParams.get('q') ?? '';
    let hits;
    const tagQ = q.match(/^tags:([\w-]+)$/);
    if (tagQ) hits = db.topics.filter(t => t.tags.includes(tagQ[1]));
    else hits = db.topics.filter(t => (t.title + ' ' + db.posts.filter(p => p.topicId === t.id).map(p => p.raw).join(' ')).toLowerCase().includes(q.toLowerCase()));
    return json(res, 200, { topics: hits.map(topicJson), posts: [] });
  }

  const tagMatch = path.match(/^\/tag\/([\w-]+)\.json$/);
  if (tagMatch) {
    const hits = db.topics.filter(t => t.tags.includes(tagMatch[1]));
    return json(res, 200, { topic_list: { topics: hits.map(topicJson) } });
  }

  if (path === '/hot.json' || path === '/latest.json') {
    const ranked = [...db.topics].map(topicJson).sort((a, b) => (b.like_count + 2 * b.posts_count) - (a.like_count + 2 * a.posts_count));
    return json(res, 200, { topic_list: { topics: ranked } });
  }

  const tMatch = path.match(/^\/t\/(\d+)\.json$/);
  if (tMatch) {
    const t = db.topics.find(x => x.id === Number(tMatch[1]));
    if (!t) return json(res, 404, { errors: ['not found'] });
    const posts = db.posts.filter(p => p.topicId === t.id).map(p => ({
      id: p.id, post_number: p.number, username: p.by, cooked: p.raw,
      polls: /\[poll[\s\]]/.test(p.raw) ? [{ name: 'poll', options: [] }] : undefined,
    }));
    return json(res, 200, { id: t.id, title: t.title, tags: t.tags, post_stream: { posts } });
  }

  if (path === '/review.json') return json(res, 200, { reviewables: db.reviewables });

  return json(res, 404, { errors: [`no mock for ${req.method} ${path}`] });
}).listen(port, () => console.log(`mock discourse (login_required) on http://127.0.0.1:${port}`));
