// Signal record rows: sincePct = close-vs-refPrice since stampedAt,
// with the sign FLIPPED for SELL (judged as the avoided move).
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { boot, api, FIXTURE } from './helpers.js';

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

function webhookDelivery(post, eventId) {
  const raw = JSON.stringify({ post });
  return [raw, {
    'x-discourse-event-type': 'post',
    'x-discourse-event-id': eventId,
    'x-discourse-event-signature': 'sha256=' + crypto.createHmac('sha256', 's').update(raw).digest('hex'),
  }];
}

test('sincePct flips sign for SELL: BUY and SELL of the same stamp are exact mirrors', async () => {
  const app = await boot({ secret: 's' });
  try {
    const stampedAt = '2025-06-02T15:00:00Z';
    for (const [postId, kind, user] of [[801, 'BUY', 'buyer_m'], [802, 'SELL', 'seller_m']]) {
      const [raw, headers] = webhookDelivery({
        id: postId, username: user, created_at: stampedAt,
        custom_fields: { signal_kind: kind, ticker: 'MSFT' },
      }, `evt-${postId}`);
      const r = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
      assert.strictEqual(r.code, 201);
    }

    // expected raw move straight from the fixture: last close ≤ stampedAt → latest close
    const refIdx = fixture.dates.filter((d) => d <= '2025-06-02').length - 1;
    const ref = fixture.closes.MSFT[refIdx];
    const latest = fixture.closes.MSFT[fixture.closes.MSFT.length - 1];
    const raw = ((latest / ref) - 1) * 100;
    assert.ok(Math.abs(raw) > 0.5, 'fixture must have actually moved for this test to mean anything');

    const buy = (await api(app.base, 'GET', '/users/buyer_m/signals')).body.signals[0];
    const sell = (await api(app.base, 'GET', '/users/seller_m/signals')).body.signals[0];
    assert.strictEqual(buy.refPrice, ref);
    assert.strictEqual(sell.refPrice, ref);
    assert.ok(Math.abs(buy.sincePct - raw) < 0.01, `BUY sincePct ${buy.sincePct} ≈ raw move ${raw}`);
    assert.ok(Math.abs(sell.sincePct + raw) < 0.01, `SELL sincePct ${sell.sincePct} ≈ −raw move`);
    assert.strictEqual(buy.sincePct, -sell.sincePct, 'exact mirror');
    assert.ok(Math.sign(buy.sincePct) === Math.sign(raw) && Math.sign(sell.sincePct) === -Math.sign(raw));
  } finally { await app.close(); }
});

test('seeded maven signal records: rows, ordering, avoided-fall SELL, instrument-less UPDATE', async () => {
  const app = await boot({ seed: true });
  try {
    const nikhil = (await api(app.base, 'GET', '/users/nikhil_cfa/signals')).body;
    assert.strictEqual(nikhil.count, 4);
    assert.ok(nikhil.disclaimer.includes('Not investment advice'));
    // newest first
    const stamps = nikhil.signals.map((s) => s.stampedAt);
    assert.deepStrictEqual(stamps, [...stamps].sort().reverse());
    for (const s of nikhil.signals) {
      assert.ok(Number.isFinite(s.sincePct), `${s.kind} ${s.instrument} has computed sincePct`);
      assert.ok(s.refPrice > 0);
    }

    // Arjun's SMCI exit: SMCI kept falling after the SELL stamp in the fixture,
    // so the avoided move judges the call POSITIVE.
    const arjun = (await api(app.base, 'GET', '/users/arjun_quant/signals')).body;
    const smciSell = arjun.signals.find((s) => s.instrument === 'SMCI');
    assert.strictEqual(smciSell.kind, 'SELL');
    const refIdx = fixture.dates.filter((d) => d <= '2026-06-12').length - 1;
    const rawMove = ((fixture.closes.SMCI.at(-1) / fixture.closes.SMCI[refIdx]) - 1) * 100;
    assert.ok(rawMove < 0, 'fixture: SMCI fell after the exit');
    assert.ok(smciSell.sincePct > 0, 'SELL before a fall scores positive');

    // Priya's UPDATE has no instrument → no performance number (rendered as —)
    const priya = (await api(app.base, 'GET', '/users/priya_taxes/signals')).body;
    assert.strictEqual(priya.count, 1);
    assert.strictEqual(priya.signals[0].kind, 'UPDATE');
    assert.strictEqual(priya.signals[0].sincePct, null);
    assert.strictEqual(priya.signals[0].refPrice, null);
  } finally { await app.close(); }
});
