/**
 * gf-stats leak-sweep — the mechanical form of constraint #8.
 * Zero dependencies. Run:  node leak-sweep.test.mjs
 *
 * Enforces, on (a) the golden example and (b) live serializer output from a
 * POISONED Ghostfolio-shaped fixture:
 *   1. key allowlist (structural whitelist — unknown keys fail)
 *   2. numeric leaves are percents / month-counts only
 *   3. forbidden key vocabulary (currency-carrying names, incl. Ghostfolio's own)
 *   4. forbidden value patterns (currency symbols, ISO codes, value-shaped numbers)
 *   5. no PII (emails, E.164 phone numbers — the #5 sweep, run here too)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toMavenStats } from "./serializer.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const fail = (msg) => { failures++; console.error("  ✗ " + msg); };
const ok = (msg) => console.log("  ✓ " + msg);

/* ---------------- 1+2. structural whitelist ---------------- */
/* path patterns → allowed. `#` matches an array index. */
const ALLOW = [
  "schema_version", "pseudonym",
  "verified.source", "verified.linked_since", "verified.last_verified_at", "verified.refresh",
  "track_record.start", "track_record.months", "track_record.sufficient_history", "track_record.min_months_required",
  "returns.monthly.#.month", "returns.monthly.#.pct",
  "returns.kpis.ytd_pct", "returns.kpis.one_year_pct", "returns.kpis.two_year_annualised_pct",
  "returns.kpis.max_drawdown_pct", "returns.kpis.profitable_months_pct",
  "benchmark.id", "benchmark.label", "benchmark.monthly.#.month", "benchmark.monthly.#.pct",
  "risk.band", "risk.method", "risk.stdev_monthly_pct",
  "allocation.#.label", "allocation.#.pct",
  "top_positions.#.symbol", "top_positions.#.name", "top_positions.#.weight_pct", "top_positions.#.return_pct",
];
const NUMERIC_LEAF = /(^|\.)(pct|[a-z_]*_pct|months|min_months_required)$/;

function walk(node, path, leaves) {
  if (Array.isArray(node)) node.forEach((v) => walk(v, path + ".#", leaves));
  else if (node !== null && typeof node === "object")
    for (const [k, v] of Object.entries(node)) walk(v, path ? path + "." + k : k, leaves);
  else leaves.push([path, node]);
}

function checkStructure(payload, label) {
  const leaves = [];
  walk(payload, "", leaves);
  for (const [path, value] of leaves) {
    if (!ALLOW.includes(path)) fail(`${label}: key not in allowlist: ${path}`);
    if (typeof value === "number" && !NUMERIC_LEAF.test(path))
      fail(`${label}: numeric leaf outside percent/month vocabulary: ${path} = ${value}`);
  }
}

/* ---------------- 3. forbidden key vocabulary ---------------- */
const FORBIDDEN_KEYS =
  /^(value|amount|balance|quantity|qty|units|shares|cost|fee|price|currency|netWorth|net_worth|invested|investment|cash|dividend|marketPrice|marketValue|grossPerformance|netPerformance|currentValue|valueInBaseCurrency)$/i;

function checkKeys(node, label, path = "") {
  if (Array.isArray(node)) node.forEach((v) => checkKeys(v, label, path + ".#"));
  else if (node !== null && typeof node === "object")
    for (const [k, v] of Object.entries(node)) {
      if (FORBIDDEN_KEYS.test(k)) fail(`${label}: forbidden key "${k}" at ${path || "root"}`);
      checkKeys(v, label, path ? path + "." + k : k);
    }
}

/* ---------------- 4+5. forbidden value patterns ---------------- */
const PATTERNS = [
  [/[$₹€£]\s?\d/, "currency symbol followed by digits"],
  [/"(USD|INR|EUR|GBP|CAD|AUD|SGD|AED)"/, "ISO currency code as a value"],
  [/\d{1,3}(,\d{3})+/, "thousand-separated (value-shaped) number"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, "email address"],
  [/\+\d{10,15}/, "E.164 phone number (#5)"],
];
function checkPatterns(payload, label) {
  const json = JSON.stringify(payload);
  for (const [re, what] of PATTERNS)
    if (re.test(json)) fail(`${label}: forbidden pattern — ${what}: …${json.match(re)[0]}…`);
}

function sweep(payload, label) {
  checkStructure(payload, label);
  checkKeys(payload, label);
  checkPatterns(payload, label);
}

/* ================= (a) golden example ================= */
console.log("leak-sweep · golden example-response.json");
const golden = JSON.parse(readFileSync(join(here, "example-response.json"), "utf8"));
sweep(golden, "golden");
if (!failures) ok("golden example is %-only clean");

/* ================= (b) poisoned upstream → serializer ================= */
console.log("leak-sweep · serializer output from POISONED Ghostfolio fixture");
const poisoned = {
  monthlyPerformance: [
    { date: "2025-08", netPerformanceInPercentage: 0.27, netPerformance: 312.44, currentValue: 118_220.19, currency: "USD" },
    { date: "2025-09", netPerformanceInPercentage: 16.12, netPerformance: 19_020.11, currentValue: 137_240.3, currency: "USD" },
    { date: "2025-10", netPerformanceInPercentage: 3.1, netPerformance: 4_254.45, currentValue: 141_494.75, currency: "USD" },
    { date: "2025-11", netPerformanceInPercentage: -0.48, netPerformance: -679.17, currentValue: 140_815.58, currency: "USD" },
    { date: "2025-12", netPerformanceInPercentage: 2.05, netPerformance: 2_886.72, currentValue: 143_702.3, currency: "USD" },
    { date: "2026-01", netPerformanceInPercentage: 0.52, netPerformance: 747.25, currentValue: 144_449.55, currency: "USD" },
    { date: "2026-02", netPerformanceInPercentage: 3.51, netPerformance: 5_070.18, currentValue: 149_519.73, currency: "USD" },
  ],
  holdings: [
    { symbol: "VTI", name: "Vanguard Total Market", allocationInPercentage: 0.221, netPerformancePercent: 0.112, quantity: 112.4, marketValue: 33_043.86, currency: "USD", owner: "nikhil@example.com" },
    { symbol: "NVDA", name: "NVIDIA", allocationInPercentage: 0.098, netPerformancePercent: 0.324, quantity: 84, marketValue: 14_652.9, currency: "USD" },
  ],
  allocations: [
    { label: "US Equity", allocationInPercentage: 0.58, valueInBaseCurrency: 86_721.31 },
    { label: "Cash", allocationInPercentage: 0.08, valueInBaseCurrency: 11_961.58 },
  ],
  accountPhone: "+14085551234",
};
const out = toMavenStats(poisoned, {
  pseudonym: "nikhil_cfa",
  linkedSince: "2026-01-12",
  lastVerifiedAt: "2026-07-18T22:00:00Z",
  benchmark: { id: "SP500TR", label: "S&P 500 TR", monthly: [{ month: "2025-08", pct: 1.91 }] },
});
const before = failures;
sweep(out, "serializer");
/* prove the specific poison markers are gone */
const json = JSON.stringify(out);
for (const marker of ["currentValue", "marketValue", "quantity", "USD", "118220", "nikhil@example.com", "+1408"])
  if (json.includes(marker)) fail(`serializer: poison marker survived: ${marker}`);
if (failures === before) ok("poisoned values, quantities, currency codes, email & phone all stripped");

/* early-history behaviour sanity: 7 months ⇒ sufficient, 1y KPI null */
if (out.track_record.months !== 7) fail("expected 7-month track record from fixture");
if (out.returns.kpis.one_year_pct !== null) fail("one_year_pct must be null under 12 months");
if (failures === before) ok("KPI window rules honoured (one_year_pct null under 12 months)");

console.log(failures ? `\nFAIL — ${failures} violation(s)` : "\nPASS — constraint #8 holds");
process.exit(failures ? 1 : 0);
