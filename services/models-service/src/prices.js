// Price data access. PriceBar { instrument, date, close } is the logical unit
// (1:1 with a Postgres table when promoted); the fixture stores them columnar
// ({ dates[], closes{ticker:[]} }) purely to keep the committed JSON small.
import fs from 'node:fs';

export function datePart(when) {
  return String(when).slice(0, 10);
}

export class PriceBook {
  constructor({ dates = [], closes = {} } = {}) {
    this.dates = dates; // sorted ISO yyyy-mm-dd strings (lexicographic == chronological)
    this.closes = closes; // { TICKER: number[] aligned with dates }
  }
  instruments() { return Object.keys(this.closes); }
  has(instrument) { return Array.isArray(this.closes[String(instrument).toUpperCase()]); }
  barCount() { return this.dates.length * this.instruments().length; }
  firstDate() { return this.dates[0] || null; }
  lastDate() { return this.dates[this.dates.length - 1] || null; }

  // Index of the last trading date <= the given date (-1 if before all data).
  indexOnOrBefore(when) {
    const d = datePart(when);
    let lo = 0, hi = this.dates.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.dates[mid] <= d) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  }
  // Index of the first trading date >= the given date (-1 if after all data).
  indexOnOrAfter(when) {
    const d = datePart(when);
    let lo = 0, hi = this.dates.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.dates[mid] >= d) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
    }
    return ans;
  }
  closeAt(instrument, index) {
    const series = this.closes[String(instrument).toUpperCase()];
    return series ? series[index] ?? null : null;
  }
  // Close on the last trading day on/before `when` (a signal's refPrice, an entry's refPrice).
  closeOn(instrument, when) {
    const i = this.indexOnOrBefore(when);
    return i < 0 ? null : this.closeAt(instrument, i);
  }
  latest(instrument) {
    return this.closeAt(instrument, this.dates.length - 1);
  }
}

// Load the book per PRICES_MODE. Fixture = committed deterministic JSON;
// live = an EOD feed returning the same { dates, closes } shape (config-only switch).
export async function loadPriceBook(config) {
  if (config.pricesMode === 'live') {
    if (!config.pricesApi.url) throw new Error('PRICES_MODE=live requires PRICES_API_URL');
    const headers = { Accept: 'application/json' };
    if (config.pricesApi.key) headers.Authorization = `Bearer ${config.pricesApi.key}`;
    const r = await fetch(config.pricesApi.url, { headers });
    if (!r.ok) throw new Error(`price feed ${r.status}`);
    return new PriceBook(await r.json());
  }
  return new PriceBook(JSON.parse(fs.readFileSync(config.pricesFixture, 'utf8')));
}
