import { test } from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { Ghostfolio } from '../src/ghostfolio.js';
import { provision, portfolioSummary, mintSsoLink, verifySso, ssoRedirect } from '../src/provisioner.js';

const config = { mode: 'mock', publicUrl: 'http://prov', ghostfolio: { url: 'http://gf', adminToken: '', lang: 'en' }, sso: { secret: 'test-secret', ttl: 120 } };
function fresh() { return new Store(path.join(os.tmpdir(), `gf-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)); }
const gf = new Ghostfolio(config, () => {});
const deps = (store) => ({ store, ghostfolio: gf, config, log() {} });

test('provision creates an account, then is idempotent by userId', async () => {
  const store = fresh();
  const u = { userId: 42, username: 'rohit', email: 'rohit@example.com', emailVerified: true };
  const a = await provision(u, deps(store));
  const b = await provision(u, deps(store));
  assert.strictEqual(a.status, 'provisioned');
  assert.strictEqual(b.status, 'already_linked');
  assert.strictEqual(a.accountId, b.accountId);
  assert.strictEqual(store.count(), 1);
});

test('unverified email is skipped', async () => {
  const store = fresh();
  const r = await provision({ userId: 1, username: 'x', email: 'x@e.com', emailVerified: false }, deps(store));
  assert.strictEqual(r.status, 'skipped_unverified');
  assert.strictEqual(store.count(), 0);
});

test('same email under a new userId links to the existing account', async () => {
  const store = fresh();
  const a = await provision({ userId: 1, username: 'a', email: 'shared@e.com', emailVerified: true }, deps(store));
  const b = await provision({ userId: 2, username: 'b', email: 'shared@e.com', emailVerified: true }, deps(store));
  assert.strictEqual(b.status, 'linked_existing');
  assert.strictEqual(b.accountId, a.accountId);
});

test('portfolio summary returns value + allocation after provisioning', async () => {
  const store = fresh();
  await provision({ userId: 7, username: 'meera', email: 'm@e.com', emailVerified: true }, deps(store));
  const s = await portfolioSummary(7, deps(store));
  assert.strictEqual(s.status, 'ok');
  assert.ok(typeof s.value === 'number');
  assert.ok(Array.isArray(s.allocation) && s.allocation.length === 4);
});

test('summary for an unprovisioned user reports not_provisioned', async () => {
  const s = await portfolioSummary(999, deps(fresh()));
  assert.strictEqual(s.status, 'not_provisioned');
});

test('SSO link mints and verifies; tampering fails', async () => {
  const store = fresh();
  await provision({ userId: 5, username: 'z', email: 'z@e.com', emailVerified: true }, deps(store));
  const link = mintSsoLink(5, { store, config });
  assert.ok(link.url.startsWith('http://prov/sso/click?sso='));
  const token = new URL(link.url).searchParams.get('sso');
  assert.strictEqual(verifySso(token, config).valid, true);
  const tampered = (token[0] === 'A' ? 'B' : 'A') + token.slice(1); // flip first char -> different bytes
  assert.strictEqual(verifySso(tampered, config).valid, false);
  assert.strictEqual(verifySso(token, { ...config, sso: { ...config.sso, secret: 'other' } }).valid, false);
});

test('ssoRedirect exchanges a valid token for a Ghostfolio auth-callback URL', async () => {
  const store = fresh();
  await provision({ userId: 5, username: 'z', email: 'z@e.com', emailVerified: true }, deps(store));
  const { token } = mintSsoLink(5, { store, config });
  const r = await ssoRedirect(token, deps(store));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.username, 'z');
  assert.ok(r.redirectTo.startsWith('http://gf/en/auth/'), r.redirectTo);
});

test('ssoRedirect rejects expired, tampered, and unknown tokens', async () => {
  const store = fresh();
  await provision({ userId: 6, username: 'q', email: 'q@e.com', emailVerified: true }, deps(store));
  const { token } = mintSsoLink(6, { store, config });
  // expired
  const expiredCfg = { ...config, sso: { ...config.sso, ttl: -10 } };
  const { token: expiredTok } = mintSsoLink(6, { store, config: expiredCfg });
  assert.strictEqual((await ssoRedirect(expiredTok, deps(store))).reason, 'expired');
  // tampered
  const tampered = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
  assert.strictEqual((await ssoRedirect(tampered, deps(store))).ok, false);
  // valid token but no such account in a fresh store
  assert.strictEqual((await ssoRedirect(token, deps(fresh()))).reason, 'not_provisioned');
  // missing
  assert.strictEqual((await ssoRedirect('', deps(store))).reason, 'missing_token');
});

test('DS-075: summary is private-by-default for public viewers; opt-in exposes it', async () => {
  const store = fresh();
  await provision({ userId: 9, username: 'maya', email: 'maya@e.com', emailVerified: true }, deps(store));
  const priv = await portfolioSummary(9, { ...deps(store), viewer: 'public' });
  assert.strictEqual(priv.status, 'private');
  assert.strictEqual(priv.value, undefined); // no portfolio data leaks
  store.setVisibility(9, true);
  const pub = await portfolioSummary(9, { ...deps(store), viewer: 'public' });
  assert.strictEqual(pub.status, 'ok');
  assert.ok(typeof pub.value === 'number');
});

test('DS-075: owner view is unaffected by the privacy flag; visibility survives re-link', async () => {
  const store = fresh();
  await provision({ userId: 10, username: 'dev', email: 'dev@e.com', emailVerified: true }, deps(store));
  const owner = await portfolioSummary(10, { ...deps(store), viewer: 'owner' });
  assert.strictEqual(owner.status, 'ok');
  assert.strictEqual(owner.publicSummary, false);
  store.setVisibility(10, true);
  await provision({ userId: 10, username: 'dev', email: 'dev@e.com', emailVerified: true }, deps(store)); // already_linked path
  assert.strictEqual(store.getByUserId(10).publicSummary, true);
  assert.strictEqual(store.setVisibility(999, true), null);
});
