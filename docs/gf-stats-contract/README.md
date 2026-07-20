# gf-stats — API contract v1.0

### The %-only maven-performance service (Script #3, beside `wa-bridge` and `gf-provisioner`)

> **Purpose:** serve verified, percentage-only performance for mavens who opted in, sourced from
> their linked Ghostfolio account — with **constraint #8** enforced at this boundary:
> *currency-typed fields never leave gf-stats. Percent, ratio, month-count and label fields only.*
>
> **Files in this package**
> - `README.md` — this contract
> - `example-response.json` — the golden example (validates against the whitelist)
> - `serializer.mjs` — reference whitelist serializer (`toMavenStats()`), the enforcement pattern
> - `leak-sweep.test.mjs` — zero-dependency test: run `node leak-sweep.test.mjs`

---

## 1. Topology & auth

```
Browser (Discourse theme component, W14/W13 renderers)
   │  same-origin via reverse proxy:  /gf-stats/api/…
   ▼
gf-stats (Node service, no public DNS of its own)
   │  1. member gate: forwards Discourse session cookie → GET /session/current.json (cached 60s)
   │     no session → 401  (consistent with the signed-out gate, #7)
   │  2. consent gate: Discourse user field `perf_sharing` for the pseudonym (cached with payload)
   │     consent OFF, or not a maven, or unknown pseudonym → 404 (indistinguishable by design)
   ▼
Ghostfolio API (server-side only, maven's scoped read token from gf-provisioner)
   — tokens never reach any browser; gf-stats is the only caller
```

## 2. Endpoints

| Method & path | Auth | Returns |
|---|---|---|
| `GET /api/mavens/:pseudonym/stats` | Discourse member session | `200` MavenStats JSON (below) · `401` no session · `404` no consent/not maven · `503` upstream unavailable **and** cache expired |
| `GET /healthz` | none | `200 {"ok":true}` — used by the Demo drawer (W11) wiring row |
| `POST /internal/cache/bust/:pseudonym` | internal network + admin token | `204` — forces refresh on next read (used when a maven toggles consent) |

**Caching:** per-maven payload cached **24 h** (the "updated daily" ribbon); served stale up to
**48 h** on Ghostfolio failure with `verified.last_verified_at` unchanged so the client renders the
staleness chip; beyond 48 h → `503` and the client renders the honest "temporarily unverified" state.
Consent toggles bust the cache immediately (Discourse webhook → `/internal/cache/bust`).

**No range parameters.** The service returns the full monthly series once; range windows (6M/YTD/1Y/2Y/Max)
are client-side derivations. One cacheable payload, no per-range traffic.

## 3. Response shape — MavenStats v1.0

See `example-response.json` for the golden instance. Shape summary:

```
schema_version      "1.0"
pseudonym           Discourse username (the only identity ever present — no emails, no phone, no real name)
verified            { source:"ghostfolio", linked_since:YYYY-MM-DD, last_verified_at:ISO8601, refresh:"daily" }
track_record        { start:"YYYY-MM", months:int, sufficient_history:bool, min_months_required:6 }
returns.monthly     [ { month:"YYYY-MM", pct:number } … ]          ← time-weighted return, % units
returns.kpis        { ytd_pct, one_year_pct|null, two_year_annualised_pct|null,
                      max_drawdown_pct, profitable_months_pct }     ← null when the window isn't fully covered
benchmark           { id, label, monthly:[{month,pct}…] }           ← corridor benchmark, same span
risk                { band:"Low"|"Medium"|"High", method:"stdev_monthly_returns", stdev_monthly_pct }
allocation          [ { label, pct } … ]                            ← sums to ~100
top_positions       [ { symbol, name, weight_pct, return_pct } … ]  ← max 10; NO quantities, NO values
```

### The whitelist rule (constraint #8), stated precisely

1. **Keys are allowlisted.** Any key not in the schema's allowlist is a contract violation — the
   serializer constructs output by explicit picks; it never spreads or passes through upstream objects.
2. **Every numeric leaf is a percent, a ratio band, or a month count.** Numeric keys must match
   `*_pct` or be `months` / `min_months_required`. There is no other legal numeric field.
3. **Forbidden key vocabulary** (case-insensitive, any depth):
   `value, amount, balance, quantity, qty, units, shares, cost, fee, price, currency, netWorth,
   net_worth, invested, investment, cash, dividend, marketPrice, marketValue, grossPerformance,
   netPerformance` *(the last four are Ghostfolio's currency-carrying field names — named explicitly
   so upstream API drift cannot reintroduce them silently)*.
4. **Forbidden value patterns** in the serialized payload: currency symbols followed by digits
   (`$ ₹ € £`), ISO currency codes as string values (`"USD"`, `"INR"`, …), and thousand-separated
   number strings (portfolio-value-shaped, e.g. `"128,400"`).
5. **No PII:** no emails, E.164 numbers (#5's sweep also runs here), or real names.

`leak-sweep.test.mjs` enforces 1–5 mechanically and must run in CI on: (a) the golden example,
(b) live serializer output from a **poisoned** Ghostfolio-shaped fixture (containing values,
quantities, balances, currency codes) — proving the serializer strips what upstream sends.

## 4. Derivations (so numbers are reproducible)

- `returns.monthly[].pct` — Ghostfolio time-weighted monthly performance, percentage mode.
- `ytd_pct` — geometric compound of current calendar year's months.
- `one_year_pct` — compound of last 12 months; `null` if fewer than 12 exist.
- `two_year_annualised_pct` — compound of last 24 months annualised (`(1+r)^(12/n)−1`); `null` under 24 months **unless** `months ≥ 18` (then annualised over actual span, client labels it "since start").
- `max_drawdown_pct` — peak-to-trough on the compounded monthly curve (monthly granularity; stated in the UI tooltip).
- `profitable_months_pct` — share of positive months.
- `risk.band` — stdev of monthly returns: `< 3` Low · `3–6` Medium · `> 6` High.
- `sufficient_history` — `months ≥ min_months_required` (6). When `false`, the client must render
  the **early-history** state and no KPI besides YTD.

## 5. Client rendering contract (what W13/W14 may assume)

- `404` → render the "hasn't shared performance yet" state; **also remove** the YTD chip in search
  results and the mavens rail (one source of truth — the chip is fetched from the same endpoint).
- `verified.last_verified_at` older than 48 h → render "last verified *n* days ago" chip.
- `sufficient_history:false` → early-history note; never imply a track record.
- Disclaimers are the client's duty on **every** surface that renders any field from this payload:
  *"Past performance is not indicative of future results. Educational — not investment advice."*
- Never sort or rank mavens by any field of this payload.

## 6. Operational notes

- **Ghostfolio version pinning:** gf-stats declares the Ghostfolio image tag it was tested against;
  the upgrade cadence (playbook §Seam 4) bumps both together. The poisoned-fixture test doubles as
  an upstream-drift tripwire.
- **Rate/data budget:** one Ghostfolio read per maven per day (plus busts) — negligible against
  provider quotas.
- **Logs** must never log payload bodies from Ghostfolio (they contain values); log status + timing only.
