// Hard product rule #3: metrics recompute must match ±0.1%. This test rebuilds
// every seeded model's equity series INDEPENDENTLY (straight from the fixture
// JSON + seed JSON, no service code) and compares against GET /models/:id/metrics.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { boot, api, FIXTURE, SEED_FILE } from './helpers.js';

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const BENCH = 'SPY';
const day = (s) => String(s).slice(0, 10);

// Independent recompute of the spec's computation rules.
function recompute(seedModel) {
  const entries = seedModel.entries.slice().sort((a, b) => day(a.declaredAt).localeCompare(day(b.declaredAt)));
  const since = day(entries[0].declaredAt);
  const start = fixture.dates.findIndex((d) => d >= since);
  const dates = fixture.dates.slice(start);
  const bench = fixture.closes[BENCH].slice(start);

  const weightsOn = (d) => {
    const w = {};
    for (const e of entries) {
      if (day(e.declaredAt) > d) continue;
      w[e.instrument] = (w[e.instrument] || 0) + (e.side === 'SELL' ? -e.weightPct : e.weightPct);
    }
    for (const k of Object.keys(w)) w[k] = Math.max(0, w[k]);
    return w;
  };

  let equity = 100, peak = 100, maxDrawdown = 0;
  for (let i = 1; i < dates.length; i++) {
    const w = weightsOn(dates[i - 1]);
    let r = 0;
    for (const [inst, pct] of Object.entries(w)) {
      if (pct <= 0) continue;
      const prev = fixture.closes[inst][start + i - 1];
      const curr = fixture.closes[inst][start + i];
      r += (pct / 100) * (curr / prev - 1);
    }
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, (equity / peak - 1) * 100);
  }

  const days = (new Date(`${dates[dates.length - 1]}T00:00:00Z`) - new Date(`${since}T00:00:00Z`)) / 86400000;
  const years = days / 365.25;
  const cagr = (Math.pow(equity / 100, 1 / years) - 1) * 100;
  const benchCagr = (Math.pow(bench[bench.length - 1] / bench[0], 1 / years) - 1) * 100;
  return { since, cagr, vsBenchmark: cagr - benchCagr, maxDrawdown, finalEquity: equity, points: dates.length };
}

test('seeded model metrics match an independent fixture recompute to ±0.1%', async () => {
  const app = await boot({ seed: true });
  try {
    for (const seedModel of seed.models) {
      const expected = recompute(seedModel);
      const { code, body } = await api(app.base, 'GET', `/models/${seedModel.id}/metrics`);
      assert.strictEqual(code, 200, seedModel.id);
      assert.strictEqual(body.since, expected.since, `${seedModel.id} since`);
      assert.strictEqual(body.benchmark, BENCH);
      assert.ok(Math.abs(body.cagr - expected.cagr) <= 0.1, `${seedModel.id} cagr ${body.cagr} vs ${expected.cagr}`);
      assert.ok(Math.abs(body.vsBenchmark - expected.vsBenchmark) <= 0.1, `${seedModel.id} vsBenchmark ${body.vsBenchmark} vs ${expected.vsBenchmark}`);
      assert.ok(Math.abs(body.maxDrawdown - expected.maxDrawdown) <= 0.1, `${seedModel.id} maxDD ${body.maxDrawdown} vs ${expected.maxDrawdown}`);
      assert.strictEqual(body.series.length, expected.points, `${seedModel.id} series length`);
      assert.strictEqual(body.series[0].equity, 100);
      assert.ok(Math.abs(body.series.at(-1).equity - expected.finalEquity) <= expected.finalEquity * 0.001, `${seedModel.id} final equity`);
      assert.ok(body.disclaimer.includes('Not investment advice'), 'persistent disclaimer');
    }
  } finally { await app.close(); }
});

test('acceptance: seeded Steady Compounder exists with computable CAGR / vs-SPY / max-DD', async () => {
  const app = await boot({ seed: true });
  try {
    const { code, body } = await api(app.base, 'GET', '/models/model-steady-compounder/metrics');
    assert.strictEqual(code, 200);
    assert.strictEqual(body.name, 'Steady Compounder');
    assert.strictEqual(body.since, '2025-01-06');
    assert.ok(Number.isFinite(body.cagr) && body.cagr > 0);
    assert.ok(Number.isFinite(body.vsBenchmark));
    assert.ok(Number.isFinite(body.maxDrawdown) && body.maxDrawdown <= 0);
    assert.ok(Array.isArray(body.series) && body.series.length > 300);
    assert.ok('benchmark' in body.series[0], 'series carries the benchmark for sparklines');
  } finally { await app.close(); }
});

test('metrics are deterministic: same inputs → identical outputs (also across reprice)', async () => {
  const app = await boot({ seed: true });
  try {
    const a = await api(app.base, 'GET', '/models/model-momentum-sleeve/metrics');
    const r = await api(app.base, 'POST', '/jobs/reprice');
    assert.strictEqual(r.code, 200);
    assert.strictEqual(r.body.status, 'repriced');
    assert.strictEqual(r.body.models.length, 3);
    const b = await api(app.base, 'GET', '/models/model-momentum-sleeve/metrics');
    assert.deepStrictEqual(a.body, b.body);
  } finally { await app.close(); }
});
