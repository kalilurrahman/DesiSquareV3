// Hard product rule #3: model entries are immutable once written.
//   - duplicate POST with an identical payload = idempotent no-op (existing entry back)
//   - any attempt to modify (changed values, update/delete verbs) = 409
import { test } from 'node:test';
import assert from 'node:assert';
import { boot, api } from './helpers.js';

const entry = { instrument: 'NVDA', side: 'BUY', weightPct: 10, declaredAt: '2025-03-03T14:30:00Z' };

test('entry immutability: duplicate = no-op, edit = 409, no update/delete surface', async () => {
  const app = await boot();
  try {
    const m = await api(app.base, 'POST', '/models', { id: 'model-x', ownerUserId: 'test_maven', name: 'Test Model' });
    assert.strictEqual(m.code, 201);

    const first = await api(app.base, 'POST', '/models/model-x/entries', entry);
    assert.strictEqual(first.code, 201);
    assert.strictEqual(first.body.status, 'declared');
    assert.ok(first.body.entry.refPrice > 0, 'refPrice derived from price data');

    // identical payload again → idempotent no-op returning the SAME entry
    const dup = await api(app.base, 'POST', '/models/model-x/entries', entry);
    assert.strictEqual(dup.code, 200);
    assert.strictEqual(dup.body.status, 'exists');
    assert.strictEqual(dup.body.entry.id, first.body.entry.id);
    assert.strictEqual(app.store.entriesFor('model-x').length, 1, 'no second entry written');

    // same natural key, different weight → an edit attempt → 409
    const edit = await api(app.base, 'POST', '/models/model-x/entries', { ...entry, weightPct: 12 });
    assert.strictEqual(edit.code, 409);
    assert.strictEqual(edit.body.status, 'immutable');

    // reusing a written entry id → 409
    const idClash = await api(app.base, 'POST', '/models/model-x/entries', { ...entry, id: first.body.entry.id, declaredAt: '2025-05-05', weightPct: 5 });
    assert.strictEqual(idClash.code, 409);

    // no update/delete endpoints — the verbs themselves are rejected with 409
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const r1 = await api(app.base, method, '/models/model-x/entries');
      assert.strictEqual(r1.code, 409, `${method} collection`);
      const r2 = await api(app.base, method, `/models/model-x/entries/${first.body.entry.id}`, { weightPct: 99 });
      assert.strictEqual(r2.code, 409, `${method} item`);
    }
    // POSTing at a specific entry id is an edit attempt too
    const postAtId = await api(app.base, 'POST', `/models/model-x/entries/${first.body.entry.id}`, { weightPct: 99 });
    assert.strictEqual(postAtId.code, 409);

    // a correction is a NEW entry (different declaredAt) — allowed
    const correction = await api(app.base, 'POST', '/models/model-x/entries', { ...entry, side: 'SELL', weightPct: 4, declaredAt: '2025-06-02' });
    assert.strictEqual(correction.code, 201);
    assert.strictEqual(app.store.entriesFor('model-x').length, 2);

    // still exactly one signal-free untouched ledger read
    const ledger = await api(app.base, 'GET', '/models/model-x/entries');
    assert.strictEqual(ledger.body.count, 2);
  } finally { await app.close(); }
});

test('entries validate instrument against price data', async () => {
  const app = await boot();
  try {
    await api(app.base, 'POST', '/models', { id: 'model-y', ownerUserId: 'test_maven', name: 'Y' });
    const bad = await api(app.base, 'POST', '/models/model-y/entries', { ...entry, instrument: 'NOTREAL' });
    assert.strictEqual(bad.code, 422);
    assert.strictEqual(bad.body.status, 'unknown_instrument');
    const badSide = await api(app.base, 'POST', '/models/model-y/entries', { ...entry, side: 'SHORT' });
    assert.strictEqual(badSide.code, 400);
    const badWeight = await api(app.base, 'POST', '/models/model-y/entries', { ...entry, weightPct: 150 });
    assert.strictEqual(badWeight.code, 400);
  } finally { await app.close(); }
});

test('signal stamps have no update/delete surface either', async () => {
  const app = await boot({ seed: true });
  try {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const r = await api(app.base, method, '/users/nikhil_cfa/signals');
      assert.strictEqual(r.code, 409, method);
    }
  } finally { await app.close(); }
});
