// File-backed state store for the stub (phone map, consent, message idempotency, notif prefs).
// Productionise: encrypted `phone_map`/`identity_link` tables + Redis for hot lookups + dedupe.
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    this.state = { phoneMap: {}, seen: {}, notifPrefs: {} };
    this._load();
  }
  _load() {
    try { if (fs.existsSync(this.file)) this.state = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
  }
  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2));
  }

  // --- phone <-> user mapping (phone is the key; never returned to clients) ---
  mapPhone(phoneE164, discourseUsername, discourseUserId) {
    this.state.phoneMap[phoneE164] = {
      username: discourseUsername,
      userId: discourseUserId ?? null,
      consentAt: new Date().toISOString(),
      optOut: false,
    };
    this._save();
  }
  getUserByPhone(phoneE164) {
    const m = this.state.phoneMap[phoneE164];
    if (!m || m.optOut) return null;
    return { username: m.username, userId: m.userId };
  }
  optOut(phoneE164) {
    if (this.state.phoneMap[phoneE164]) { this.state.phoneMap[phoneE164].optOut = true; this._save(); return true; }
    return false;
  }
  phoneForUserId(userId) {
    for (const [phone, m] of Object.entries(this.state.phoneMap)) {
      if (String(m.userId) === String(userId) && !m.optOut) return phone;
    }
    return null;
  }
  mappedCount() { return Object.values(this.state.phoneMap).filter((m) => !m.optOut).length; }

  // --- idempotency for inbound WhatsApp messages / outbound notifications ---
  seen(id) { return !!this.state.seen[id]; }
  markSeen(id) { this.state.seen[id] = Date.now(); this._save(); }
}
