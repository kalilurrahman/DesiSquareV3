// A minimal Discourse-compatible API surface, exactly the subset wa-bridge consumes.
// Point wa-bridge at this app (DISCOURSE_URL=http://localhost:8786, any non-empty
// DISCOURSE_API_KEY) and mirrored WhatsApp messages land in the prototype feed through the
// REAL Script 1 — no changes to wa-bridge.
//
//   GET  /categories.json   -> category_list.categories [{id, name, slug}]   (slug->id resolve)
//   POST /posts.json        -> create topic {title, raw, category} as Api-Username
//   GET  /u/:username.json  -> {user:{id, username}}                          (theme parity)
//   GET  /t/:topicId        -> 302 to the SPA post page (WhatsApp deep links)
import { json } from './util.mjs';

function slugify(name) {
  return String(name).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function createDiscourseCompat({ store, api, integrations, config }) {
  const S = () => store.state;

  function categories() {
    return S().spaces.map((s, i) => ({ id: i + 1, name: s.name, slug: slugify(s.name), topic_count: s.count }));
  }

  async function handle(req, res, pathname, readJsonBody) {
    if (req.method === 'GET' && pathname === '/categories.json') {
      return json(res, 200, { category_list: { categories: categories() } });
    }

    if (req.method === 'POST' && pathname === '/posts.json') {
      const apiKey = req.headers['api-key'];
      if (config.compatApiKey && apiKey !== config.compatApiKey) {
        return json(res, 403, { errors: ['invalid api key'] });
      }
      if (!apiKey) return json(res, 403, { errors: ['api key required'] });
      const body = await readJsonBody(req);
      const username = String(req.headers['api-username'] ?? 'system');
      const cat = categories().find((c) => c.id === Number(body.category) || c.slug === String(body.category));
      const knownUser = S().users[username] && username !== config.compatGuestUsername ? username : null;
      const post = api.createMirroredPost({
        username: knownUser,
        title: String(body.title ?? ''),
        raw: String(body.raw ?? ''),
      });
      if (cat) {
        const space = S().spaces.find((s) => slugify(s.name) === cat.slug);
        if (space) { post.space = space.id; store.save(); }
      }
      integrations.event('discourse_compat_post', {
        author: knownUser ?? 'guest', space: post.space, postId: post.id, from: 'wa-bridge',
      });
      return json(res, 200, { id: post.id, topic_id: post.id, topic_slug: post.id });
    }

    const userMatch = pathname.match(/^\/u\/([^/]+)\.json$/);
    if (req.method === 'GET' && userMatch) {
      const u = S().users[decodeURIComponent(userMatch[1])];
      if (!u) return json(res, 404, { errors: ['not found'] });
      return json(res, 200, { user: { id: u.id, username: u.id, name: u.name } });
    }

    const topicMatch = pathname.match(/^\/t\/([^/]+)$/);
    if (req.method === 'GET' && topicMatch) {
      res.writeHead(302, { location: `/#/post/${encodeURIComponent(topicMatch[1])}` });
      res.end();
      return true;
    }

    return null;
  }

  return { handle };
}
