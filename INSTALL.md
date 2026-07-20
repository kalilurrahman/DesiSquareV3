# DesiSquare V3 — local installation

Run the whole product on your machine. **Zero npm dependencies** — everything is
vanilla Node (stdlib `node:http`, `node:test`). The only prerequisite is **Node 18+**
(Node 22 recommended). No Docker needed for the app + services tier.

## TL;DR

```bash
git clone https://github.com/kalilurrahman/DesiSquareV3
cd DesiSquareV3
make install     # just verifies Node ≥ 18 — nothing to download
make dev         # boots app + 3 services  →  http://localhost:5191
```

Open **http://localhost:5191** and click through: the feed, a maven profile
(**Monthly / Yearly / Overall % — no dollar values**), Settings → **"Share my gains — % only"**,
and search (All / Communities / Posts / Comments / Profiles). Ctrl-C stops the whole stack.

## What `make dev` starts

`scripts/dev-local.mjs` launches four processes, waits for each to report healthy,
prefixes their logs, and tears them all down on Ctrl-C:

| Process | Port | Role |
|---|---|---|
| **app** | 5191 | the product SPA + same-origin proxy (`app/serve.mjs`) |
| **models-service** | 8791 | percent-only performance engine — CAGR / vs-benchmark / max-drawdown / **Monthly-Yearly-Overall %** (equity indexed to 100, no currency ever) |
| **wa-bridge** | 8788 | WhatsApp ↔ Discourse mirror (consent-gated, mock mode locally) |
| **gf-provisioner** | 8789 | signup → one Ghostfolio account, 1-click SSO (mock Ghostfolio locally) |

With the services up, the app shows **LIVE** maven performance from models-service.
When a service (or the optional Ghostfolio/Discourse upstreams) is down, the app
degrades gracefully to seeded content — so `make app` alone also works.

## Other targets

```bash
make app             # just the app (seeded fallback; no services)
make test            # every service's test suite (node --test)
make smoke           # boot-and-health-check each service
make stop            # free ports 5191/8791/8788/8789
make clean           # remove services' runtime data/state.json
```

## Running a single piece

```bash
cd services/models-service && node src/server.js      # :8791
cd app && node serve.mjs                              # :5191  (PORT overridable)
```

Point the app at remote services with env vars (same-origin proxy targets):
`MODELS_URL`, `WA_URL`, `GF_URL`, `DISCOURSE_URL` — e.g.
`DISCOURSE_URL=https://community.example.com node app/serve.mjs`.

## The full product (with real Discourse + Ghostfolio)

The app + services tier above is the DesiSquare glue layer. The **community engine
(Discourse)** and **portfolio tracker (Ghostfolio)** are deployed upstream projects —
stand them up via:

- **`deploy/gcp/`** — the production/demo package (2 VMs, `CLAUDE.md` drives a ~1-hour demo).
- **`deploy/railway/`** — Ghostfolio on Railway + Discourse hosting options (read its README first).

Then seed a living community and run the acceptance suite:

```bash
DISCOURSE_URL=https://community.example.com DISCOURSE_API_KEY=<global admin key> \
  make community-test        # 50 users, 15 dialogues, 14 acceptance checks → report
```

## Notes

- **Percent-only is enforced in the engine, not just the UI:** the models-service equity
  series is indexed to 100 at inception, so no currency value can reach a non-owner —
  maven and member public performance is Monthly/Yearly/Overall **%** only (constraints #4/#8;
  stories 6.7 / 7.2). The only place an absolute amount renders is the owner's own `#/me`.
- **Secrets:** copy any `.env.example` to `.env` (git-ignored) to wire real upstreams;
  never commit `.env`.
