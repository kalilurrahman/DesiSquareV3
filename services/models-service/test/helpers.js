// Test harness: boots the real HTTP app on an ephemeral port against a
// throwaway data dir + the committed deterministic price fixture.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../src/store.js';
import { loadPriceBook } from '../src/prices.js';
import { loadSeeds } from '../src/seed.js';
import { createApp } from '../src/app.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'prices.json');
export const SEED_FILE = path.join(ROOT, 'seed', 'models.seed.json');

export async function boot({ seed = false, secret = '' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'models-svc-test-'));
  const config = {
    port: 0,
    pricesMode: 'fixture',
    pricesFixture: FIXTURE,
    pricesApi: { url: '', key: '' },
    benchmark: 'SPY',
    discourse: { url: 'http://localhost:8080' },
    webhookSecret: secret,
    repriceIntervalMinutes: 0,
    paths: { state: path.join(dir, 'state.json'), seed: SEED_FILE },
  };
  const prices = {
    book: await loadPriceBook(config),
    async reload() { this.book = await loadPriceBook(config); return this.book; },
  };
  const store = new Store(config.paths.state);
  if (seed) loadSeeds(store, prices.book, config.paths.seed);
  const server = createApp({ config, store, prices });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, server, store, prices, config,
    close: () => new Promise((r) => server.close(r)),
  };
}

export async function api(base, method, pathname, body, headers = {}) {
  const r = await fetch(base + pathname, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  return { code: r.status, body: await r.json() };
}
