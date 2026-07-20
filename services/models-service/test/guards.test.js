// Regression guards for the review findings on the ledger/metrics math:
//   - aggregate long weight can never exceed 100% (cash idles at 0%, never negative)
//   - dates must be strict ISO-8601 (datePart's 10-char slice must stay chronological)
//   - declaredAt must sit inside price coverage — a body refPrice can't bypass it
//   - missing bars are bridged (carry-forward), not silently dropped
//   - sub-year windows report the raw period return, never an extrapolated CAGR
//   - webhook event ids are deduped only on terminal outcomes (failures stay retryable)
//   - a stamp dated after the last bar is pending (null), not a spurious 0%
import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { boot, api } from './helpers.js';
import { PriceBook } from '../src/prices.js';
import { computeMetrics } from '../src/metrics.js';

const SECRET = 'guard-secret';
function delivery(post, eventId) {
  const raw = JSON.stringify({ post });
  return [raw, {
    'x-discourse-event-type': 'post',
    'x-discourse-event-id': eventId,
    'x-discourse-event-signature': 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex'),
  }];
}

test('aggregate weight is capped at 100% — over-allocation rejected, dup re-POST still a no-op', async () => {
  const app = await boot();
  try {
    await api(app.base, 'POST', '/models', { id: 'model-cap', ownerUserId: 'test_maven', name: 'Cap' });
    const full = { instrument: 'NVDA', side: 'BUY', weightPct: 100, declaredAt: '2025-03-03' };
    assert.strictEqual((await api(app.base, 'POST', '/models/model-cap/entries', full)).code, 201);

    // second BUY on top of a fully-invested book → 422, no phantom leverage
    const over = await api(app.base, 'POST', '/models/model-cap/entries', { instrument: 'SMCI', side: 'BUY', weightPct: 100, declaredAt: '2025-03-03' });
    assert.strictEqual(over.code, 422);
    assert.strictEqual(over.body.status, 'over_allocated');
    const tiny = await api(app.base, 'POST', '/models/model-cap/entries', { instrument: 'SMCI', side: 'BUY', weightPct: 1, declaredAt: '2025-04-01' });
    assert.strictEqual(tiny.code, 422, 'even 1% over the cap is rejected');

    // identical duplicate of the written entry is STILL the idempotent no-op
    const dup = await api(app.base, 'POST', '/models/model-cap/entries', full);
    assert.strictEqual(dup.code, 200);
    assert.strictEqual(dup.body.status, 'exists');

    // freeing weight makes room again; a backdated BUY that would breach a LATER date is caught
    assert.strictEqual((await api(app.base, 'POST', '/models/model-cap/entries', { instrument: 'NVDA', side: 'SELL', weightPct: 50, declaredAt: '2025-06-02' })).code, 201);
    assert.strictEqual((await api(app.base, 'POST', '/models/model-cap/entries', { instrument: 'SMCI', side: 'BUY', weightPct: 50, declaredAt: '2025-06-03' })).code, 201);
    const backdated = await api(app.base, 'POST', '/models/model-cap/entries', { instrument: 'AAPL', side: 'BUY', weightPct: 60, declaredAt: '2025-01-06' });
    assert.strictEqual(backdated.code, 422, 'backdated BUY breaching a later date is rejected');
  } finally { await app.close(); }
});

test('non-ISO dates are rejected on write — declaredAt and stampedAt', async () => {
  const app = await boot({ secret: SECRET });
  try {
    await api(app.base, 'POST', '/models', { id: 'model-iso', ownerUserId: 'test_maven', name: 'Iso' });
    const us = await api(app.base, 'POST', '/models/model-iso/entries', { instrument: 'AAPL', side: 'BUY', weightPct: 50, declaredAt: '07/08/2026', refPrice: 200 });
    assert.strictEqual(us.code, 400, 'US-format declaredAt rejected');
    assert.match(us.body.error, /ISO-8601/);

    const [raw, headers] = delivery({ id: 7101, username: 'iso_maven', created_at: '07/08/2026', custom_fields: { signal_kind: 'BUY', ticker: 'AAPL' } }, 'evt-iso-1');
    const sig = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(sig.code, 400, 'US-format stampedAt rejected');
    assert.strictEqual(app.store.counts().signals, 0);
  } finally { await app.close(); }
});

test('declaredAt outside price coverage is rejected — an explicit refPrice cannot bypass it', async () => {
  const app = await boot();
  try {
    await api(app.base, 'POST', '/models', { id: 'model-cov', ownerUserId: 'test_maven', name: 'Cov' });
    const early = await api(app.base, 'POST', '/models/model-cov/entries', { instrument: 'NVDA', side: 'BUY', weightPct: 100, declaredAt: '2020-01-02', refPrice: 24.5 });
    assert.strictEqual(early.code, 422);
    assert.match(early.body.error, /predates price coverage/);
    const metrics = await api(app.base, 'GET', '/models/model-cov/metrics');
    assert.strictEqual(metrics.body.cagr, null, 'no phantom multi-year window ever exists');
  } finally { await app.close(); }
});

test('a missing bar is bridged by carry-forward — the move across the gap is not dropped', () => {
  const book = new PriceBook({
    dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-06'],
    closes: { INFY: [100, 100, null, 120], SPY: [100, 100, 100, 100] },
  });
  const entries = [{ instrument: 'INFY', side: 'BUY', weightPct: 100, declaredAt: '2025-01-01' }];
  const m = computeMetrics({ id: 'm-gap' }, entries, book, 'SPY');
  assert.strictEqual(m.series.at(-1).equity, 120, 'buy-and-hold through the gap realizes the full +20%');
  assert.strictEqual(m.series[2].equity, 100, 'the gap day itself contributes 0');
});

test('sub-year windows are not annualized — cagr holds the raw period return', () => {
  const book = new PriceBook({
    dates: ['2026-07-08', '2026-07-09', '2026-07-10'],
    closes: { NVDA: [100, 99, 110], SPY: [100, 100, 105] },
  });
  const entries = [{ instrument: 'NVDA', side: 'BUY', weightPct: 100, declaredAt: '2026-07-08' }];
  const m = computeMetrics({ id: 'm-young' }, entries, book, 'SPY');
  assert.strictEqual(m.annualized, false);
  assert.strictEqual(m.cagr, 10, 'a 2-day +10% is reported as +10%, not raised to the power of 180');
  assert.strictEqual(m.vsBenchmark, 5);
});

test('failed webhook deliveries are NOT deduped — the same event id stays retryable', async () => {
  const app = await boot({ secret: SECRET });
  try {
    // unknown instrument → 422; the event id must not be swallowed
    const [raw, headers] = delivery({ id: 7201, username: 'retry_maven', created_at: '2026-06-01T15:00:00Z', custom_fields: { signal_kind: 'BUY', ticker: 'TSLA' } }, 'evt-retry-1');
    const first = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(first.code, 422);
    const redelivery = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(redelivery.code, 422, 'redelivery is re-processed, not duplicate_event_ignored');
    assert.notStrictEqual(redelivery.body.status, 'duplicate_event_ignored');

    // terminal outcomes DO dedupe (same event id → short-circuit)
    const [raw2, headers2] = delivery({ id: 7202, username: 'retry_maven', created_at: '2026-06-01T15:00:00Z', custom_fields: { signal_kind: 'BUY', ticker: 'NVDA' } }, 'evt-retry-2');
    assert.strictEqual((await api(app.base, 'POST', '/webhook/discourse', raw2, headers2)).code, 201);
    const dup = await api(app.base, 'POST', '/webhook/discourse', raw2, headers2);
    assert.strictEqual(dup.body.status, 'duplicate_event_ignored');
  } finally { await app.close(); }
});

test('a signal stamped after the last bar is pending (null), never a spurious 0%', async () => {
  const app = await boot({ secret: SECRET });
  try {
    const [raw, headers] = delivery({ id: 7301, username: 'future_maven', created_at: '2026-08-01T00:00:00Z', custom_fields: { signal_kind: 'BUY', ticker: 'NVDA' } }, 'evt-future-1');
    const r = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(r.code, 201);
    assert.strictEqual(r.body.signal.refPrice, null, 'not priced off the stale last bar');
    const rows = (await api(app.base, 'GET', '/users/future_maven/signals')).body.signals;
    assert.strictEqual(rows[0].sincePct, null, 'rendered as pending, not 0.00%');
    assert.strictEqual(rows[0].refPrice, null);
  } finally { await app.close(); }
});
