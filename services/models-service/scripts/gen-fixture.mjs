// Deterministic EOD price fixture generator (seeded PRNG — NO Math.random).
//   node scripts/gen-fixture.mjs            → writes test/fixtures/prices.json
//
// 12 tickers (incl. the SPY benchmark) × ~18 months of weekday close bars.
// Daily wiggles come from a mulberry32 PRNG seeded per ticker (identical JSON on
// every run/machine); each ticker's drift is then solved analytically so the path
// lands EXACTLY on a target cumulative return per segment. That keeps the fixture
// deterministic AND makes the seeded demo models read like the hi-fi prototype
// (Steady Compounder beats SPY, Dividend Ladder trails it, Momentum Sleeve rides
// SMCI up and exits before its trend break). The committed fixture is the demo's
// market: metrics and signal sincePct are reproducible offline (PRICES_MODE=fixture).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'fixtures', 'prices.json');

const SEED = 'desisquare-models-v1';
const START = '2025-01-01'; // fixture window: ~18 months of weekday EOD bars
const END = '2026-07-10';

// Per ticker: start price, annualized vol, and cumulative-return targets from the
// window start (`ret` by segment end date; null until = window end). Fully synthetic.
const TICKERS = {
  SPY: { start: 480, vol: 0.13, segments: [{ until: null, ret: 0.16 }] },
  VTI: { start: 240, vol: 0.135, segments: [{ until: null, ret: 0.17 }] },
  NVDA: { start: 135, vol: 0.46, segments: [{ until: null, ret: 0.7 }] },
  MSFT: { start: 410, vol: 0.2, segments: [{ until: null, ret: 0.26 }] },
  'BRK.B': { start: 450, vol: 0.14, segments: [{ until: null, ret: 0.21 }] },
  AVGO: { start: 160, vol: 0.38, segments: [{ until: null, ret: 0.58 }] },
  // SMCI: strong momentum ride, then a hard trend break in June 2026.
  SMCI: { start: 32, vol: 0.7, segments: [{ until: '2026-05-29', ret: 0.45 }, { until: null, ret: -0.15 }] },
  AAPL: { start: 250, vol: 0.22, segments: [{ until: null, ret: 0.2 }] },
  JNJ: { start: 148, vol: 0.12, segments: [{ until: null, ret: 0.12 }] },
  KO: { start: 62, vol: 0.11, segments: [{ until: null, ret: 0.09 }] },
  PG: { start: 165, vol: 0.11, segments: [{ until: null, ret: 0.11 }] },
  INFY: { start: 22, vol: 0.24, segments: [{ until: null, ret: 0.15 }] },
};

// FNV-1a string hash → 32-bit seed.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 — tiny deterministic PRNG.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller standard normal from two uniforms.
function gaussian(rand) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Weekday (Mon–Fri) ISO dates, inclusive. UTC throughout — no TZ drift.
function weekdays(start, end) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (d <= stop) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const dates = weekdays(START, END);
const dt = 1 / 252; // trading-day fraction of a year
const closes = {};

for (const [ticker, p] of Object.entries(TICKERS)) {
  const rand = mulberry32(fnv1a(`${SEED}:${ticker}`));
  const z = Array.from({ length: dates.length - 1 }, () => gaussian(rand));

  // Segment boundaries → per-step log-drift solved so each segment endpoint hits
  // its target cumulative return exactly:  Σ steps (m·dt) + vol·√dt·Σz = targetLog.
  const stepDrift = new Array(z.length);
  let segStart = 0; // first step index of the current segment
  let prevCumLog = 0;
  for (const seg of p.segments) {
    const lastDateIdx = seg.until ? dates.filter((d) => d <= seg.until).length - 1 : dates.length - 1;
    const segEnd = lastDateIdx - 1; // inclusive step index (step i moves date i → i+1)
    const n = segEnd - segStart + 1;
    const zSum = z.slice(segStart, segEnd + 1).reduce((a, b) => a + b, 0);
    const targetLog = Math.log(1 + seg.ret) - prevCumLog;
    const m = (targetLog - p.vol * Math.sqrt(dt) * zSum) / (n * dt);
    for (let i = segStart; i <= segEnd; i++) stepDrift[i] = m;
    prevCumLog = Math.log(1 + seg.ret);
    segStart = segEnd + 1;
  }

  const series = [p.start];
  let logPrice = Math.log(p.start);
  for (let i = 0; i < z.length; i++) {
    logPrice += stepDrift[i] * dt + p.vol * Math.sqrt(dt) * z[i];
    series.push(Math.max(Math.round(Math.exp(logPrice) * 100) / 100, 0.01));
  }
  closes[ticker] = series;
}

const fixture = {
  note: 'Synthetic EOD closes generated by scripts/gen-fixture.mjs (seeded PRNG). Do not hand-edit — regenerate.',
  seed: SEED,
  start: START,
  end: END,
  tickers: Object.keys(TICKERS).length,
  bars: dates.length,
  dates,
  closes,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(fixture));
console.log(`wrote ${path.relative(ROOT, OUT)} — ${fixture.tickers} tickers × ${fixture.bars} weekday bars (${START} → ${END})`);
for (const [t, arr] of Object.entries(closes)) {
  console.log(`  ${t.padEnd(6)} ${arr[0]} → ${arr[arr.length - 1]}  (${(((arr[arr.length - 1] / arr[0]) - 1) * 100).toFixed(1)}%)`);
}
