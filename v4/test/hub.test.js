// EP-03 Services & Products Hub (Phase 5 · DS-201..DS-206) — constraint-enforcing tests.
// Verifies the Hub honours #4/#8 (percent-only, no $), #5 (no phone/email), #7-A (booking is
// member-only), and #9 (never ordered by returns).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client } from './helpers.mjs';

const CURRENCY = /[$₹£]\s?\d/;        // a currency amount — must never appear on a public surface
const E164 = /\+\d[\d ()-]{6,}\d/;    // a phone-like +NNNN run (timestamps have no leading +)

test('hub directory is public, identity-safe and percent-only (#4/#5/#8)', async () => {
  const s = await startServer();
  try {
    const anon = client(s.base);
    const { status, body } = await anon('GET', '/api/hub');
    assert.equal(status, 200, 'directory is public (like the teaser)');
    assert.ok(Array.isArray(body.experts) && body.experts.length >= 1, 'has experts');
    assert.ok(Array.isArray(body.services) && body.services.length >= 1, 'has services');
    assert.ok(Array.isArray(body.guides) && body.guides.length >= 1, 'has guides');

    const blob = JSON.stringify(body);
    assert.ok(!CURRENCY.test(blob), 'no currency amount anywhere on the hub');
    assert.ok(!E164.test(blob), 'no phone-like number on the hub');
    assert.ok(!blob.includes('@'), 'no email address on the hub');

    for (const e of body.experts) {
      assert.equal(e.verified, true, 'hub lists verified experts only');
      assert.ok(!('email' in e) && !('phone' in e), 'expert card carries no PII');
      assert.ok(e.trackRecordPct === null || typeof e.trackRecordPct === 'number',
        'track record is a percent or null — never a dollar value');
    }
    for (const svc of body.services) {
      assert.ok(['Complimentary', 'Member', 'Premium'].includes(svc.priceTier),
        'service price is a qualitative tier word, never a currency amount');
    }
  } finally { s.stop(); }
});

test('hub experts are ordered by name, never by % returns (#9)', async () => {
  const s = await startServer();
  try {
    const { body } = await client(s.base)('GET', '/api/hub');
    const names = body.experts.map((e) => e.name);
    const byName = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, byName, 'directory ranks by name — recognition never uses returns/money');
  } finally { s.stop(); }
});

test('booking a service is member-only; anonymous callers 401 (#7-A)', async () => {
  const s = await startServer();
  try {
    const anon = client(s.base);
    const svc = (await anon('GET', '/api/hub')).body.services[0];

    const denied = await anon('POST', '/api/hub/bookings', { serviceId: svc.id });
    assert.equal(denied.status, 401, 'anonymous booking is rejected');

    const denied2 = await anon('GET', '/api/hub/bookings');
    assert.equal(denied2.status, 401, 'anonymous cannot list bookings');

    const member = client(s.base);
    const login = await member('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
    assert.equal(login.status, 200, 'demo member signs in');

    const booked = await member('POST', '/api/hub/bookings', {
      serviceId: svc.id,
      note: 'please reach me on +1 415 555 0100', // a phone in the note...
    });
    assert.equal(booked.status, 201, 'member can book');
    assert.ok(booked.body.booking.id, 'booking has an id');
    assert.ok(!('note' in booked.body.booking), '...never echoed back (#5)');

    const mine = await member('GET', '/api/hub/bookings');
    assert.equal(mine.status, 200);
    assert.equal(mine.body.bookings.length, 1, 'the booking is listed for its owner');
    assert.ok(!JSON.stringify(mine.body).match(E164), 'no phone number leaks via the bookings list (#5)');
  } finally { s.stop(); }
});

test('booking an unknown service is rejected', async () => {
  const s = await startServer();
  try {
    const member = client(s.base);
    await member('POST', '/api/session', { mode: 'demo', userId: 'quiet_lotus' });
    const bad = await member('POST', '/api/hub/bookings', { serviceId: 'does_not_exist' });
    assert.equal(bad.status, 400, 'unknown service id is a 400');
  } finally { s.stop(); }
});

test('canonical guide resolves by slug and stays $-free', async () => {
  const s = await startServer();
  try {
    const anon = client(s.base);
    const guides = (await anon('GET', '/api/hub')).body.guides;
    assert.ok(guides.length >= 1);
    const g = await anon('GET', `/api/hub/guides/${guides[0].slug}`);
    assert.equal(g.status, 200);
    assert.ok(g.body.title && g.body.body, 'guide detail has title + body');
    assert.ok(!CURRENCY.test(JSON.stringify(g.body)), 'guide detail carries no currency amount');

    const missing = await anon('GET', '/api/hub/guides/no-such-slug');
    assert.equal(missing.status, 404);
  } finally { s.stop(); }
});
