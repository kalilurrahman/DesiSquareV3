// Deterministic performance computation from the declared-entry ledger.
//   - Daily equity series: entry weights × close prices; the un-allocated
//     remainder is cash idling at 0%. Day-over-day return uses the weights in
//     force at the PREVIOUS close (an entry earns from the next bar onward).
//   - A missing bar (null close, e.g. an exchange holiday) is bridged by carrying
//     the last finite close forward: the gap day contributes 0, the full move is
//     realized on the next available bar — never silently dropped.
//   - CAGR annualized over the actual data window: first priced bar of the series
//     (dates[0], the bar on/after the first entry date) → last bar, calendar
//     days / 365.25. Windows under a year are NOT extrapolated — cagr then holds
//     the cumulative period return and `annualized` is false.
//   - vsBenchmark = model CAGR − benchmark CAGR over the same window (pct points).
//   - maxDrawdown = worst peak-to-trough of the equity series (negative %).
// Same inputs → identical outputs. No wall-clock, no randomness.
import { weightsOn } from './ledger.js';
import { datePart } from './prices.js';

const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;

// Empty periods block — no entries / empty series. Fresh object each call so
// callers can never share a mutable reference.
const emptyPeriods = () => ({
  overall: { pct: null, annualizedPct: null, sinceLabel: null },
  yearly: [],
  monthly: [],
});

// Contiguous, no-gap period returns derived straight from the daily equity
// series (already a percent index: equity is indexed to 100 at inception, so
// every number here is percent, never currency). Points are grouped by a
// calendar key (year "YYYY" or month "YYYY-MM"); each group's % return chains
// off the PREVIOUS group's last point (the first group uses its own first
// point — the series' inception value). Series is chronological, so the groups
// come out chronological too.
function groupReturns(series, keyOf) {
  const groups = [];
  const byKey = new Map();
  for (const p of series) {
    const k = keyOf(p.date);
    const g = byKey.get(k);
    if (g) { g.last = p.equity; }
    else { const ng = { key: k, first: p.equity, last: p.equity }; byKey.set(k, ng); groups.push(ng); }
  }
  return groups.map((g, i) => ({
    key: g.key,
    pct: r2(((g.last / (i > 0 ? groups[i - 1].last : g.first)) - 1) * 100),
  }));
}

// periods: cumulative-since-inception + per-calendar-year + last-12-months, all
// percent-only. Derived from the equity series; never introduces a currency field.
export function computePeriods(series, annualizedPct, since) {
  if (!series.length) return emptyPeriods();
  const yearly = groupReturns(series, (d) => d.slice(0, 4)).map((g) => ({ year: Number(g.key), pct: g.pct }));
  const monthly = groupReturns(series, (d) => d.slice(0, 7)).map((g) => ({ ym: g.key, pct: g.pct })).slice(-12);
  return {
    overall: { pct: r2(series[series.length - 1].equity - 100), annualizedPct, sinceLabel: since },
    yearly,
    monthly,
  };
}

export function computeMetrics(model, entries, book, benchmark) {
  const empty = {
    modelId: model.id, benchmark, since: null,
    cagr: null, annualized: null, vsBenchmark: null, maxDrawdown: null, series: [], periods: emptyPeriods(),
  };
  if (!entries.length) return empty;

  const sorted = entries.slice().sort((a, b) => String(a.declaredAt).localeCompare(String(b.declaredAt)));
  const since = datePart(sorted[0].declaredAt);
  const startIdx = book.indexOnOrAfter(since);
  if (startIdx < 0) return { ...empty, since };

  const dates = book.dates.slice(startIdx);
  const benchSeries = book.closes[benchmark] ? book.closes[benchmark].slice(startIdx) : null;

  let equity = 100;
  let peak = 100;
  let maxDrawdown = 0;
  const series = [{
    date: dates[0], equity: 100,
    ...(benchSeries ? { benchmark: 100 } : {}),
  }];

  // Last finite close per instrument, carried forward across missing bars so a
  // gap (null close) never swallows the return that spans it. Primed with the
  // most recent finite close on/before the series start.
  const instruments = [...new Set(sorted.map((e) => e.instrument))];
  const lastKnown = {};
  for (const instrument of instruments) {
    for (let j = startIdx; j >= 0; j--) {
      const c = book.closeAt(instrument, j);
      if (Number.isFinite(c) && c > 0) { lastKnown[instrument] = c; break; }
    }
  }

  for (let i = 1; i < dates.length; i++) {
    const weights = weightsOn(sorted, dates[i - 1]); // yesterday's declared allocation
    let dayReturn = 0;
    for (const [instrument, w] of Object.entries(weights)) {
      if (w <= 0) continue;
      const prev = lastKnown[instrument]; // last finite close ≤ previous bar
      const curr = book.closeAt(instrument, startIdx + i);
      if (Number.isFinite(prev) && prev > 0 && Number.isFinite(curr) && curr > 0) {
        dayReturn += (w / 100) * (curr / prev - 1);
      }
    }
    // Advance the carry-forward for EVERY tracked instrument (weighted or not),
    // so zero-weight stretches don't leak the move they sat out.
    for (const instrument of instruments) {
      const c = book.closeAt(instrument, startIdx + i);
      if (Number.isFinite(c) && c > 0) lastKnown[instrument] = c;
    }
    equity *= 1 + dayReturn;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, (equity / peak - 1) * 100);
    series.push({
      date: dates[i], equity: r4(equity),
      ...(benchSeries ? { benchmark: r4((benchSeries[i] / benchSeries[0]) * 100) } : {}),
    });
  }

  // Annualize over the window the series actually covers: dates[0] (first priced
  // bar on/after the first entry) → last bar. Anchoring to the raw declaredAt
  // would divide a real return by phantom years whenever it predates the data.
  const days = Math.max(1, (new Date(`${dates[dates.length - 1]}T00:00:00Z`) - new Date(`${dates[0]}T00:00:00Z`)) / 86400000);
  const years = days / 365.25;
  const annualized = years >= 1; // sub-year windows report the raw period return
  const grow = (g) => (annualized ? Math.pow(g, 1 / years) - 1 : g - 1) * 100;
  const cagr = grow(equity / 100);
  let vsBenchmark = null;
  if (benchSeries && benchSeries[0] > 0) {
    vsBenchmark = r2(cagr - grow(benchSeries[benchSeries.length - 1] / benchSeries[0]));
  }

  const cagrR = r2(cagr);
  return {
    modelId: model.id,
    benchmark,
    since,
    cagr: cagrR,
    annualized,
    vsBenchmark,
    maxDrawdown: r2(maxDrawdown),
    series,
    periods: computePeriods(series, cagrR, since),
  };
}

// Card-sized summary (no series, no per-period breakdown) for directory/list surfaces.
export function metricsSummary(model, entries, book, benchmark) {
  const { series, periods, ...rest } = computeMetrics(model, entries, book, benchmark);
  return rest;
}
