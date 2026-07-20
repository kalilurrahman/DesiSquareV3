// Demo seeds — 3 maven pseudonyms + the 3 models from the hi-fi prototype
// (Steady Compounder, Dividend Ladder, Momentum Sleeve) + signal history.
// Loaded on first boot ONLY when the store is empty; safe to call repeatedly.
import fs from 'node:fs';
import { createModel, declareEntry, stampSignal } from './ledger.js';

export function loadSeeds(store, book, seedFile) {
  if (!store.isEmpty()) return { status: 'skipped_not_empty', ...store.counts() };
  if (!fs.existsSync(seedFile)) return { status: 'skipped_no_seed_file', seedFile };

  const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  let models = 0, entries = 0, signals = 0;

  for (const m of seed.models || []) {
    const { entries: seedEntries = [], ...modelBody } = m;
    const created = createModel(store, modelBody);
    if (created.status === 'created') models++;
    for (const e of seedEntries) {
      const r = declareEntry(store, book, created.model.id, e);
      if (r.status === 'declared') entries++;
      else if (r.status !== 'exists') console.warn(`  seed entry skipped (${r.status}): ${created.model.id} ${e.side} ${e.instrument} — ${r.error || ''}`);
    }
  }
  for (const s of seed.signals || []) {
    const r = stampSignal(store, book, s);
    if (r.status === 'stamped') signals++;
    else if (r.status !== 'duplicate_ignored') console.warn(`  seed signal skipped (${r.status}): post ${s.postId} — ${r.error || ''}`);
  }
  return { status: 'seeded', models, entries, signals };
}
