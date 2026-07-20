// Monthly / Yearly / Overall percent-return breakdown (`periods`).
// Product rule: performance is percent-only, never currency. The equity series
// is already indexed to 100 at inception, so every number in `periods` is a
// percent by construction — these tests pin the math AND assert no currency /
// E.164 string can ever leak through the block.
import { test } from 'node:test';
import assert from 'node:assert';
import { boot, api } from './helpers.js';
import { PriceBook } from '../src/prices.js';
import { computeMetrics, computePeriods } from '../src/metrics.js';

const r2 = (x) => Math.round(x * 100) / 100;

test('overall.pct = last series equity − 100; annualizedPct = cagr', async () => {
  const app = await boot({ seed: true });
  try {
    const { code, body } = await api(app.base, 'GET', '/models/model-steady-compounder/metrics');
    assert.strictEqual(code, 200);
    assert.ok(body.periods, 'periods present in the response');
    const lastEquity = body.series.at(-1).equity;
    assert.strictEqual(body.periods.overall.pct, r2(lastEquity - 100), 'overall.pct = last equity − 100');
    assert.strictEqual(body.periods.overall.annualizedPct, body.cagr, 'annualizedPct = cagr');
    assert.strictEqual(body.periods.overall.sinceLabel, body.since, 'sinceLabel = since');
    assert.ok(Number.isFinite(body.periods.overall.pct));
  } finally { await app.close(); }
});

test('yearly: one entry per calendar year in the series, chronological, each pct finite', async () => {
  const app = await boot({ seed: true });
  try {
    const { body } = await api(app.base, 'GET', '/models/model-steady-compounder/metrics');
    const years = body.periods.yearly;
    // one per distinct calendar year covered by the series
    const distinct = [...new Set(body.series.map((p) => Number(p.date.slice(0, 4))))].sort((a, b) => a - b);
    assert.deepStrictEqual(years.map((y) => y.year), distinct, 'one entry per calendar year');
    for (let i = 1; i < years.length; i++) assert.ok(years[i].year > years[i - 1].year, 'chronological');
    for (const y of years) assert.ok(Number.isFinite(y.pct), `year ${y.year} pct finite`);
  } finally { await app.close(); }
});

test('monthly: at most 12 entries, chronological, each pct finite', async () => {
  const app = await boot({ seed: true });
  try {
    const { body } = await api(app.base, 'GET', '/models/model-steady-compounder/metrics');
    const months = body.periods.monthly;
    assert.ok(months.length > 0 && months.length <= 12, `1..12 months, got ${months.length}`);
    for (const m of months) {
      assert.match(m.ym, /^\d{4}-\d{2}$/, 'ym is YYYY-MM');
      assert.ok(Number.isFinite(m.pct), `month ${m.ym} pct finite`);
    }
    for (let i = 1; i < months.length; i++) assert.ok(months[i].ym > months[i - 1].ym, 'chronological');
  } finally { await app.close(); }
});

test('empty model → periods with null overall.pct and empty arrays', async () => {
  const app = await boot();
  try {
    const created = await api(app.base, 'POST', '/models', { id: 'model-empty', ownerUserId: 'test_maven', name: 'Empty' });
    assert.strictEqual(created.code, 201);
    const { code, body } = await api(app.base, 'GET', '/models/model-empty/metrics');
    assert.strictEqual(code, 200);
    assert.deepStrictEqual(body.periods, {
      overall: { pct: null, annualizedPct: null, sinceLabel: null },
      yearly: [],
      monthly: [],
    });
  } finally { await app.close(); }
});

test('no-currency guard: nothing dollar/rupee/pound/E.164-shaped leaks through metrics', async () => {
  const app = await boot({ seed: true });
  try {
    for (const id of ['model-steady-compounder', 'model-dividend-ladder', 'model-momentum-sleeve']) {
      const { body } = await api(app.base, 'GET', `/models/${id}/metrics`);
      const text = JSON.stringify(body);
      assert.ok(!/\$\s?\d/.test(text), `$-amount leaked in ${id}`);
      assert.ok(!/[₹£]\s?\d/.test(text), `₹/£-amount leaked in ${id}`);
      assert.ok(!/\+\d{10,}/.test(text), `E.164-like string leaked in ${id}`);
    }
  } finally { await app.close(); }
});

// Deterministic unit test of the contiguous, no-gap chaining across a
// year AND a month boundary. A buy-and-hold that climbs 100→110→121→121 must
// split as: 2024 = +10% (inception→110), 2025 = +10% (110→121, NOT its own
// first point 121), overall = +21%.
test('contiguous chaining: a period starts from the PREVIOUS period’s last point', () => {
  const book = new PriceBook({
    dates: ['2024-12-30', '2024-12-31', '2025-01-02', '2025-06-30'],
    closes: { INST: [100, 110, 121, 121], SPY: [100, 100, 100, 100] },
  });
  const entries = [{ instrument: 'INST', side: 'BUY', weightPct: 100, declaredAt: '2024-12-30' }];
  const m = computeMetrics({ id: 'm-chain' }, entries, book, 'SPY');

  assert.deepStrictEqual(m.series.map((p) => p.equity), [100, 110, 121, 121]);
  assert.strictEqual(m.periods.overall.pct, 21, 'overall = last equity − 100');
  assert.deepStrictEqual(m.periods.yearly, [{ year: 2024, pct: 10 }, { year: 2025, pct: 10 }]);
  assert.deepStrictEqual(m.periods.monthly, [
    { ym: '2024-12', pct: 10 },
    { ym: '2025-01', pct: 10 },
    { ym: '2025-06', pct: 0 },
  ]);
});

// Direct unit call: empty series → the fully-null block.
test('computePeriods([]) → null overall + empty arrays', () => {
  assert.deepStrictEqual(computePeriods([], null, null), {
    overall: { pct: null, annualizedPct: null, sinceLabel: null },
    yearly: [],
    monthly: [],
  });
});

// last-12 window: a series spanning >12 months keeps only the last 12, still
// chained (the 12th-from-last month starts from its true prior-month close).
test('monthly keeps only the last 12 calendar months, chronological', () => {
  const dates = [];
  const closes = [];
  // 15 monthly points, +1% compounding each step → 14 month-over-month returns.
  let px = 100;
  for (let y = 2025, mo = 1, k = 0; k < 15; k++) {
    dates.push(`${y}-${String(mo).padStart(2, '0')}-15`);
    closes.push(r2(px));
    px *= 1.01;
    if (++mo > 12) { mo = 1; y++; }
  }
  const book = new PriceBook({ dates, closes: { INST: closes, SPY: closes.map(() => 100) } });
  const entries = [{ instrument: 'INST', side: 'BUY', weightPct: 100, declaredAt: dates[0] }];
  const m = computeMetrics({ id: 'm-12' }, entries, book, 'SPY');
  assert.strictEqual(m.periods.monthly.length, 12, 'capped at 12');
  for (let i = 1; i < m.periods.monthly.length; i++) {
    assert.ok(m.periods.monthly[i].ym > m.periods.monthly[i - 1].ym, 'chronological');
  }
  // last shown month is the series' final month
  assert.strictEqual(m.periods.monthly.at(-1).ym, dates.at(-1).slice(0, 7));
});
