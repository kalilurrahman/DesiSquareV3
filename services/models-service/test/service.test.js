// Service surface: health, model CRUD (create/read only — no mutation), user
// views, seeds idempotency, and the reprice job.
import { test } from 'node:test';
import assert from 'node:assert';
import { boot, api } from './helpers.js';
import { loadSeeds } from '../src/seed.js';

test('health reports service, price coverage and counts', async () => {
  const app = await boot({ seed: true });
  try {
    const { code, body } = await api(app.base, 'GET', '/health');
    assert.strictEqual(code, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.service, 'models-service');
    assert.strictEqual(body.mode, 'fixture');
    assert.strictEqual(body.benchmark, 'SPY');
    assert.strictEqual(body.models, 3);
    assert.ok(body.entries >= 14);
    assert.strictEqual(body.signals, 7);
    assert.ok(body.instruments >= 10, '>=10 tickers incl. SPY');
    assert.ok(body.lastBar >= '2026-07-01');
  } finally { await app.close(); }
});

test('seeds load once and only when the store is empty (idempotent)', async () => {
  const app = await boot({ seed: true });
  try {
    const again = loadSeeds(app.store, app.prices.book, app.config.paths.seed);
    assert.strictEqual(again.status, 'skipped_not_empty');
    assert.strictEqual(app.store.counts().models, 3);
    assert.strictEqual(app.store.counts().signals, 7);
  } finally { await app.close(); }
});

test('POST /models + GET /models/:id + GET /users/:id/models', async () => {
  const app = await boot({ seed: true });
  try {
    const created = await api(app.base, 'POST', '/models', { ownerUserId: 'priya_taxes', name: 'Tax-Lot Harvester', strategy: 'Loss-harvest overlay', risk: 'Low' });
    assert.strictEqual(created.code, 201);
    assert.strictEqual(created.body.model.id, 'model-tax-lot-harvester');

    // idempotent re-create; different owner for same id = conflict
    const dup = await api(app.base, 'POST', '/models', { ownerUserId: 'priya_taxes', name: 'Tax-Lot Harvester' });
    assert.strictEqual(dup.code, 200);
    const clash = await api(app.base, 'POST', '/models', { id: 'model-tax-lot-harvester', ownerUserId: 'someone_else', name: 'Tax-Lot Harvester' });
    assert.strictEqual(clash.code, 409);
    const invalid = await api(app.base, 'POST', '/models', { name: 'No Owner' });
    assert.strictEqual(invalid.code, 400);

    const model = await api(app.base, 'GET', '/models/model-steady-compounder');
    assert.strictEqual(model.code, 200);
    assert.strictEqual(model.body.ownerUserId, 'nikhil_cfa');
    assert.strictEqual(model.body.followers, 412);
    assert.strictEqual(model.body.entryCount, 6);
    assert.strictEqual(model.body.entries.filter((e) => e.side === 'SELL').length, 1);

    const missing = await api(app.base, 'GET', '/models/nope');
    assert.strictEqual(missing.code, 404);

    const nikhil = await api(app.base, 'GET', '/users/nikhil_cfa/models');
    assert.strictEqual(nikhil.body.count, 2);
    assert.deepStrictEqual(nikhil.body.models.map((m) => m.name).sort(), ['Dividend Ladder', 'Steady Compounder']);
    for (const m of nikhil.body.models) {
      assert.ok(Number.isFinite(m.metrics.cagr), 'card metrics inline');
      assert.ok(!('series' in m.metrics), 'card metrics stay card-sized');
    }

    const arjun = await api(app.base, 'GET', '/users/arjun_quant/models');
    assert.strictEqual(arjun.body.count, 1);
    assert.strictEqual(arjun.body.models[0].name, 'Momentum Sleeve');
  } finally { await app.close(); }
});

test('root lists endpoints; unknown path 404s; no phone-shaped strings anywhere', async () => {
  const app = await boot({ seed: true });
  try {
    const root = await api(app.base, 'GET', '/');
    assert.ok(root.body.endpoints.includes('POST /webhook/discourse'));
    const nope = await api(app.base, 'GET', '/nope');
    assert.strictEqual(nope.code, 404);

    // Hard product rule #1: nothing E.164-shaped may leave any API surface.
    for (const path of ['/health', '/models/model-steady-compounder', '/models/model-steady-compounder/metrics', '/users/nikhil_cfa/signals', '/users/nikhil_cfa/models']) {
      const r = await fetch(app.base + path);
      const text = await r.text();
      assert.ok(!/\+[1-9]\d{7,14}/.test(text), `E.164-like string leaked in ${path}`);
    }
  } finally { await app.close(); }
});
