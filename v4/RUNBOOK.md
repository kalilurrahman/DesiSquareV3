# DesiSquare Phase-1 MVP — Runbook

Step-by-step instructions from a fresh clone to a running site. Three tracks, each building on
the last. **Track A needs nothing but Node** and is ready in ~10 seconds; Tracks B and C add the
real Ghostfolio and Discourse containers when you want the full POC.

Everything runs locally with **zero external accounts** — no Meta, no Twilio, no Stripe, no paid
APIs (phase-1 non-negotiable #6).

---

## What you get

| Piece | Port | What it is |
|---|---|---|
| **Phase-1 prototype app** (`phase1-mvp/`) | **8786** | The cut-down DesiSquare site: landing → invite/sign-in → Reddit-style feed, 9 reactions, communities per country, profiles, portfolio card, settings, review queue, A/B Lab, demo driver. Zero-dependency Node 22. |
| **wa-bridge** (Script 1, `services/wa-bridge/`) | 8788 | WhatsApp sync. Mock mode by default (`WA_MODE=mock`); real `whatsapp-web.js` behind an env flag. Posts into the app through its Discourse-compatible API. |
| **gf-provisioner** (Script 2, `services/gf-provisioner/`) | 8789 | Discourse-webhook → Ghostfolio account, portfolio summaries, one-click SSO. Mock Ghostfolio by default; real one behind an env flag. |
| **Ghostfolio** (`services/ghostfolio/`) | 3333 | Self-hosted portfolio tracker (Docker), Track B. |
| **Discourse + MailHog** (`discourse/docker/`) | 8080 / 8025 | Dev forum + local mail catcher (Docker), Track C — the config-first production path. |

---

## Prerequisites

- **Node 22+** (`node --version`) — that's all for Track A.
- **Docker Desktop / Engine** — only for Tracks B and C.
- ~5 GB free RAM if you run everything at once.

---

## Track A — instant demo (~10 seconds, no Docker)

```bash
git clone <this repo> && cd DesiSquare
make demo
```

No `make` (e.g. plain Windows PowerShell)? Run the three processes in three terminals:

```powershell
# terminal 1 — the site
cd phase1-mvp
$env:DISCOURSE_WEBHOOK_SECRET="desisquare-dev-secret"; node server.mjs

# terminal 2 — Script 1 (WhatsApp bridge, mock mode)
cd services/wa-bridge
$env:DISCOURSE_URL="http://localhost:8786"; $env:DISCOURSE_API_KEY="demo-local-key"
$env:MIRROR_CATEGORY="ask-the-community"; $env:WA_MODE="mock"
$env:DISCOURSE_WEBHOOK_SECRET="desisquare-dev-secret"; node src/server.js

# terminal 3 — Script 2 (Ghostfolio provisioner, mock mode)
cd services/gf-provisioner
$env:DISCOURSE_WEBHOOK_SECRET="desisquare-dev-secret"; node src/server.js
```

No `npm install` anywhere — all three are zero-dependency.

### The guided tour (2 minutes)

1. **Open http://localhost:8786** → the public landing. This is all a signed-out visitor ever
   sees (non-negotiable #7). Try **Request to join**, or join with invite code **DSQ-2026**.
2. **Sign in** (top right) as **quiet_lotus** (member), **nikhil_cfa** (maven) or
   **desisquare_mod** (moderator).
3. **Feed**: inline composer (title → body → Space chips → Post), 4 positive reaction pills with
   public counts, `⋯` opens the 5-reason flag menu — those route **privately** to the review
   queue and never render publicly (non-negotiable #3).
4. **▶ Demo** (bottom right): the demo driver.
   - *POC wiring* shows live status of both scripts + Ghostfolio + Discourse.
   - *Inject a WhatsApp group message* → it travels through the **real wa-bridge** and lands in
     the feed labelled “via WhatsApp”, attributed to the member's pseudonym, in well under the
     60-second promise. Toggle *Mirror my group messages* off in Settings and inject again —
     it arrives as an unattributed guest post (consent honored end-to-end, non-negotiable #5).
   - *Simulate signup + provision* → fires the `user_confirmed_email` webhook at the **real
     gf-provisioner** twice and shows `provisioned` → `already_linked` (idempotency).
5. **Avatar → My profile**: Reddit-style **My posts / My comments**, reactions-received count,
   and the portfolio card — dollar value visible **only to you**; the Private/Public toggle
   exposes **allocation % only** (non-negotiable #4). *Open in Ghostfolio* mints a one-click
   SSO link through gf-provisioner.
6. **🧪 A/B Lab** (top bar): three contested design calls shipped as live experiments — feed
   density, reaction row style, right rail — plus a **Theme** picker with all four design
   skins (Midnight Bazaar · Sandalwood & Ink · Porcelain Slate · Haldi & Rani) alongside the
   default Warm Paper. Pick anything; it applies instantly and sticks to your account. See the
   decision log in `README.md`.
7. **Country switcher** (top bar): swaps the community list (US → CA → UK → AE → AU → SG).
   Joining a **PRIVATE** community creates a pending request.
8. Sign in as **desisquare_mod** → **Review queue**: the two seeded flagged posts (Marketing spam,
   Misleading hype) plus anything you flagged. *Remove post* pulls it from the feed.

> **Signed-out gating (non-negotiable #7):** every member API 401s without a session, including
> the demo-driver routes (`/api/demo/*`) — the demo drawer only works once you're signed in.
> The only things a signed-out visitor can reach are the landing shell and `/api/bootstrap`
> (public stats + demo-account list, with `me: null`).

### Verify it

```bash
make stop && make smoke   # stop the demo first — the smoke needs the default ports free
make test                 # unit/integration suites for phase1-mvp, wa-bridge, gf-provisioner
```

> `make smoke` boots its own copies of the three Node services on the default ports, so stop a
> running `make demo` first. It always runs against **mock** wa-bridge + gf-provisioner (it never
> starts Ghostfolio); the Track-B live path is verified by hand, not by the smoke.

---

## Track B — real Ghostfolio (adds Docker, ~2 minutes)

```bash
make poc
```

which does, equivalently:

```bash
cd services/ghostfolio
cp .env.example .env            # local-only secrets; rotate for any shared deploy
docker compose up -d            # ghostfolio 3.21 + its own postgres + redis on :3333
# wait for http://localhost:3333/api/v1/health, then restart Script 2 in live mode
# (keep DISCOURSE_WEBHOOK_SECRET matching the app + wa-bridge, or webhook HMAC is disabled):
cd ../gf-provisioner
GHOSTFOLIO_LIVE=true GHOSTFOLIO_URL=http://localhost:3333 \
  DISCOURSE_WEBHOOK_SECRET=desisquare-dev-secret node src/server.js
```

Now “Simulate signup + provision” creates **real** Ghostfolio accounts, and *Open in Ghostfolio*
logs you straight into http://localhost:3333 via the signed SSO exchange — no Ghostfolio password
ever exists. New members add holdings manually in Ghostfolio (P1-FR-06).

---

## Track C — real Discourse (the config-first production path)

The prototype app proves the product; Discourse is where Phase 1 goes to production
(config + theme, not custom code). This track runs it locally.

```bash
make discourse        # = docker compose -f discourse/docker/docker-compose.yml up -d
```

First boot runs migrations for **2–3 minutes**. Then:

1. **Discourse** http://localhost:8080 — log in `admin` / `desisquare-admin-pass`.
2. **MailHog** http://localhost:8025 — every email (confirmations, invites) lands here.
3. Create an Admin API key: *Admin → API → Keys → New Key* (scope: All Users, Global) — or
   mint one from the shell without clicking:
   ```bash
   docker exec docker-discourse-1 bash -c 'cd /opt/bitnami/discourse && RAILS_ENV=production \
     bundle exec rails runner "k = ApiKey.create!(description: \"phase1\", created_by_id: -1); puts k.key"'
   ```
4. Provision the community structure as code:
   ```bash
   cd discourse/setup
   cp .env.example .env      # set DISCOURSE_URL=http://localhost:8080 and DISCOURSE_API_KEY=<your key>
   npm install               # this tool has 2 deps (dotenv, js-yaml)
   npm run plan              # dry-run diff
   npm run apply             # converge (idempotent — re-run is a no-op)
   npm run seed              # starter topics (not idempotent; run once)
   ```
5. Install the theme component (Reddit-style feed, disclaimer, via-WhatsApp badge,
   portfolio card). Run these from the **repo root** (`git archive` tree paths are
   repo-root-relative regardless of your shell's cwd):
   ```bash
   export DISCOURSE_API_KEY=<your key>          # the curls below read this
   git archive --format=zip -o theme.zip HEAD:discourse/theme-component
   curl -X POST "http://localhost:8080/admin/themes/import.json" \
     -H "Api-Key: $DISCOURSE_API_KEY" -H "Api-Username: system" \
     -F "theme=@theme.zip;type=application/zip"
   # then attach it to the default theme (id from the response):
   curl -X PUT "http://localhost:8080/admin/themes/1.json" \
     -H "Api-Key: $DISCOURSE_API_KEY" -H "Api-Username: system" \
     -H "Content-Type: application/json" \
     -d '{"theme":{"child_theme_ids":[<ID>]}}'
   ```
6. Repoint the two scripts at real Discourse (each script's `.env`):
   ```bash
   # services/wa-bridge/.env
   DISCOURSE_URL=http://localhost:8080
   DISCOURSE_API_KEY=<admin key>          # posts now create real Discourse topics
   # services/gf-provisioner/.env — nothing to change; Discourse's webhook (provisioned by
   # the blueprint) calls it on user_confirmed_email.
   ```

> The blueprint (`discourse/setup/config/blueprint.yml`) already wires both webhooks
> (wa-bridge notify + gf-provisioner user events) and the `allowed_internal_hosts` SSRF
> exception. The prototype app keeps working alongside — it's the same two scripts either way.

---

## Going live on real WhatsApp (when you're ready — env only, no code change)

```bash
cd services/wa-bridge
npm run install:wa        # pulls whatsapp-web.js locally (the only optional dependency)
WA_MODE=whatsapp-web.js node src/server.js
# scan the QR from `GET /session` with the community phone, map members with POST /map
```

Outbound notifications need a Meta Cloud API token (`WA_CLOUD_TOKEN`, `WA_PHONE_NUMBER_ID`) —
left mocked in the POC by design.

---

## Ports, creds & state files (cheat sheet)

| Thing | Value |
|---|---|
| Prototype app | http://localhost:8786 · demo logins `quiet_lotus`, `nikhil_cfa`, `desisquare_mod` · invite `DSQ-2026` |
| wa-bridge | http://localhost:8788 (`/health`, `/mock/inbound`, `/map`, `/optout`) |
| gf-provisioner | http://localhost:8789 (`/health`, `/provision`, `/sso/:id`) |
| Ghostfolio | http://localhost:3333 (secrets in `services/ghostfolio/.env`) |
| Discourse / MailHog | http://localhost:8080 (`admin` / `desisquare-admin-pass`) / http://localhost:8025 |
| Webhook HMAC secret | `DISCOURSE_WEBHOOK_SECRET` — set the SAME value on all three Node services |
| Demo state | `phase1-mvp/data/db.json` · `services/wa-bridge/data/state.json` · `services/gf-provisioner/data/identity.json` — `make reset` wipes all three |

## Troubleshooting

- **Port busy** → `make stop` (also stops the Docker stacks), or `fuser -k 8786/tcp` etc.
- **WA message not landing in the feed** → check the demo drawer's POC wiring; wa-bridge must
  show `up · live` (its `DISCOURSE_API_KEY` must be non-empty and `DISCOURSE_URL` must point at
  the app). `make demo` sets both.
- **`Open in Ghostfolio` says “start POC services”** → gf-provisioner isn't running/reachable.
- **Ghostfolio container restarting** → its `.env` must use `sslmode=disable` in `DATABASE_URL`
  (the bundled alpine Postgres has no TLS).
- **Discourse slow on first boot** → normal; migrations take 2–3 min. `docker logs -f
  docker-discourse-1` to watch.
- **Blueprint apply hits 429** → Discourse rate-limits bursts of admin writes; re-run with
  `DESISQUARE_RATE_MS=800 npm run apply` (it's idempotent — it picks up where it stopped).
- **Webhook create SKIPs with a 500** → Discourse can't resolve `host.docker.internal`
  (plain-Linux Docker). The compose now maps it via `extra_hosts`; `docker compose up -d`
  to recreate, then re-run apply.
- **Demo data weird after experiments** → `make reset` reseeds everything from
  `phase1-mvp/data/seed.json`.

## Acceptance criteria → how they're verified (PRD §5)

| Criterion | Where |
|---|---|
| Fresh clone → one command → everything running locally, seeded like the prototype | `make demo` (Track A) |
| WhatsApp message in feed < 60 s under pseudonym; E.164 grep finds nothing | `make smoke` (“mirror latency”, “leak sweep”) + `phase1-mvp/test/privacy.test.js` |
| New signup → exactly one Ghostfolio account; webhook re-fire = no duplicate; 1-click open | `make smoke` (“idempotent”, “SSO click 302s”) against mock GF; the same flow hand-verified live against Ghostfolio in Track B |
| 9 reactions exactly; negative lands in review queue, invisible publicly | `make smoke` + `phase1-mvp/test/api.test.js` |
| Country switch swaps list; private community join creates pending request | `make smoke` |
| Zero-training gate: land → join → read → post → react without instructions | human gate — run the guided tour with 5 first-time testers |

## Deploy to Railway (share a live demo)

The prototype is a self-contained zero-dep Node app, so the fastest way to a public URL is a
**single Railway service** — the WhatsApp mirror still works (built-in fallback) and the whole
UX (feed, reactions, communities, A/B Lab, review queue, profiles) is fully live. It ships with
a `railway.json` (Dockerfile build + `/api/health` healthcheck), so deployment is turnkey.

**Option A — just the site (recommended for a demo):**

1. [railway.com](https://railway.com) → **New Project → Deploy from GitHub repo** →
   `kalilurrahman/DesiSquare`, branch `claude/desisquare-phase1-mvp-prototype-spbu0l`.
2. Open the service → **Settings → Root Directory** = `phase1-mvp`. Railway reads
   `phase1-mvp/railway.json` + `Dockerfile` and builds automatically.
3. **Settings → Networking → Generate Domain.** Railway injects `PORT`; the app already reads it.
4. (Optional) **Variables → `PUBLIC_URL`** = your generated `https://…up.railway.app` domain so
   absolute links are correct. (Optional) add a **Volume** mounted at `/app/data` to persist
   posts across redeploys — otherwise state reseeds from `seed.json` on each deploy, which is
   usually what you want for a demo.

That's it — the URL serves the full prototype. The demo drawer will show wa-bridge /
gf-provisioner as "not running" and "Open in Ghostfolio" shows a hint, which is expected for a
single-service deploy.

**Option B — the full three-service loop:** add two more services in the same project
(**+ New → GitHub repo**, same repo/branch), setting **Root Directory** to `services/wa-bridge`
and `services/gf-provisioner`. Wire them over Railway's private network and set a shared secret
on all three:

| Service (Root Directory) | Variables |
|---|---|
| `phase1-mvp` | `WA_BRIDGE_URL=http://${{wa-bridge.RAILWAY_PRIVATE_DOMAIN}}:8788` · `GF_PROVISIONER_URL=http://${{gf-provisioner.RAILWAY_PRIVATE_DOMAIN}}:8789` · `DISCOURSE_WEBHOOK_SECRET=<shared>` |
| `services/wa-bridge` | `PORT=8788` · `DISCOURSE_URL=http://${{phase1-mvp.RAILWAY_PRIVATE_DOMAIN}}:8786` · `DISCOURSE_API_KEY=demo-local-key` · `MIRROR_CATEGORY=ask-the-community` · `WA_MODE=mock` · `DISCOURSE_WEBHOOK_SECRET=<shared>` |
| `services/gf-provisioner` | `PORT=8789` · `DISCOURSE_WEBHOOK_SECRET=<shared>` (leave `GHOSTFOLIO_LIVE` unset → mock) |

> Ghostfolio and Discourse can also run on Railway (Docker image + a Postgres and Redis plugin
> each), but that's a heavier lift — do Option A or B first to get the product in front of people,
> then add those when you want the fully live integrations. Before exposing wa-bridge /
> gf-provisioner publicly, read **Known limitations** below and keep them on the private network.

> **Deploying (local · Railway · GCP):** the full step-by-step is in the repo-root
> [DEPLOYMENT.md](../DEPLOYMENT.md). Production hardening + the security checklist are in
> [PRODUCTION.md](./PRODUCTION.md).

## Known limitations (local POC)

These are deliberate for a zero-account local demo — tighten them before any shared/exposed deploy:

- **The Node services trust their caller.** `wa-bridge` (`/map`, `/optout`, `/mock/inbound`) and
  `gf-provisioner` (`/portfolio/:id/summary`, `/portfolio/:id/visibility`) have no auth of their
  own — like the rest of this local tier, they assume only the prototype app (and you) can reach
  them on localhost. In the phase-1 product, non-negotiable #4 is upheld by the app and theme,
  which only ever request `viewer=owner` for the signed-in member's own id and `viewer=public`
  (allocation-only) for everyone else; the app also gates every visibility change behind the
  member's own session. A hardened deploy should put these services behind the app (private
  network) or add a shared-secret header before exposing them.
- **Discourse dev image.** Track C uses the Bitnami dev image; production Discourse uses the
  official `discourse_docker` installer. Keep every host/port/secret in `.env` so the lift is
  config-only.
