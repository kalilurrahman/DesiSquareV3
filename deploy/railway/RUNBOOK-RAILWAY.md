# Railway runbook — DesiSquare demo (Path A) and hybrid (Path B)

> Prereqs: a Railway account (`railway.com`), the Railway CLI (`npm i -g @railway/cli && railway login`) or just the dashboard, and this repo checked out. **For real signup emails you need the Pro plan ($20/mo — Railway blocks outbound SMTP on Free/Trial/Hobby) plus a Brevo (free, 300 mails/day) or similar SMTP account.** Without Pro, skip Stage A4 — the 50-user simulation still works because admin-API users are created `active:true` with no email.

---

## Path A — everything on Railway (demo posture)

### A1 · Ghostfolio (app + Postgres + Redis)

One-click: deploy the **Ghostfolio** template — `https://railway.com/deploy/ghostfolio` (template `koSYWQ`; 3 services pre-wired). Or manually:

1. New project → add **PostgreSQL** and **Redis** from the database catalog.
2. Add a service from Docker image `ghostfolio/ghostfolio:latest`; set variables from `env/ghostfolio.env.sample`:
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}` (append `?connect_timeout=300&sslmode=prefer` if absent)
   - `REDIS_HOST=${{Redis.REDISHOST}}` · `REDIS_PORT=${{Redis.REDISPORT}}` · `REDIS_PASSWORD=${{Redis.REDISPASSWORD}}`
   - `ACCESS_TOKEN_SALT=$(openssl rand -hex 16)` · `JWT_SECRET_KEY=$(openssl rand -hex 32)`
   - `PORT=3333` · `ROOT_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`
3. Service settings: generate a public domain, target port **3333**, healthcheck path **`/api/v1/health`** (the root path 302-redirects — don't healthcheck `/`). Prisma migrations + seed run automatically on boot.
4. **Claim admin immediately** (first registrant = ADMIN, token shown once):
   ```bash
   curl -s -X POST https://<ghostfolio-domain>/api/v1/user   # → { accessToken, authToken, role: "ADMIN" }
   ```
   Store `accessToken` (it IS the login credential). Fresh bearer any time:
   ```bash
   curl -s -X POST https://<ghostfolio-domain>/api/v1/auth/anonymous \
     -H 'Content-Type: application/json' -d '{"accessToken":"<token>"}'
   ```
5. Seed demo holdings (percent-friendly demo set):
   ```bash
   curl -s -X POST https://<ghostfolio-domain>/api/v1/import \
     -H "Authorization: Bearer $AUTH" -H 'Content-Type: application/json' -d '{
       "activities": [
         {"currency":"USD","dataSource":"YAHOO","date":"2024-01-15T00:00:00.000Z","fee":1,"quantity":10,"symbol":"VTI","type":"BUY","unitPrice":235.40},
         {"currency":"USD","dataSource":"YAHOO","date":"2024-06-03T00:00:00.000Z","fee":0,"quantity":4,"symbol":"MSFT","type":"BUY","unitPrice":413.50},
         {"currency":"USD","dataSource":"YAHOO","date":"2025-02-10T00:00:00.000Z","fee":1,"quantity":6,"symbol":"NVDA","type":"BUY","unitPrice":128.20}
       ]}'
   ```
   Then in the admin panel, **disable open signups** (demo hygiene) — DesiSquare provisions accounts via gf-provisioner in production.
   *Gotcha (old workspaces):* Railway private networking was IPv6-only before 2025-10-16; Ghostfolio's Redis client is IPv4-first. In an old environment, use the Redis **public** host/port vars instead of `.railway.internal`.

### A2 · Discourse (web + sidekiq + Postgres + Redis)

Eyes open: image is `bitnamilegacy/discourse:3.5.0-debian-12-r0` — frozen (see README). Demo only.

One-click: **Discourse** template — `https://railway.com/deploy/discourse` (4 services: Postgres w/ volume, Redis, Discourse, Sidekiq; admin seeded from `DISCOURSE_USERNAME`/`DISCOURSE_PASSWORD`). Or manually:

1. Same project → add **PostgreSQL** (needs `hstore`/`pg_trgm`; Railway's default postgres-ssl image ships contrib — Discourse migrations create them) and **Redis**.
2. Service **discourse-web** from image `docker.io/bitnamilegacy/discourse:3.5.0-debian-12-r0`; variables from `env/discourse-web.env.sample`. Essentials:
   - `DISCOURSE_HOST` = the service's public domain (exactly; wrong host = redirect loops)
   - `DISCOURSE_DATABASE_*` / `DISCOURSE_REDIS_*` from the DB services (private hostnames)
   - `DISCOURSE_USERNAME` / `DISCOURSE_PASSWORD` / `DISCOURSE_EMAIL` — the seeded admin
   - `RAILWAY_RUN_UID=0`; attach a volume at `/bitnami/discourse` (web only)
   - target port **3000**. First deploy precompiles assets: **10–20+ min**, RAM spike — let it finish.
3. Service **discourse-sidekiq** from the **same image**, same variables (`env/discourse-sidekiq.env.sample`), start command:
   `/opt/bitnami/scripts/discourse/entrypoint.sh /opt/bitnami/scripts/discourse-sidekiq/run.sh` — no public domain, no volume.
4. **Uploads → S3-compatible storage** (required for anything beyond a screenshot demo — web and sidekiq cannot share a Railway volume): set `DISCOURSE_USE_S3=true` + `DISCOURSE_S3_*` (Cloudflare R2 works; set `DISCOURSE_S3_ENDPOINT`).
5. Log in as the seeded admin → **Admin → Settings**, apply the DesiSquare posture (mirrors runbook `docs/runbooks/demo-install-01-discourse.md` stages 5–8C):
   - `login_required` ✅ · `invite_only` ✅ (the #7-A gate — UC10 asserts this)
   - `enable_user_status` ✅ · `chat_enabled` ✅ · `discourse_reactions_enabled` ✅ (+ pill config per Stage 6)
   - `solved_enabled` + `allow_solved_on_all_topics` ✅ · `discourse_gamification_enabled` ✅ (Stage 8C)
   - top_menu: `hot|latest|new|unread|categories` (Stage 8)
   - *(The simulation's structure phase sets the settings it needs via API and pre-creates categories + the label tag group — manual clicking optional.)*

### A3 · Global admin API key + the 50-user community test

1. **Admin → Advanced → API keys → New**: User Level **All Users**, Scope **Global** (unscoped — granular global keys 403 on some endpoints). Copy once.
2. Optional (faster seeding): service variable `DISCOURSE_MAX_ADMIN_API_REQS_PER_MINUTE=200` on **both** discourse services, redeploy; revert after. Default pacing (1.3 s/call) finishes in ~25–35 min without it.
3. Run the simulation + acceptance suite from any machine (or a Claude Code session):
   ```bash
   DISCOURSE_URL=https://<discourse-domain> DISCOURSE_API_KEY=<key> node test/community-sim/run.mjs
   ```
4. Read `test/community-sim/report/DesiSquare-50-user-test-report.md` — expect UC10 to PASS only after `login_required` is on, and UC8 only with Solved enabled. Moderate the two seeded flags from `/review` to demo the queue.

### A4 · Real signup emails (Pro plan only)

1. Upgrade the workspace to **Pro**; redeploy the Discourse services (SMTP egress unblocks on redeploy).
2. Brevo (free): create account → **SMTP & API → SMTP tab** → generate an **SMTP key** (`xsmtpsib-…` — *not* an `xkeysib-` API key; that's the #1 auth failure). Authenticate your sending domain (brevo-code TXT + `mail._domainkey` DKIM TXT; DMARC `p=none` recommended).
3. Discourse-web + sidekiq variables: `DISCOURSE_SMTP_HOST=smtp-relay.brevo.com` · `DISCOURSE_SMTP_PORT_NUMBER=587` · `DISCOURSE_SMTP_PROTOCOL=tls` · `DISCOURSE_SMTP_AUTH=login` · `DISCOURSE_SMTP_USER=<brevo smtp login>` · `DISCOURSE_SMTP_PASSWORD=<xsmtpsib key>`, notification email on the authenticated domain.
4. Verify: invite yourself from the admin panel; the invite email must land in a real inbox. Now **actual users can sign up** through the invite gate (`DSQ-2026` flow) with working activation emails. Free tier caps at 300 mails/day — watch digests.

### A5 · Teardown

Delete the Railway project (or the Discourse services only, keeping Ghostfolio). Nothing else to unwind.

---

## Path B — hybrid (recommended beyond the demo)

1. **Ghostfolio on Railway** — exactly Stage A1. This is durable; keep it.
2. **Discourse on the GCP VM** — follow `deploy/gcp/CLAUDE.md` DEMO mode (sslip.io, ~1 hour, no domain) or `deploy/gcp/RUNBOOK.md` for production. You get the official launcher (supported upgrades), the **full** v3 plugin set including discourse-ai, real SMTP without a Railway plan change, and the runbook stages 1–10 + 8C.
3. **wa-bridge**: runs on the GCP apps VM per the compose file — or as a third Railway service from `deploy/gcp/wa-bridge/` (it's a plain Node service; set the env from `deploy/gcp/apps-stack/.env.sample`).
4. Cross-link the surfaces (F3.7 in `deploy/gcp/REQUIREMENTS.md`): Discourse header link → Ghostfolio's Railway domain; Ghostfolio ROOT_URL page links back to the community.
5. Run the same A3 simulation against the GCP Discourse.

---

## Acceptance (mirrors `deploy/gcp/REQUIREMENTS.md` style)

| ID | Check | Pass looks like |
|---|---|---|
| R-A1 | Ghostfolio healthy | `GET /api/v1/health` 200; admin claimed; holdings render |
| R-A2 | Discourse web+sidekiq up | site loads over HTTPS; admin login; Sidekiq queue draining (`/sidekiq`) |
| R-A3 | DesiSquare posture | `login_required` on → anonymous `/latest.json` 403 (UC10) |
| R-A4 | Community test | `test/community-sim` run: 14/14 PASS (UC8 WARN allowed until Solved enabled) |
| R-A5 | Signups (Pro only) | invite email received in inbox; new user activates and posts |
| R-A6 | Flag pipeline | `/review` shows the 2 seeded flagged posts; Remove/Dismiss work |
