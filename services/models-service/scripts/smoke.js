// Smoke: boot the real server on an ephemeral port against a throwaway data dir,
// hit /health + the seeded Steady Compounder metrics, exit 0/1.
//   node scripts/smoke.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';
import { Store } from '../src/store.js';
import { loadPriceBook } from '../src/prices.js';
import { loadSeeds } from '../src/seed.js';
import { createApp } from '../src/app.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'models-smoke-'));
const smokeConfig = {
  ...config,
  pricesMode: 'fixture',
  pricesFixture: path.join(ROOT, 'test', 'fixtures', 'prices.json'),
  webhookSecret: '',
  paths: { state: path.join(tmp, 'state.json'), seed: path.join(ROOT, 'seed', 'models.seed.json') },
};

let failed = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
};

const prices = { book: await loadPriceBook(smokeConfig), async reload() { this.book = await loadPriceBook(smokeConfig); return this.book; } };
const store = new Store(smokeConfig.paths.state);
const seeded = loadSeeds(store, prices.book, smokeConfig.paths.seed);
const server = createApp({ config: smokeConfig, store, prices });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
console.log(`models-service smoke on ${base} (seeded: ${seeded.status})`);

try {
  const health = await (await fetch(`${base}/health`)).json();
  check('GET /health ok', health.ok === true && health.service === 'models-service', `models=${health.models} signals=${health.signals} lastBar=${health.lastBar}`);
  check('price fixture loaded (>=10 tickers incl. SPY)', health.instruments >= 10 && health.benchmark === 'SPY');

  const metrics = await (await fetch(`${base}/models/model-steady-compounder/metrics`)).json();
  check(
    'GET /models/model-steady-compounder/metrics computes CAGR / vs-SPY / max-DD',
    Number.isFinite(metrics.cagr) && Number.isFinite(metrics.vsBenchmark) && Number.isFinite(metrics.maxDrawdown) && metrics.series.length > 300,
    `since=${metrics.since} cagr=${metrics.cagr}% vsSPY=${metrics.vsBenchmark} maxDD=${metrics.maxDrawdown}%`,
  );
  check('metrics carry the not-investment-advice disclaimer', String(metrics.disclaimer || '').includes('Not investment advice'));

  const signals = await (await fetch(`${base}/users/nikhil_cfa/signals`)).json();
  check('GET /users/nikhil_cfa/signals returns stamped rows with sincePct', signals.count === 4 && signals.signals.every((s) => s.sincePct !== undefined));
} catch (e) {
  check('smoke run', false, e.message);
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failed ? 'SMOKE FAILED' : 'SMOKE OK');
process.exit(failed ? 1 : 0);
