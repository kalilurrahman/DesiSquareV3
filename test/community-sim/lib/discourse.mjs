// Minimal dependency-free Discourse admin API client for the community sim.
// Auth: a global ("All users") admin API key; per-user actions use Api-Username
// impersonation, which Discourse supports for global keys.

export class DiscourseClient {
  constructor({ baseUrl, apiKey, apiUsername = 'system', paceMs = 600, verbose = false }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.apiUsername = apiUsername;
    this.paceMs = paceMs; // ~100/min stays under default admin API limits with headroom
    this.verbose = verbose;
    this._last = 0;
  }

  async _pace() {
    const wait = this._last + this.paceMs - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this._last = Date.now();
  }

  /** Raw request. as=null → anonymous (no auth headers) for gate checks. */
  async req(method, path, { body, as = this.apiUsername, form = false, anon = false, retries = 4 } = {}) {
    await this._pace();
    const headers = {};
    if (!anon) {
      headers['Api-Key'] = this.apiKey;
      headers['Api-Username'] = as;
    }
    let payload;
    if (body !== undefined) {
      if (form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        payload = new URLSearchParams(body).toString();
      } else {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
    }
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(this.baseUrl + path, { method, headers, body: payload, redirect: 'manual' });
      if (res.status === 429 && attempt < retries) {
        const ra = Number(res.headers.get('retry-after')) || 5 * (attempt + 1);
        if (this.verbose) console.log(`  429 on ${path} — backing off ${ra}s`);
        await new Promise(r => setTimeout(r, ra * 1000));
        continue;
      }
      let json = null;
      const text = await res.text();
      try { json = JSON.parse(text); } catch { /* html or empty */ }
      return { status: res.status, json, text, headers: res.headers };
    }
  }

  get(path, opts) { return this.req('GET', path, opts); }
  post(path, body, opts = {}) { return this.req('POST', path, { ...opts, body }); }
  put(path, body, opts = {}) { return this.req('PUT', path, { ...opts, body }); }

  /** Create an active, approved user (no activation email needed). */
  async createUser({ username, email, password, name = '', bio = '' }) {
    const r = await this.post('/users.json', {
      name, username, email, password, active: true, approved: true,
    });
    if (r.status === 200 && r.json?.success) {
      if (bio) await this.put(`/u/${username}.json`, { bio_raw: bio }, { as: username });
      return { ok: true, id: r.json.user_id };
    }
    // 'already taken' → treat as ok (idempotent re-runs)
    const msg = JSON.stringify(r.json ?? r.text).slice(0, 300);
    if (/already|taken/i.test(msg)) return { ok: true, existed: true };
    return { ok: false, error: `HTTP ${r.status}: ${msg}` };
  }

  async ensureCategory({ name, description }) {
    const list = await this.get('/categories.json');
    const found = list.json?.category_list?.categories?.find(c => c.name === name);
    if (found) return { ok: true, id: found.id, existed: true };
    const r = await this.post('/categories.json', {
      name, color: '3B5B92', text_color: 'FFFFFF', description,
    });
    if (r.status === 200 && r.json?.category?.id) return { ok: true, id: r.json.category.id };
    return { ok: false, error: `HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}` };
  }

  async createTopic({ title, raw, categoryId, tags = [], as }) {
    const r = await this.post('/posts.json', { title, raw, category: categoryId, tags }, { as });
    if (r.status === 200 && r.json?.topic_id) {
      return { ok: true, topicId: r.json.topic_id, postId: r.json.id, slug: r.json.topic_slug };
    }
    return { ok: false, error: `HTTP ${r.status}: ${JSON.stringify(r.json ?? r.text).slice(0, 300)}` };
  }

  async reply({ topicId, raw, as }) {
    const r = await this.post('/posts.json', { topic_id: topicId, raw }, { as });
    if (r.status === 200 && r.json?.id) return { ok: true, postId: r.json.id, postNumber: r.json.post_number };
    return { ok: false, error: `HTTP ${r.status}: ${JSON.stringify(r.json ?? r.text).slice(0, 300)}` };
  }

  /** Core like (post_action_type_id 2). Works with or without discourse-reactions. */
  async like({ postId, as }) {
    const r = await this.post('/post_actions.json', { id: postId, post_action_type_id: 2 }, { as, form: true });
    if (r.status === 200) return { ok: true };
    const msg = JSON.stringify(r.json ?? '').slice(0, 200);
    if (/already/i.test(msg)) return { ok: true, existed: true };
    return { ok: false, error: `HTTP ${r.status}: ${msg}` };
  }

  /** Private flag → review queue (6 = notify_moderators with message, 8 = spam, 4 = inappropriate). */
  async flag({ postId, as, type = 8, message }) {
    const body = { id: postId, post_action_type_id: type };
    if (message) { body.message = message; body.flag_topic = false; }
    const r = await this.post('/post_actions.json', body, { as, form: true });
    return r.status === 200 ? { ok: true } : { ok: false, error: `HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}` };
  }

  /** Solved-plugin accepted answer. Fails soft when plugin is absent. */
  async acceptAnswer({ postId, as }) {
    const r = await this.post('/solution/accept.json', { id: postId }, { as, form: true });
    return { ok: r.status === 200, status: r.status };
  }

  async search(q, { as } = {}) {
    const r = await this.get(`/search.json?q=${encodeURIComponent(q)}`, as ? { as } : {});
    return r;
  }
}
