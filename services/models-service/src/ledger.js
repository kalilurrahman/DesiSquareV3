// The trust layer's ledger: maven models, immutable declared entries, immutable
// signal stamps. Nothing is self-reported — outcomes are computed from prices.
import crypto from 'node:crypto';
import { datePart } from './prices.js';

const SIDES = ['BUY', 'SELL'];
const KINDS = ['BUY', 'SELL', 'HOLD', 'UPDATE'];

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function shortHash(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
}
// Strict ISO-8601 (yyyy-mm-dd[Thh:mm[:ss[.sss]][Z|±hh:mm]]). The whole ledger relies on
// datePart()'s 10-char slice being chronological == lexicographic; a US-format string
// like '07/08/2026' parses via new Date() but would corrupt every date comparison, so
// only canonical ISO forms are accepted on write.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
function isIsoDate(s) {
  return typeof s === 'string' && ISO_DATE.test(s) && !Number.isNaN(new Date(s).getTime());
}

// ---- Models -----------------------------------------------------------------

export function createModel(store, body = {}) {
  const name = String(body.name || '').trim();
  const ownerUserId = body.ownerUserId != null ? String(body.ownerUserId) : '';
  if (!name || !ownerUserId) return { status: 'invalid', code: 400, error: 'name and ownerUserId are required' };
  const id = body.id || `model-${slug(name)}`;
  const existing = store.getModel(id);
  if (existing) {
    if (existing.name === name && String(existing.ownerUserId) === ownerUserId) {
      return { status: 'exists', code: 200, model: existing }; // idempotent re-create
    }
    return { status: 'conflict', code: 409, error: `model ${id} already exists with different owner/name` };
  }
  const model = {
    id,
    ownerUserId,
    name,
    strategy: String(body.strategy || ''),
    risk: String(body.risk || ''),
    createdAt: body.createdAt && isIsoDate(body.createdAt) ? body.createdAt : new Date().toISOString(),
    followers: Number(body.followers) || 0,
  };
  store.addModel(model);
  return { status: 'created', code: 201, model };
}

// ---- Model entries (immutable) ------------------------------------------------
// Corrections are NEW entries. A duplicate POST with an identical payload is an
// idempotent no-op returning the existing entry; any attempt to change a written
// entry (same natural key, different values — or same id, different fields) = 409.

export function declareEntry(store, book, modelId, body = {}) {
  const model = store.getModel(modelId);
  if (!model) return { status: 'not_found', code: 404, error: `model ${modelId} not found` };

  const instrument = String(body.instrument || '').trim().toUpperCase();
  const side = String(body.side || '').trim().toUpperCase();
  const weightPct = Number(body.weightPct);
  const declaredAt = body.declaredAt || new Date().toISOString();

  if (!instrument) return { status: 'invalid', code: 400, error: 'instrument is required' };
  if (!book.has(instrument)) {
    return { status: 'unknown_instrument', code: 422, error: `instrument ${instrument} has no price data (known: ${book.instruments().join(', ')})` };
  }
  if (!SIDES.includes(side)) return { status: 'invalid', code: 400, error: 'side must be BUY or SELL' };
  if (!Number.isFinite(weightPct) || weightPct <= 0 || weightPct > 100) {
    return { status: 'invalid', code: 400, error: 'weightPct must be a number in (0, 100]' };
  }
  if (!isIsoDate(declaredAt)) {
    return { status: 'invalid', code: 400, error: 'declaredAt must be an ISO-8601 date (yyyy-mm-dd or yyyy-mm-ddThh:mm:ssZ)' };
  }
  // Price coverage is a hard requirement — a body-supplied refPrice must not smuggle in
  // an entry that predates all price data (it would corrupt the CAGR window).
  if (book.indexOnOrBefore(declaredAt) < 0) {
    return { status: 'invalid', code: 422, error: `declaredAt ${datePart(declaredAt)} predates price coverage (first bar ${book.firstDate()})` };
  }

  const refPrice = body.refPrice != null ? Number(body.refPrice) : book.closeOn(instrument, declaredAt);
  if (!Number.isFinite(refPrice) || refPrice <= 0) {
    return { status: 'invalid', code: 422, error: `no reference price for ${instrument} on/before ${datePart(declaredAt)}` };
  }

  // Natural key: (modelId, instrument, side, declaredAt-date).
  const existing = store.entriesFor(modelId).find(
    (e) => e.instrument === instrument && e.side === side && datePart(e.declaredAt) === datePart(declaredAt),
  );
  if (existing) {
    const same = existing.weightPct === weightPct && (body.refPrice == null || Number(body.refPrice) === existing.refPrice);
    return same
      ? { status: 'exists', code: 200, entry: existing } // idempotent duplicate — no-op
      : { status: 'immutable', code: 409, error: 'entries are immutable once written — declare a new entry to correct' };
  }
  if (body.id) {
    const byId = store.getEntryById(body.id);
    if (byId) return { status: 'immutable', code: 409, error: `entry ${body.id} already written and is immutable` };
  }

  // Aggregate exposure is capped at 100%: cash idles at 0%, it never goes negative
  // (spec §computation rules). Check the post-entry gross long weight on the entry's
  // date and on every later declaration date it would affect.
  const proposed = [...store.entriesFor(modelId), { instrument, side, weightPct, declaredAt }];
  const fromDate = datePart(declaredAt);
  const checkDates = [...new Set(proposed.map((e) => datePart(e.declaredAt)).filter((d) => d >= fromDate))];
  for (const d of checkDates) {
    const gross = Object.values(rawWeightsOn(proposed, d)).reduce((s, x) => s + x, 0);
    if (gross > 100 + 1e-9) {
      return {
        status: 'over_allocated',
        code: 422,
        error: `declaring ${side} ${instrument} ${weightPct}% would take total invested weight to ${Math.round(gross * 100) / 100}% on ${d} — aggregate weight is capped at 100% (cash never goes negative)`,
      };
    }
  }

  const entry = {
    id: body.id || `e_${shortHash(`${modelId}|${instrument}|${side}|${datePart(declaredAt)}`)}`,
    modelId,
    instrument,
    side,
    weightPct,
    declaredAt,
    refPrice,
  };
  store.addEntry(entry);
  return { status: 'declared', code: 201, entry };
}

// Target weights per instrument as of a date: BUY adds weightPct, SELL removes it
// (floored at 0). The un-allocated remainder is cash idling at 0%.
function rawWeightsOn(entries, d) {
  const w = {};
  for (const e of entries) {
    if (datePart(e.declaredAt) > d) continue;
    w[e.instrument] = (w[e.instrument] || 0) + (e.side === 'SELL' ? -e.weightPct : e.weightPct);
  }
  for (const k of Object.keys(w)) w[k] = Math.max(0, w[k]);
  return w;
}
export function weightsOn(entries, when) {
  const w = rawWeightsOn(entries, datePart(when));
  // Defense in depth (declareEntry already rejects over-allocation): scale gross
  // exposure back to 100% so metrics can never model leverage that was never
  // declared — cash is floored at 0%, mirroring the per-instrument >=0 floor.
  const gross = Object.values(w).reduce((s, x) => s + x, 0);
  if (gross > 100) for (const k of Object.keys(w)) w[k] *= 100 / gross;
  return w;
}

// ---- Signals (immutable stamps, idempotent on postId) --------------------------

export function stampSignal(store, book, body = {}) {
  const postId = body.postId;
  if (postId == null || postId === '') return { status: 'invalid', code: 400, error: 'postId is required' };

  const existing = store.signalByPostId(postId);
  if (existing) return { status: 'duplicate_ignored', code: 200, signal: existing }; // stamps are immutable

  const kind = String(body.kind || '').trim().toUpperCase();
  const userId = body.userId != null ? String(body.userId) : '';
  const instrument = body.instrument ? String(body.instrument).trim().toUpperCase() : null;
  const stampedAt = body.stampedAt || new Date().toISOString();

  if (!KINDS.includes(kind)) return { status: 'invalid', code: 400, error: `kind must be one of ${KINDS.join('|')}` };
  if (!userId) return { status: 'invalid', code: 400, error: 'userId is required' };
  if (!isIsoDate(stampedAt)) {
    return { status: 'invalid', code: 400, error: 'stampedAt must be an ISO-8601 date (yyyy-mm-dd or yyyy-mm-ddThh:mm:ssZ)' };
  }
  if (['BUY', 'SELL'].includes(kind) && !instrument) {
    return { status: 'invalid', code: 400, error: `${kind} signals require an instrument` };
  }
  if (instrument && !book.has(instrument)) {
    return { status: 'unknown_instrument', code: 422, error: `instrument ${instrument} has no price data` };
  }

  // A stamp dated after the last available bar is NOT priced off that stale bar —
  // it is stored with refPrice: null (pending) instead of showing a spurious 0%.
  // The stamp is immutable, so signalRows derives the ref deterministically from
  // stampedAt once the reprice job has ingested a bar on/after it.
  const priced = instrument && book.lastDate() && datePart(stampedAt) <= book.lastDate();
  const signal = {
    id: `sig_${shortHash(String(postId))}`,
    userId,
    postId,
    kind,
    instrument,
    stampedAt,
    refPrice: priced ? book.closeOn(instrument, stampedAt) : null,
    ...(body.note ? { note: String(body.note) } : {}),
  };
  store.addSignal(signal);
  return { status: 'stamped', code: 201, signal };
}

// Signal-record rows for the profile table: performance since the stamp.
// sincePct = close-vs-refPrice since stampedAt; SELL is judged as the AVOIDED move,
// so its sign is flipped (price falls after a SELL → positive sincePct).
export function signalRows(store, book, userId) {
  const rows = store.signalsByUser(userId)
    .slice()
    .sort((a, b) => String(b.stampedAt).localeCompare(String(a.stampedAt)))
    .map((s) => {
      let sincePct = null;
      let latestClose = null;
      // The stamp itself is immutable: a signal stamped ahead of price coverage stores
      // refPrice: null (pending). Its ref is derived HERE — deterministically from the
      // immutable stampedAt — once the reprice job has ingested a bar on/after it;
      // until then the row stays pending (—) instead of showing a spurious 0%.
      let ref = Number.isFinite(s.refPrice) && s.refPrice > 0 ? s.refPrice : null;
      if (ref == null && s.instrument && book.lastDate() && datePart(s.stampedAt) <= book.lastDate()) {
        ref = book.closeOn(s.instrument, s.stampedAt);
      }
      if (s.instrument && Number.isFinite(ref) && ref > 0) {
        latestClose = book.latest(s.instrument);
        if (Number.isFinite(latestClose)) {
          const raw = ((latestClose / ref) - 1) * 100;
          sincePct = Math.round((s.kind === 'SELL' ? -raw : raw) * 100) / 100;
        }
      }
      return { ...s, refPrice: Number.isFinite(ref) && ref > 0 ? ref : s.refPrice ?? null, latestClose, sincePct };
    });
  return rows;
}
