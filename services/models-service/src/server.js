// DesiSquare models-service — the trust layer's ledger (MAV-S02/MAV-S03/FED-S04).
// Tracks maven investment models + signal records from declared, timestamped
// entries/exits and computes performance (CAGR, vs benchmark, max drawdown)
// from EOD prices. Zero dependencies — Node stdlib only. Port 8791.
import { config } from './config.js';
import { Store } from './store.js';
import { loadPriceBook } from './prices.js';
import { loadSeeds } from './seed.js';
import { createApp, repriceAll } from './app.js';

const prices = {
  book: await loadPriceBook(config),
  async reload() { this.book = await loadPriceBook(config); return this.book; },
};
const store = new Store(config.paths.state);

// First-boot demo seeds (prototype mavens/models) — idempotent, skipped once populated.
const seeded = loadSeeds(store, prices.book, config.paths.seed);
if (seeded.status === 'seeded') {
  console.log(`  seeded ${seeded.models} models · ${seeded.entries} entries · ${seeded.signals} signals`);
}

const server = createApp({ config, store, prices });
server.listen(config.port, () => {
  const book = prices.book;
  console.log(`DesiSquare models-service on http://localhost:${config.port}  [prices: ${config.pricesMode} · ${book.instruments().length} instruments → ${book.lastDate()} · benchmark ${config.benchmark}]`);
  if (!config.webhookSecret) console.log('  ⚠ DISCOURSE_WEBHOOK_SECRET unset — webhook signature verification is DISABLED (dev only).');
});

// Optional daily-batch timer (unref'd so tests/short runs exit cleanly).
if (config.repriceIntervalMinutes > 0) {
  setInterval(async () => {
    try {
      await prices.reload();
      const r = repriceAll({ store, prices, config });
      console.log(`  reprice timer: ${r.models.length} models recomputed → last bar ${r.lastBar}`);
    } catch (e) {
      console.error(`  reprice timer failed: ${e.message}`);
    }
  }, config.repriceIntervalMinutes * 60_000).unref();
}

export { server, store, prices };
