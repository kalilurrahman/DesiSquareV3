# DesiSquare Phase-1 — running the POC services & going to production

Your live demo (`desisquare-production.up.railway.app`) shows **wa-bridge**, **gf-provisioner**,
and **Ghostfolio** as "not running" because it's the **single-service** deploy (RUNBOOK Option A —
just the prototype app). That's by design: the app is self-contained and degrades gracefully
(WhatsApp mirroring uses a built-in fallback; "Open in Ghostfolio" shows a hint). This doc covers
(1) how to light those three up for the demo, and (2) what real production + security takes.

---

## Part 1 — Run the three services (demo)

### 1A. Locally (fastest, zero cloud)
```bash
make demo     # prototype app + wa-bridge + gf-provisioner (all Node, mock modes) → :8786
make poc      # + self-hosted Ghostfolio (Docker) and flips gf-provisioner to live
```
Open the demo drawer — all four now report **up**. (`make discourse` adds real Discourse too.)

### 1B. On Railway (make your hosted demo show them "up")
Add `services/wa-bridge` and `services/gf-provisioner` as two more services in the same Railway
project, wired on the private network (each ships a `railway.json`, so it's a few clicks). Optional
Ghostfolio + Postgres + Redis lights up the 4th line. **Full step-by-step with the exact env blocks
is in the repo-root [`DEPLOYMENT.md`](../DEPLOYMENT.md) §2.** Keep both scripts on the **private**
network (no public domain) — see the security checklist below.

---

## Part 2 — Production setup

**Architecture note first.** The prototype app (`phase1-mvp/`) is the **demo/POC** — a
zero-dependency single-file store with demo logins, the A/B Lab and the demo drawer. **Production
Phase 1 is *not* this app.** It is **real Discourse (with the theme component) as the front-end +
the same two Node scripts + Ghostfolio** — exactly what RUNBOOK Track C provisions. The app proves
the product cheaply; production swaps the front-end to Discourse and keeps the two scripts.

| Component | Demo (now) | Production |
|---|---|---|
| **Front-end** | prototype app (`:8786`, JSON store, demo logins) | **Discourse** (official installer) + theme component; SSO auth, email verification, native mod queue |
| **Discourse infra** | Bitnami all-in-one dev image | Official `discourse_docker` (launcher + app.yml); **managed Postgres + Redis**; real SMTP (SES/Mailgun/Postmark); object storage (S3/GCS) for uploads/backups |
| **Ghostfolio** | mock, or local Docker | `ghostfolio/ghostfolio` pinned; managed Postgres/Redis; scheduled backups |
| **wa-bridge (Script 1)** | `WA_MODE=mock` | Real WhatsApp — **Meta Cloud API** (recommended, official) *or* `whatsapp-web.js` (unofficial); `ALLOWED_GROUPS` allow-list; phone→user consent vault; alert webhook |
| **gf-provisioner (Script 2)** | mock, unauthenticated | `GHOSTFOLIO_LIVE=true`; real `DISCOURSE_WEBHOOK_SECRET`; **Postgres-backed** identity store; retry/backoff queue |
| **Hosting** | Railway single service | GCP (Compute Engine + Cloud SQL + Memorystore + Secret Manager + Cloud LB/TLS + GCS backups) — see `docs/mvp-investment-platform/05-deployment-gcp.md`; the containers lift as-is (config-only) |

### Real WhatsApp (the one integration that needs an external account)
- **Meta Cloud API** (recommended): create a Meta Business + WhatsApp Business Account, verify a
  sender number, get approved message **templates**. Set `WA_CLOUD_TOKEN`, `WA_PHONE_NUMBER_ID`,
  `WA_TEMPLATE_NAME`. Inbound group mirroring, however, is **not** offered by the Cloud API —
  for group-listening you use `whatsapp-web.js` (below) for inbound and Cloud API for outbound.
- **whatsapp-web.js** (unofficial, for inbound group capture): `npm run install:wa`, set
  `WA_MODE=whatsapp-web.js`, scan the QR from `GET /session` with the community phone, persist the
  session volume. Caveat: it drives a real WhatsApp Web session — fragile, against ToS at scale,
  fine for a single community bridge. Map members with `POST /map` and set `ALLOWED_GROUPS`.
- Either way, **no phone number ever reaches Discourse or the browser** — the bridge already
  enforces this (salted-hash in logs, pseudonym attribution).

### Rough effort
Wiring the two scripts to real Discourse + real Ghostfolio and hardening: **~1–2 weeks**. Real
WhatsApp (WABA verification + template approval is the long pole, mostly waiting on Meta):
**~1–3 weeks elapsed**. GCP lift (the Hub v2 estimate): the remaining Phase-1 production work sits
inside the **~48 dev-days Likely** total, most of which is Phase-2. The containers are already
config-only to move.

---

## Part 3 — Security checklist (do before any public/shared deploy)

**Highest priority — the two scripts trust their caller.** `wa-bridge` (`/map`, `/optout`,
`/mock/inbound`) and `gf-provisioner` (`/portfolio/:id/summary`, `/visibility`) have **no auth of
their own** — they assume only the app reaches them on a private network. Before exposure:
- Keep them **private-network only** (no public Railway domain / no public GCP IP), **and**
- add a shared-secret header (or mTLS) between the app and the scripts, **and**
- disable/guard the demo-only surfaces (`/simulate/*`, `/api/demo/*`) in production — the demo
  driver is not a product surface.

**Secrets — rotate every dev default before go-live:**
- `DISCOURSE_WEBHOOK_SECRET` (currently `desisquare-dev-secret`), `SSO_SECRET` (`change-me`),
  Discourse admin password (`desisquare-admin-pass`), Ghostfolio `ACCESS_TOKEN_SALT` /
  `JWT_SECRET_KEY`, Postgres/Redis passwords. Store in **Secret Manager** (GCP) or Railway
  variables — never in git. `.env` is git-ignored; `.env.example` files carry placeholders only.
- Turn **on** HMAC verification everywhere: an empty `DISCOURSE_WEBHOOK_SECRET` *disables* webhook
  signature checks (dev convenience) — production must set it on Discourse **and** both scripts.

**Transport & edge:** TLS on every public surface (Cloud LB / Railway gives this); HSTS; a WAF +
rate-limiting in front of Discourse; restrict Discourse `allowed_internal_hosts` to exactly the
service hosts (the SSRF-guard exception is dev-only for `host.docker.internal`).

**Privacy / compliance (the product's whole premise):**
- The **E.164 leak test** is in CI (`phase1-mvp/test/privacy.test.js` + `make smoke`) — keep it
  green; it's the guardrail for non-negotiable #1.
- Phone numbers live only in the bridge's consent vault; production should encrypt that store at
  rest and keep an **audit trail** of consent grant/revoke. Honor revocation < 60 s (already
  enforced) and add data-retention + right-to-erasure handling (GDPR/DPDP).
- Portfolio value stays owner-only; public = allocation-% only — enforced server-side in both the
  app and gf-provisioner. Keep it that way if you build a real auth layer.

**Ops:** automated encrypted backups (`scripts/backup.sh` covers Postgres dumps + service state,
GCS push optional) with restore drills; centralized logs + uptime/error alerting (wa-bridge already
emits Slack-compatible incident alerts via `ALERT_WEBHOOK_URL`); dependency/image scanning; pin all
image tags (already done). Discourse brings its own trust levels, flag queue, and 2FA — enable 2FA
for staff.

**Auth model:** production identity = **Discourse SSO** (email-verified signup, native sessions,
invite-only "desi check"). The prototype's cookie-session + demo logins are demo-only and are
replaced by Discourse in production.
