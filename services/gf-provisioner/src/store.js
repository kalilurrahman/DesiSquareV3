// File-backed identity_link store for the stub. Productionise into a Postgres table.
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) { this.file = file; this.links = {}; this._load(); }
  _load() { try { if (fs.existsSync(this.file)) this.links = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {} }
  _save() { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.links, null, 2)); }

  getByUserId(userId) { return this.links[String(userId)] || null; }
  getByEmail(email) {
    return Object.values(this.links).find((l) => l.email?.toLowerCase() === String(email).toLowerCase()) || null;
  }
  getByAccountId(accountId) {
    return Object.values(this.links).find((l) => String(l.ghostfolioAccountId) === String(accountId)) || null;
  }
  link({ userId, username, email, ghostfolioAccountId, tokenRef }) {
    this.links[String(userId)] = {
      userId, username, email,
      ghostfolioAccountId, tokenRef: tokenRef || null,
      // DS-075: portfolio summaries are PRIVATE by default; the member opts in explicitly.
      publicSummary: this.links[String(userId)]?.publicSummary ?? false,
      createdAt: this.links[String(userId)]?.createdAt || new Date().toISOString(),
    };
    this._save();
    return this.links[String(userId)];
  }
  setVisibility(userId, publicSummary) {
    const l = this.links[String(userId)];
    if (!l) return null;
    l.publicSummary = !!publicSummary;
    this._save();
    return l;
  }
  count() { return Object.keys(this.links).length; }
}
