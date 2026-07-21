# DesiSquare v4 — deploy & host on a generic Discourse server

> v4 is a **progressive increment of the v1 site** (`kalilurrahman/DesiSquare` → `phase1-mvp`, the app live at `desisquare-production`). It keeps v1's Reddit-calibre forum and adds the Phase-1 **review-comment** features: open **user registration**, an **admin** panel, **moderation** (review queue), the **Reddit-style search** (All / Posts / Communities / Comments / Profiles + a communities rail), and the **eToro-style maven performance proof** (Overview / Stats / Portfolio / Chart — **percent only, asset value never shown**).

There are two deployment shapes. You almost certainly want **both**: (A) get v4 up on Railway today, and (B) point it at a real generic Discourse for the production forum.

---

## A · Deploy v4 to Railway → `desisquarev4-production`  (up and running today)

v4 runs as a **complete standalone forum**: its own registration, login, roles, moderation queue, and admin panel — no external services required (it upgrades live when they're reachable). This is the fastest "up and running like a Reddit forum."

1. In Railway: **New → Deploy from GitHub repo → `kalilurrahman/DesiSquareV3`**, branch `claude/desi-square-product-gh4xbh`.
2. **Service → Settings → Root Directory = `v4`** (this is the key step — it makes Railway build `v4/Dockerfile` / read `v4/railway.json`, not the repo root).
3. Deploy. **Settings → Networking → Generate Domain** (leave the port blank; the server reads Railway's injected `PORT`, health check is `/api/health`).
4. Name the service **`desisquarev4`** so the domain is `desisquarev4-production.up.railway.app`.
5. Verify: `…/api/health` → JSON; `…/#/feed` → the forum. Register an account, or sign in as a demo persona.

*(CLI equivalent: `cd v4 && railway up` after `railway init`.)*

To connect the real services later, set env vars on the service (all optional — see `.env.example`): `DISCOURSE_URL`, `GHOSTFOLIO_URL`, `GF_PROVISIONER_URL`, `WA_BRIDGE_URL`, `DISCOURSE_WEBHOOK_SECRET`.

---

## B · Host the forum on a **generic Discourse server** (the production posture)

"Hosted on a generic Discourse server" means running **Discourse itself** as the community engine — which natively provides everything you asked for, out of the box:

| Requirement | Discourse-native |
|---|---|
| User registration | Sign-up + email activation (or invite-only) — Admin → Settings → Login |
| Admins manage the site | Full **Admin** panel: users, groups, categories, settings, themes, backups |
| Moderation | Flags → **review queue**, silence/suspend, category moderators, watched words |
| "Like a Reddit forum, up and running" | Categories = subreddits, tags, replies, reactions, trust levels, hot/top/latest |

Discourse's **only supported install** is its Docker launcher on a plain Linux VM (it can't run supported on Railway — see `deploy/railway/README.md`). Stand one up in ~1 hour:

1. Provision a VM (any generic host: a $12–24 VPS, or the scripted 2-VM GCP path in **`deploy/gcp/`** — read `deploy/gcp/CLAUDE.md`). Ubuntu 22.04/24.04, 2 GB+ swap.
2. Run the official installer (`deploy/gcp/scripts/02-discourse-install.sh`, or `git clone https://github.com/discourse/discourse_docker /var/discourse && ./discourse-setup`). Point it at your domain, give it SMTP so **registration emails** send (Brevo free tier works — see `deploy/CLIENT-INFRA-CHECKLIST.md`).
3. Create the first admin from the console (`./launcher enter app && rake admin:create`) — that's your **site admin**; the Admin panel manages everything.
4. Create categories (your corridors/spaces) and, optionally, apply the **Porcelain Slate** theme + the four fixed reaction pills (runbook `docs/runbooks/demo-install-01-discourse.md`, stages 5–8).
5. It's now a live Reddit-style forum: registration, admin, moderation all working.

### Wire v4 to that generic Discourse

Set on the v4 Railway service:

```
DISCOURSE_URL=https://community.<your-domain>
DISCOURSE_WEBHOOK_SECRET=<same secret you set on the Discourse webhook>
```

- v4 **probes** `DISCOURSE_URL/about.json` and reports it live in the demo drawer.
- The **maven performance proof** is fed by the percent-only engine (`services/models-service` / `gf-provisioner`) computed from Ghostfolio — never currency (constraints #4/#8).
- WhatsApp mirroring flows through `services/wa-bridge` into Discourse.
- **SSO / single identity:** to make Discourse the single source of accounts (so "registration" happens once, in Discourse), enable **DiscourseConnect** with the DesiSquare app as the provider — the phased plan is in `deploy/gcp/RUNBOOK.md` (F5.7). Until then, v4's own registration runs the forum standalone.

---

## C · Add the **Ghostfolio site** to the mix (real portfolios + maven proof)

Ghostfolio is where members' real portfolios live. In DesiSquare the owner sees dollar values in Ghostfolio; **every public/maven surface shows percent only** (constraints #4/#8). Two glue services connect the forum to it — both already in `services/`, both with a **real Ghostfolio client verified against Ghostfolio v3.21.0**:

- **`gf-provisioner`** (:8789) — on registration, creates/links one Ghostfolio account; serves the profile portfolio summary; mints the **"Open in Ghostfolio →" 1-click SSO** deep-link.
- **`models-service`** (:8791) — the percent-only performance engine behind the maven proof.

### Run the full mix locally (one command)

```bash
make dev-v4          # v4 forum :8786 + gf-provisioner :8789 + wa-bridge :8788 + models-service :8791
```

v4 probes the services and upgrades live automatically (its demo drawer shows each as ● up). gf-provisioner runs in **mock** mode until a real Ghostfolio is present. To add the **real Ghostfolio site** (needs Docker):

```bash
cd services/ghostfolio && docker compose up -d          # Ghostfolio + Postgres + Redis → :3333 (~1 min)
GHOSTFOLIO_URL=http://localhost:3333 GHOSTFOLIO_LIVE=true make dev-v4
```

Now registration provisions a **real** Ghostfolio account and "Open in Ghostfolio →" single-click-logs into it.

### Deploy the Ghostfolio site on Railway (it deploys cleanly — unlike Discourse)

1. **Ghostfolio** — one-click template `https://railway.com/deploy/ghostfolio` (or the official image `ghostfolio/ghostfolio:latest` + Railway Postgres/Redis). Health `/api/v1/health`, port 3333. Full steps + env in `deploy/railway/RUNBOOK-RAILWAY.md` (Stage A1) and `deploy/railway/env/ghostfolio.env.sample`. Claim admin immediately (first `POST /api/v1/user` = admin).
2. **gf-provisioner** — deploy as a Railway service from `services/gf-provisioner/` (Root Directory = `services/gf-provisioner`); set `GHOSTFOLIO_URL=<your Ghostfolio Railway URL>`, `GHOSTFOLIO_LIVE=true`, and the shared `DISCOURSE_WEBHOOK_SECRET`.
3. **Wire v4** — on the `desisquarev4` service set:
   ```
   GF_PROVISIONER_URL=<gf-provisioner Railway URL>
   GHOSTFOLIO_URL=<Ghostfolio Railway URL>
   ```
4. v4 now shows the portfolio card (owner $ / public % / private default), provisions on signup, and "Open in Ghostfolio →" SSO into the live Ghostfolio site.

The result is the full mix: **v4 forum** (registration/admin/moderation) · **Ghostfolio** (portfolios) · **gf-provisioner** (glue + SSO) · **models-service** (percent-only maven proof) — with dollar values owner-only and every public surface percent-only.

## Which mode am I in?

- **No `DISCOURSE_URL` set** → v4 is the forum (its own registration/admin/moderation). Perfect for the Railway demo.
- **`DISCOURSE_URL` set to a live Discourse** → Discourse is the forum of record; v4 is the branded experience + maven %-proof + Reddit search on top.

Both are "up and running like a Reddit forum." Start with A to see it today; move to B for the real generic-Discourse production site.
