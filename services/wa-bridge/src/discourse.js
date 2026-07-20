// Minimal Discourse client: post a topic/reply on behalf of a user. Mock when no API key.
export class Discourse {
  constructor(config, log = console.log) {
    this.config = config;
    this.log = log;
  }
  // Discourse's create-topic API wants a numeric category id — resolve a slug to its id (cached).
  async _categoryId(slug) {
    if (!slug) return undefined;
    if (/^\d+$/.test(String(slug))) return Number(slug);
    if (!this._catCache) {
      try {
        const res = await fetch(`${this.config.discourse.url}/categories.json`, { headers: { Accept: 'application/json' } });
        const j = await res.json();
        this._catCache = new Map((j.category_list?.categories || []).map((c) => [c.slug, c.id]));
      } catch { this._catCache = new Map(); }
    }
    return this._catCache.get(slug);
  }

  // B7/DS-048: relay a media file into Discourse. Downloads the source (bounded) and uploads
  // via /uploads.json so the post embeds a LOCAL copy — never hotlinks WhatsApp CDN URLs
  // (they expire and leak origin). Mock (no API key) or any failure returns null; the caller
  // decides the fallback.
  async uploadFromUrl(mediaUrl, filename = 'whatsapp-media') {
    if (!this.config.discourse.apiKey) {
      this.log(`  [mock discourse] would upload media from ${String(mediaUrl).slice(0, 60)}`);
      return null;
    }
    try {
      const src = await fetch(mediaUrl, { signal: AbortSignal.timeout(5000) });
      if (!src.ok) throw new Error(`media fetch ${src.status}`);
      const blob = await src.blob();
      if (blob.size > 8 * 1024 * 1024) throw new Error('media too large (>8MB)');
      const form = new FormData();
      form.set('type', 'composer');
      form.set('files[]', blob, filename);
      const res = await fetch(`${this.config.discourse.url}/uploads.json`, {
        method: 'POST',
        headers: { 'Api-Key': this.config.discourse.apiKey, 'Api-Username': this.config.discourse.apiUsername },
        body: form,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      return (await res.json()).url || null;
    } catch (e) {
      this.log(`  [media] relay failed: ${e.message}`);
      return null;
    }
  }

  async postAsUser({ username, title, raw, category }) {
    const asUser = username || this.config.discourse.guestUsername;
    if (!this.config.discourse.apiKey) {
      this.log(`  [mock discourse] would post as @${asUser} in #${category}: ${title || raw.slice(0, 48)}`);
      return { mock: true, username: asUser };
    }
    const categoryId = await this._categoryId(category);
    const payload = { title, raw };
    if (categoryId) payload.category = categoryId;
    const res = await fetch(`${this.config.discourse.url}/posts.json`, {
      method: 'POST',
      headers: {
        'Api-Key': this.config.discourse.apiKey,
        'Api-Username': asUser,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`discourse post ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
