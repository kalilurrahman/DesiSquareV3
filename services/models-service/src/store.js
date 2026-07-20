// File-backed JSON store (sibling-service pattern). Each collection maps 1:1 to a
// Postgres table when promoted: models, model_entries, signals (+ a webhook seen-set).
// Entries and signals are APPEND-ONLY here — no update/delete methods exist on purpose.
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { models: [], entries: [], signals: [], events: [] };
    this._load();
  }
  _load() {
    try {
      if (fs.existsSync(this.file)) {
        this.data = { models: [], entries: [], signals: [], events: [], ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
      }
    } catch { /* corrupt state file → start empty */ }
  }
  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  isEmpty() {
    return this.data.models.length === 0 && this.data.entries.length === 0 && this.data.signals.length === 0;
  }
  counts() {
    return { models: this.data.models.length, entries: this.data.entries.length, signals: this.data.signals.length };
  }

  // — models
  getModel(id) { return this.data.models.find((m) => m.id === id) || null; }
  modelsByOwner(userId) { return this.data.models.filter((m) => String(m.ownerUserId) === String(userId)); }
  allModels() { return [...this.data.models]; }
  addModel(model) { this.data.models.push(model); this._save(); return model; }

  // — model entries (append-only)
  entriesFor(modelId) { return this.data.entries.filter((e) => e.modelId === modelId); }
  getEntryById(id) { return this.data.entries.find((e) => e.id === id) || null; }
  addEntry(entry) { this.data.entries.push(entry); this._save(); return entry; }

  // — signals (append-only, idempotent on postId)
  signalByPostId(postId) { return this.data.signals.find((s) => String(s.postId) === String(postId)) || null; }
  signalsByUser(userId) { return this.data.signals.filter((s) => String(s.userId) === String(userId)); }
  addSignal(signal) { this.data.signals.push(signal); this._save(); return signal; }

  // — webhook event dedupe
  hasEvent(eventId) { return this.data.events.includes(eventId); }
  addEvent(eventId) {
    this.data.events.push(eventId);
    if (this.data.events.length > 5000) this.data.events = this.data.events.slice(-5000);
    this._save();
  }
}
