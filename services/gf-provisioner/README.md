# gf-provisioner (Script 2 — Ghostfolio provisioner) · Phase 2

On Discourse registration (verified email) it **creates/links a Ghostfolio account**, serves a
**portfolio summary** for the profile card, and mints a **single-click SSO deep-link**. Covers the
Phase-2 tickets around Ghostfolio provisioning, the profile portfolio card, and SSO.

**Zero runtime dependencies.** The Ghostfolio client sits behind a seam (`src/ghostfolio.js`): it
runs **mocked/offline** by default, or against a **real self-hosted Ghostfolio** in live mode.
The live methods are **implemented and verified against Ghostfolio v3.21.0** (create anonymous user,
exchange the per-user security token for a JWT, read `portfolio/details` + `portfolio/performance`).

## Run against a real Ghostfolio (local, no external account)
```bash
# 1. Bring up a local Ghostfolio (its own Postgres + Redis; secrets in a git-ignored .env)
cd services/ghostfolio && docker compose up -d      # http://localhost:3333  (~1 min first boot)
# 2. Point the provisioner at it and enable live mode (.env)
#    GHOSTFOLIO_URL=http://localhost:3333
#    GHOSTFOLIO_LIVE=true
cd ../gf-provisioner && npm start                    # /health -> "mode":"live"
# 3. Provision + read a real portfolio
curl -X POST localhost:8789/provision -H 'Content-Type: application/json' \
  -d '{"userId":1001,"username":"anita","email":"anita@example.com"}'   # -> real GF user UUID
curl localhost:8789/portfolio/1001/summary                              # -> real value/allocation
```

## Run
```bash
cd services/gf-provisioner
npm test            # unit tests (8)
npm run smoke       # offline: register -> provision -> summary -> SSO link
npm start           # http://localhost:8789  (mock mode with no keys)
```

## Exercise it without Discourse/Ghostfolio
```bash
# provision a user directly (dev)
curl -X POST localhost:8789/provision -H 'Content-Type: application/json' \
  -d '{"userId":42,"username":"rohit","email":"rohit@example.com"}'
# portfolio summary the profile card renders
curl localhost:8789/portfolio/42/summary
# single-click Ghostfolio login link (mint) -> { token, url, expiresAt }
curl localhost:8789/sso/42
# opening url (…/sso/click?sso=<token>) in a browser logs the user straight into Ghostfolio
```

## Single-click SSO (exchange-at-click) — implemented + browser-verified
Ghostfolio has no URL-param SSO, so `GET /sso/:userId` returns a short-lived HMAC token whose `url`
points back at **our own** `GET /sso/click?sso=<token>`. At click time the middleware:
1. verifies the token (HMAC + expiry) and resolves the linked Ghostfolio account;
2. exchanges the account's **stored** per-user security token for a fresh Ghostfolio JWT
   (`POST /api/v1/auth/anonymous`) — the security token never leaves the server;
3. **302-redirects into Ghostfolio's own OAuth-callback route** `/{lang}/auth/:jwt`, which persists
   the JWT client-side and lands the user on their dashboard — **no Ghostfolio changes required**.

Bad/expired tokens render a small branded notice (410/401). Verified end-to-end against a live local
Ghostfolio v3.21.0 in a real browser: one click → authenticated dashboard for the correct account.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | status + mode + linked accounts |
| POST | `/discourse/webhook` | user_created/user_confirmed_email → provision (HMAC-verified) |
| GET | `/portfolio/:userId/summary` | value + allocation + performance for the profile card |
| GET | `/sso/:userId` | mint a short-lived signed single-click login link |
| GET | `/sso/click?sso=<token>` | verify token → exchange for JWT → redirect into Ghostfolio (login) |
| POST | `/provision` | DEV: provision directly |

## Design guarantees (already enforced in the stub)
- **Verified-email only** — unverified users are skipped.
- **Idempotent** create-or-link by `userId` and by `email` (a repeat webhook won't double-create).
- **SSO** tokens are HMAC-signed + short-lived (`SSO_TTL_SECONDS`); tampering/expiry fail verification.
- Summary is a clean serializer the Discourse theme can render without touching Ghostfolio directly.

## To productionise
1. ✅ **Done** — `src/ghostfolio.js` `live` methods are implemented + verified against Ghostfolio
   v3.21.0 (account create, per-user security-token → JWT, read holdings/performance/allocation).
2. Move `src/store.js` to a Postgres `identity_link` table (the file store is per-process).
3. ✅ **Done (local)** — the Discourse webhook (`user_created` + `user_confirmed_email`) is registered
   at `/discourse/webhook` with `DISCOURSE_WEBHOOK_SECRET` (see `discourse/setup` config-as-code).
4. ✅ **Done** — single-click SSO via the exchange-at-click middleware (`GET /sso/click`): verifies the
   HMAC token, swaps the stored security token for a JWT, and redirects into Ghostfolio's own
   `/{lang}/auth/:jwt` callback. Browser-verified against v3.21.0 (see "Single-click SSO" above).
