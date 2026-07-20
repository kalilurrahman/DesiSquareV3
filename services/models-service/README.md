# models-service — the trust layer's ledger

Tracks maven **investment models** and **signal records** from declared, timestamped
entries/exits, and computes performance — CAGR, vs-benchmark, max drawdown — from EOD
prices. Nothing here is self-reported: mavens declare actions, the service computes
outcomes. (Stories: MAV-S02, MAV-S03, FED-S04 · TRD §2/§3 · FR-05/FR-10/FR-11.)

Zero-dependency Node 22 (stdlib `node:http`, `node:test`), same layout as `ai-service/`.
Port **8791**. Storage is the sibling-service JSON-file pattern (`data/state.json`,
git-ignored); the schema maps 1:1 to Postgres tables when promoted.

```bash
node src/server.js        # http://localhost:8791 (seeds demo data on first boot)
node --test               # unit tests (fixture recompute, immutability, webhook, sincePct)
node scripts/smoke.js     # boots on an ephemeral port, checks /health + metrics, exits 0/1
node scripts/gen-fixture.mjs   # regenerate the committed price fixture (deterministic)
```

## Data

| Record | Shape | Mutability |
|---|---|---|
| **Model** | `{ id, ownerUserId, name, strategy, risk, createdAt, followers }` | create/read |
| **ModelEntry** | `{ id, modelId, instrument, side: BUY\|SELL, weightPct, declaredAt, refPrice }` | **immutable** — corrections are new entries |
| **Signal** | `{ id, userId, postId, kind: BUY\|SELL\|HOLD\|UPDATE, instrument, stampedAt, refPrice }` | **immutable**, idempotent on `postId` |
| **PriceBar** | `{ instrument, date, close }` (fixture stores them columnar: `{ dates[], closes{} }`) | reloaded by the reprice job |

`ownerUserId`/`userId` are **pseudonyms** (Discourse usernames) or numeric ids — never
phone numbers or emails (hard product rule #1/#2; the test suite greps responses for
E.164 shapes).

## Endpoints

- `POST /webhook/discourse` — Discourse post-created events (HMAC `sha256=` signature in
  `X-Discourse-Event-Signature`, same scheme as the sibling services). A post carrying
  `signal_kind` + `ticker` custom fields stamps a Signal — idempotent on `postId` AND on
  `X-Discourse-Event-Id`. Event ids are deduped only after a **terminal** outcome
  (stamped/skipped/duplicate); a failed delivery (400/422) stays retryable so a Discourse
  redelivery is never swallowed. Alias: `POST /discourse/webhook`. The compose demo path
  runs with signature verification **on** (`DISCOURSE_WEBHOOK_SECRET`, default
  `change-me` — set the same secret on the Discourse webhook via `discourse/setup`).
- `POST /models` — create `{ ownerUserId, name, strategy?, risk?, id? }` (id defaults to
  `model-<slug>`; identical re-create is a 200 no-op).
- `GET /models/:id` — model + its immutable entry ledger.
- `GET /models/:id/metrics` — `{ cagr, vsBenchmark, maxDrawdown, since, series[] }`
  (+ `benchmark`, `name`, `disclaimer`). `series[]` = `{ date, equity, benchmark }`,
  both indexed to 100 at `since`, ready for the profile sparkline.
- `POST /models/:id/entries` — declare `{ instrument, side, weightPct, declaredAt?, refPrice? }`.
  Instrument is validated against price data (422 if unknown); `declaredAt` must be strict
  ISO-8601 (400) and inside price coverage (422 — an explicit `refPrice` cannot bypass it);
  `refPrice` defaults to the close on/before `declaredAt`. Aggregate long weight is
  **capped at 100%** on every date — a BUY that would over-allocate the book is rejected
  **422 `over_allocated`** (cash idles at 0%, it never goes negative). **Immutable**: an
  identical duplicate POST is a no-op returning the existing entry (200 `exists`); any
  modification attempt — changed values on the same `(instrument, side, declaredAt)` key,
  a reused entry id, or PUT/PATCH/DELETE — is rejected **409**.
- `GET /models/:id/entries` — read the ledger.
- `GET /users/:id/models` — models owned by a user, each with card-sized `metrics`.
- `GET /users/:id/signals` — signal-record rows (newest first) incl. `sincePct` + `latestClose`.
- `POST /jobs/reprice` — daily batch: re-ingest EOD bars, recompute all model metrics.
  Also runs on a timer when `REPRICE_INTERVAL_MINUTES>0`.
- `GET /health` — status, counts, price coverage.

Every performance-bearing response carries the persistent **"Not investment advice"**
disclaimer string (product rule #7) so theme surfaces can render it straight through.

## Computation rules (deterministic — same inputs, identical outputs)

- Daily **equity series** from entry weights × close prices, indexed to 100 at the first
  entry date. BUY adds `weightPct` to the instrument's allocation, SELL removes it
  (floored at 0); the un-allocated remainder is **cash idling at 0%** — gross exposure
  can never exceed 100% (rejected on declare, and clamped defensively at compute time).
  A day's return uses the weights in force at the previous close (an entry earns from
  the next bar). A **missing bar** (null close) is bridged by carrying the last finite
  close forward: the gap day contributes 0, the full move lands on the next real bar.
- **CAGR** annualized over the actual data window — first priced bar on/after the first
  entry date → last bar (calendar days / 365.25). Windows **under a year are not
  extrapolated**: `cagr` then holds the cumulative period return and the response's
  `annualized` flag is `false`.
- **vsBenchmark** = model CAGR − benchmark CAGR over the same window, in percentage
  points. Benchmark default `SPY` (env `BENCHMARK`).
- **maxDrawdown** = worst peak-to-trough of the equity series (negative %).
- **sincePct** (signals) = close-vs-refPrice since `stampedAt`; for **SELL** the sign is
  **flipped** — the call is judged as the avoided move, so a price fall after a SELL
  scores positive. Instrument-less signals (e.g. an UPDATE thread) get `sincePct: null`.
  A signal stamped **after the last available bar** is **pending** (`refPrice`/`sincePct`
  null, rendered —) rather than priced off the stale last bar as a spurious 0%; the row
  prices itself deterministically from the immutable `stampedAt` once coverage catches up.
- All dates (`declaredAt`, `stampedAt`) are validated as **strict ISO-8601** on write, so
  string date comparisons stay chronological.

## Price fixture (`PRICES_MODE=fixture`, the default)

`test/fixtures/prices.json` — 12 tickers (incl. `SPY`) × ~18 months of weekday EOD bars
(2025-01-01 → 2026-07-10), generated by `scripts/gen-fixture.mjs` with a **seeded PRNG**
(mulberry32; no `Math.random`) and committed. Regenerating produces byte-identical JSON,
so model metrics and signal `sincePct` are reproducible offline with no external accounts.
`PRICES_MODE=live` + `PRICES_API_URL` swaps in a real EOD feed (same JSON shape) — a
config-only change, never a code edit.

## Demo seeds (`seed/models.seed.json`)

Loaded on first boot only when the store is empty (idempotent). Mirrors the hi-fi
prototype: mavens `nikhil_cfa` (Steady Compounder, Dividend Ladder), `arjun_quant`
(Momentum Sleeve), `priya_taxes` (UPDATE signal), plus the prototype's signal history
(NVDA trim, VTI redeploy, MSFT hold, BRK.B buy, AVGO entry, SMCI trend-break exit).

## Acceptance (tested in `test/`)

1. Seeded **"Steady Compounder"** shows CAGR / vs-SPY / max-DD matching an independent
   fixture recompute to **±0.1%** (`test/metrics.test.js`).
2. A signal-tagged Discourse post stamps a Signal via the webhook, idempotently
   (`test/webhook.test.js`).
3. Entries are **immutable** — a second identical POST is a no-op; edits are rejected
   **409** (`test/immutability.test.js`).
4. `sincePct` **flips sign for SELL** signals (`test/signals.test.js`).
5. Theme surfaces (profile signal table, model cards) render straight from
   `GET /users/:id/signals` and `GET /users/:id/models`.

## Env (see `.env.example`)

```
PORT=8791
PRICES_MODE=fixture        # fixture | live
PRICES_FIXTURE=./test/fixtures/prices.json
PRICES_API_URL= PRICES_API_KEY=          # live mode only
BENCHMARK=SPY
DISCOURSE_URL=http://host.docker.internal:8080
DISCOURSE_WEBHOOK_SECRET=change-me
REPRICE_INTERVAL_MINUTES=0 # >0 = run the reprice job on a timer
```
