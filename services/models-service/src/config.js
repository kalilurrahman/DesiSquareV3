// Config + minimal .env loader (no dotenv dependency) — same shape as ai-service.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv(path.join(ROOT, '.env'));

export const ROOT_DIR = ROOT;
export const config = {
  port: Number(process.env.PORT) || 8791,
  // fixture (default, offline-deterministic) | live (PRICES_API_URL feed)
  pricesMode: process.env.PRICES_MODE === 'live' ? 'live' : 'fixture',
  pricesFixture: path.resolve(ROOT, process.env.PRICES_FIXTURE || './test/fixtures/prices.json'),
  pricesApi: { url: (process.env.PRICES_API_URL || '').replace(/\/$/, ''), key: process.env.PRICES_API_KEY || '' },
  benchmark: (process.env.BENCHMARK || 'SPY').toUpperCase(),
  discourse: { url: (process.env.DISCOURSE_URL || 'http://localhost:8080').replace(/\/$/, '') },
  webhookSecret: process.env.DISCOURSE_WEBHOOK_SECRET || '',
  // 0 = off; >0 runs the reprice job (POST /jobs/reprice equivalent) on a timer
  repriceIntervalMinutes: Number(process.env.REPRICE_INTERVAL_MINUTES) || 0,
  paths: {
    state: path.join(ROOT, 'data', 'state.json'),
    seed: path.join(ROOT, 'seed', 'models.seed.json'),
  },
};
