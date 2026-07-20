# Ghostfolio Demo-Server Install Runbook — DesiSquare (`app.example.com`)

> **BiGMo Consulting · DesiSquare demo pack · 19 Jul 2026.** Researched against official documentation (July 2026) and adversarially fact-checked; verifier corrections are folded in. Companion docs: `demo-install-00-overview.md` for topology and install order.

**Scope:** single Ubuntu 24.04 VPS (4–8 GB, e.g. Hetzner CPX31/41) that also hosts Discourse (`community.example.com`). Docker Engine + compose plugin already installed. This is a DEMO deployment, not production-HA. Verified against the official repo on 2026-07-19; latest release **3.29.0** (2026-07-18).

---

## 1. Prerequisites and DNS

1.1 Verify Docker and the compose plugin:

```bash
docker --version && docker compose version
```

Expect Docker ≥ 24 and `Docker Compose version v2.x`. If `docker compose` is missing: `sudo apt-get install docker-compose-plugin`.

1.2 DNS: create an **A record** `app.example.com` → VPS public IPv4 (and AAAA if you have IPv6), alongside the existing `community.example.com` record. TTL 300 for the demo.

```bash
dig +short app.example.com   # must return the VPS IP before you request TLS certs
```

1.3 Check free memory and ports. Ghostfolio (app + Postgres + Redis) needs roughly 1–1.5 GB on top of Discourse:

```bash
free -h
sudo ss -tlnp | grep -E ':(80|443|3333|5432|6379)\b'
```

Nothing on the host should already listen on 3333. Postgres/Redis will NOT be published to the host at all (compose-internal network), so a Discourse-bundled Postgres/Redis does not conflict.

**Checkpoint:** DNS resolves, port 3333 free, ≥1.5 GB RAM available.

---

## 2. Files: docker-compose.yml and .env

2.1 Create the directory layout. The official compose file lives in `docker/` and references `../.env`, so keep that shape:

```bash
sudo mkdir -p /opt/ghostfolio/docker
cd /opt/ghostfolio
curl -fsSLo docker/docker-compose.yml \
  https://raw.githubusercontent.com/ghostfolio/ghostfolio/main/docker/docker-compose.yml
```

2.2 The official file (verbatim from `docker/docker-compose.yml` on `main`) defines **three services**:

```yaml
name: ghostfolio
services:
  ghostfolio:
    image: docker.io/ghostfolio/ghostfolio:latest
    container_name: ghostfolio
    restart: unless-stopped
    init: true
    cap_drop: [ALL]
    security_opt: ['no-new-privileges:true']
    env_file: [../.env]
    ports: ['3333:3333']
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ['CMD-SHELL', 'curl -f http://localhost:3333/api/v1/health']
      interval: 10s
      timeout: 5s
      retries: 5

  postgres:
    image: docker.io/library/postgres:15-alpine
    container_name: gf-postgres
    restart: unless-stopped
    cap_drop: [ALL]
    cap_add: [CHOWN, DAC_READ_SEARCH, FOWNER, SETGID, SETUID]
    security_opt: ['no-new-privileges:true']
    env_file: [../.env]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -d "$${POSTGRES_DB}" -U $${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
    volumes: ['postgres:/var/lib/postgresql/data']

  redis:
    image: docker.io/library/redis:alpine
    container_name: gf-redis
    restart: unless-stopped
    user: '999:1000'
    cap_drop: [ALL]
    security_opt: ['no-new-privileges:true']
    env_file: [../.env]
    command:
      - /bin/sh
      - -c
      - redis-server --requirepass "$${REDIS_PASSWORD:?REDIS_PASSWORD variable is not set}"
    healthcheck:
      test: ['CMD-SHELL', 'redis-cli --pass "$${REDIS_PASSWORD}" ping | grep PONG']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres:
```

2.3 Make two edits (pin + don't expose 3333 publicly):

```bash
sed -i 's|ghostfolio/ghostfolio:latest|ghostfolio/ghostfolio:3.29.0|' docker/docker-compose.yml
sed -i "s|- 3333:3333|- 127.0.0.1:3333:3333|" docker/docker-compose.yml
```

- **Why pin `3.29.0` instead of `latest`:** Ghostfolio ships releases almost daily; `latest` means an accidental `docker compose pull` can jump you many versions and run irreversible Prisma migrations at boot. A pinned tag makes upgrades deliberate (snapshot → bump → up, see §8). 3.29.0 is the newest release as of 2026-07-18 — check https://github.com/ghostfolio/ghostfolio/releases and pin whatever is current when you run this.
- **Why `127.0.0.1:3333`:** Caddy terminates TLS; the app must not be reachable on `http://<vps-ip>:3333`.

2.4 Create `/opt/ghostfolio/.env` (modeled on the official `.env.example`, all placeholders filled). Generate secrets first:

```bash
umask 077
cat > /opt/ghostfolio/.env <<EOF
COMPOSE_PROJECT_NAME=ghostfolio

# CACHE
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$(openssl rand -hex 32)

# POSTGRES
POSTGRES_DB=ghostfolio-db
POSTGRES_USER=ghostfolio
POSTGRES_PASSWORD=$(openssl rand -hex 32)

# VARIOUS
ACCESS_TOKEN_SALT=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}?connect_timeout=300

# APP
NODE_ENV=production
HOST=0.0.0.0
PORT=3333
ROOT_URL=https://app.example.com
TRUST_PROXY=1
EOF
chmod 600 /opt/ghostfolio/.env
```

Variable notes (all names verified against `.env.example` + `configuration.service.ts`):

| Var | Required? | Notes |
|---|---|---|
| `COMPOSE_PROJECT_NAME=ghostfolio` | yes (compose) | keeps volume/network names stable (`ghostfolio_postgres`) |
| `ACCESS_TOKEN_SALT` | **required** | random string; salts the per-user security token hash. **Changing it later invalidates every user's security token — never rotate casually.** |
| `JWT_SECRET_KEY` | **required** | random string; signs session JWTs. Rotating logs everyone out (harmless). |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | yes | consumed by the `postgres` container AND interpolated into `DATABASE_URL` |
| `DATABASE_URL` | **required** | exact format `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?connect_timeout=300` — host is the compose service name `postgres`, not localhost. Caveat: `${VAR}` interpolation works via compose `env_file`; if the password contains `@ : / #` you must URL-encode it (hex secrets avoid this). |
| `REDIS_HOST=redis` / `REDIS_PORT=6379` / `REDIS_PASSWORD` | yes | `REDIS_PASSWORD` is mandatory — the redis container refuses to start without it (`:?REDIS_PASSWORD variable is not set`). Optional `REDIS_DB` (default 0). |
| `NODE_ENV=production` | recommended | production mode for the NestJS API |
| `HOST` / `PORT` | optional | defaults `0.0.0.0` / `3333`; keep defaults so the compose port mapping matches |
| `ROOT_URL=https://app.example.com` | yes for us | public origin; used for generated links and as the base of the OIDC callback default (§6) |
| `TRUST_PROXY=1` | yes behind Caddy | Express `trust proxy` setting so rate limiting/logging sees real client IPs instead of Caddy's. `1` = trust exactly one proxy hop. |

**Checkpoint:** `docker compose -f docker/docker-compose.yml config` (run from `/opt/ghostfolio`) renders without warnings and shows the interpolated `DATABASE_URL` and pinned image tag.

---

## 3. First boot, admin user, admin tour

3.1 Start:

```bash
cd /opt/ghostfolio
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

3.2 Migrations: the container entrypoint runs **Prisma schema migrations automatically on boot** (`prisma migrate deploy` before starting the API). Watch:

```bash
docker logs -f ghostfolio
```

You should see migration output followed by the Nest application listening on 3333. First boot takes ~30–60 s.

3.3 Health check (no auth required):

```bash
curl -s http://127.0.0.1:3333/api/v1/health
# → {"status":"OK"}
```

3.4 **Create the FIRST user = admin.** Once Caddy is up (§7 — or temporarily via an SSH tunnel `ssh -L 3333:127.0.0.1:3333 user@vps` and http://localhost:3333):

1. Open `https://app.example.com` → **Get Started** → create account.
2. **The first user automatically gets the `ADMIN` role.** Every later signup is a plain `USER`.
3. The UI displays a **Security Token** (long random string). This IS the account credential — Ghostfolio's default auth has no email/password. **Copy it into the team password manager immediately. There is no recovery flow: lose the token, lose the account** (an admin can delete/recreate users, but the admin's own token is unrecoverable). Tick the "I have saved my security token" confirmation only after actually saving it.
4. Sign-in later = paste token (or the 1-click SSO links that gf-provisioner will mint using stored tokens).

3.5 Admin panel tour — avatar menu → **Admin Control** (visible only to `ADMIN`):
- **Overview:** system stats, user/activity counts, exchange-rate table, buttons to flush the cache and trigger data gathering.
- **Settings:** system properties (currencies to support, coupon/system message toggles, data-provider properties).
- **Market Data:** per-symbol historical data management (§4).
- **Jobs:** the BullMQ queue (data-gathering jobs, status, failed jobs).
- **Users:** list, roles, delete; this is where DesiSquare's `gf-provisioner` results are visible (exactly one account per Discourse signup — verify idempotency here).

**Checkpoint:** health returns `{"status":"OK"}`; you can log out and back in with the saved security token; Admin Control is visible.

---

## 4. Market data (demo defaults)

4.1 **Out of the box, self-hosted Ghostfolio uses keyless free providers:** `YAHOO` (Yahoo Finance — stocks/ETFs/currencies, the default for tickers) and `COINGECKO` (crypto), plus `MANUAL` for user-defined assets. No API key or config needed for the demo; DesiSquare's percent-only `gf-stats` proxy (constraint #8) works fine on these.

4.2 Optional keys later — these are **environment variables in `.env`** (verified in `configuration.service.ts`), then `docker compose up -d` to recreate:

```bash
API_KEY_COINGECKO_DEMO=...          # or API_KEY_COINGECKO_PRO=...
API_KEY_EOD_HISTORICAL_DATA=...     # EOD Historical Data provider
API_KEY_FINANCIAL_MODELING_PREP=... # FMP provider
API_KEY_ALPHA_VANTAGE=...           # Alpha Vantage
```

(Newer builds also surface some provider API keys as editable properties in Admin Control → Settings; the env vars above always work and win for a demo.)

4.3 **Gathering historical data:** after activities exist, go to **Admin Control → Market Data**. Each symbol row shows its data source and coverage; click a symbol → **Gather Historical Data** (or use the Overview buttons to gather all/recent data for everything). Data-gathering also runs on a cron inside the app (`ENABLE_FEATURE_CRON` defaults to `true`). Check **Admin Control → Jobs** for queue progress and failures.

**Checkpoint:** after adding one `MSFT` buy activity (§5), Admin Control → Market Data shows `MSFT (YAHOO)` with historical prices populated, and the portfolio chart renders.

---

## 5. Demo data: activities, CSV import, public link, Zen mode

5.1 Manual: **Portfolio → Activities → “+”** — pick type (BUY / SELL / DIVIDEND / FEE / INTEREST / LIABILITY — the former ITEM type was removed in v2.203.0; user-defined valuables are now BUY activities with DataSource MANUAL), search the symbol (Yahoo lookup), enter date/quantity/unit price/fee, assign an Account (create accounts under **Accounts**, e.g. "Zerodha-US Demo", "401k Demo").

5.2 CSV import: **Portfolio → Activities → Import Activities** (JSON or CSV). Sample **adapted from** `test/import/ok/sample.csv` (the official file has the fee row first, five data rows, and shows that `Code` also accepts an ISIN for YAHOO lookups):

```csv
Date,Code,DataSource,Currency,Price,Quantity,Action,Fee,Note
16-09-2021,MSFT,YAHOO,USD,298.580,5,buy,19.00,My first order
17/11/2021,MSFT,YAHOO,USD,0.62,5,dividend,0.00,
01.01.2022,Penthouse Apartment,MANUAL,USD,500000.0,1,buy,0.00,
01-09-2021,Account Opening Fee,MANUAL,USD,0,0,fee,49,
```

Columns: `Date` (dd-mm-yyyy, dd/mm/yyyy, dd.mm.yyyy or yyyymmdd accepted), `Code` (ticker or free text for MANUAL), `DataSource` (`YAHOO` | `COINGECKO` | `MANUAL`), `Currency`, `Price` (unit price), `Quantity`, `Action` (`buy`/`sell`/`dividend`/`fee`/`interest`), `Fee`, `Note`. The importer previews and validates before committing; total = Quantity × Price.

5.3 **Public sharing link** (this is what maven public profiles proxy through): avatar → **Settings/My Ghostfolio → Access → “+”** → grant type **Public**. Copies a URL like `https://app.example.com/en/p/<access-id>` showing **allocation percentages and performance only — no currency amounts**, which matches DesiSquare constraint #4/#8 natively. Revoke by deleting the access entry.

5.4 **Zen mode:** avatar → **My Ghostfolio → Settings** → toggle the **Zen Mode** switch. This switches the Overview to a distraction-free `/zen` view showing relative performance only — useful for demo screenshots. (The "Appearance" setting on the same page is the light/dark theme, unrelated to Zen Mode.)

**Checkpoint:** CSV import of the sample succeeds; the public `/p/…` link renders in an incognito window with % only.

---

## 6. OIDC (experimental, ≥ 2.222.0)

OIDC login shipped in **2.222.0 (2025-12-07)** as an experimental login provider for self-hosted setups — our pinned 3.29.0 has it. For DesiSquare, Discourse (or a Keycloak in front of it) is the IdP; near-term the demo keeps `gf-provisioner`'s token-minted SSO links and treats OIDC as a stretch goal.

Add to `/opt/ghostfolio/.env` and `docker compose up -d`:

```bash
ENABLE_FEATURE_AUTH_OIDC=true
OIDC_ISSUER=https://idp.example.com/realms/desisquare   # issuer/discovery base
OIDC_CLIENT_ID=ghostfolio
OIDC_CLIENT_SECRET=<from IdP>
# Optional overrides (defaults come from issuer discovery):
# OIDC_AUTHORIZATION_URL=  OIDC_TOKEN_URL=  OIDC_USER_INFO_URL=
# OIDC_SCOPE=["openid"]
# OIDC_CALLBACK_URL defaults to ${ROOT_URL}/api/auth/oidc/callback
```

Register the redirect URI in the IdP exactly as: `https://app.example.com/api/auth/oidc/callback` (this is why `ROOT_URL` must be the public HTTPS origin).

Caveats:
- **Experimental** — behavior may change between releases; re-read the changelog before any upgrade while OIDC is on.
- **Keep `ENABLE_FEATURE_AUTH_TOKEN=true` (its default) as fallback.** If OIDC breaks, the admin security token is your only way back in. Do not disable token auth on the demo.
- OIDC identities and token identities are separate users — decide one canonical path per member or `gf-provisioner`'s "exactly one Ghostfolio account" invariant breaks.

**Checkpoint:** login page shows the OIDC sign-in option; a round-trip login lands back on `https://app.example.com` authenticated; token login still works.

---

## 7. Reverse proxy (Caddy) + TLS

Caddy is the single proxy for both subdomains; it auto-provisions Let's Encrypt certs (ports 80/443 must be free of other listeners — if Discourse was installed with its bundled nginx on 443, rebuild it to expose an internal port or unix socket first).

`/etc/caddy/Caddyfile`:

```caddy
app.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3333
	# Caddy sets X-Forwarded-For / X-Forwarded-Proto / Host automatically,
	# which is what TRUST_PROXY=1 in Ghostfolio consumes.
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
}

community.example.com {
	encode zstd gzip
	# Discourse configured to listen internally, e.g. templates expose 127.0.0.1:8080
	reverse_proxy 127.0.0.1:8080
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
	}
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Checkpoint:** `curl -s https://app.example.com/api/v1/health` → `{"status":"OK"}` with a valid LE cert; `http://` redirects to `https://`; `curl http://<vps-ip>:3333` from outside times out (loopback-only binding).

---

## 8. Backups and pinned upgrades

8.1 Nightly `pg_dump` (the Postgres volume is the only state that matters; `.env` must be backed up once, offline):

```bash
sudo mkdir -p /var/backups/ghostfolio
sudo tee /etc/cron.d/ghostfolio-backup >/dev/null <<'EOF'
15 3 * * * root docker exec gf-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > /var/backups/ghostfolio/gf-$(date +\%F).sql.gz && find /var/backups/ghostfolio -name 'gf-*.sql.gz' -mtime +14 -delete
EOF
```

Restore test (do this once): `gunzip -c gf-<date>.sql.gz | docker exec -i gf-postgres psql -U ghostfolio -d ghostfolio-db`.

8.2 Upgrade procedure (pinned):

```bash
# 1. Snapshot: VPS provider snapshot AND/OR a fresh dump
docker exec gf-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > /var/backups/ghostfolio/pre-upgrade.sql.gz
# 2. Read the release notes between your tag and the target tag
# 3. Bump the tag
sed -i 's|ghostfolio/ghostfolio:3.29.0|ghostfolio/ghostfolio:3.31.0|' /opt/ghostfolio/docker/docker-compose.yml
# 4. Apply — migrations run automatically on boot
cd /opt/ghostfolio && docker compose -f docker/docker-compose.yml up -d
curl -s http://127.0.0.1:3333/api/v1/health
```

8.3 **Rollback note:** Prisma migrations are forward-only. Rolling back = revert the image tag **and restore the pre-upgrade dump** (or the VPS snapshot). Never just downgrade the tag against a migrated database.

---

## 9. Rebrand hook points (reference only — NOT part of the demo install)

The DesiSquare "bounded reskin" later means building a custom image (`docker/docker-compose.build.yml` builds from source). Hook points in the repo:
- `apps/client/src/styles.scss` + `apps/client/src/assets/` — global theme, palette, favicon/PWA icons.
- Logo component under `libs/ui/src/lib/logo/` — swap the Ghostfolio wordmark/SVG.
- App name strings: client `index.html` title, `apps/client/src/app/` shell components, and i18n message files.
- Keep changes to styling/branding only; forking business logic breaks the pinned-upgrade path above. AGPL-3.0 applies: published modified source required if you distribute/serve the modified app.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| App container exits at boot logging that `ACCESS_TOKEN_SALT` / `JWT_SECRET_KEY` is missing | Required env not set / `.env` not found (compose looks for `../.env` relative to `docker/`) | Ensure `/opt/ghostfolio/.env` exists with both vars; run compose from `/opt/ghostfolio`; `docker compose config` to verify interpolation |
| `redis` container restart-loops: `REDIS_PASSWORD variable is not set` | Empty `REDIS_PASSWORD` | Set it in `.env`; recreate: `docker compose up -d --force-recreate redis ghostfolio` |
| Boot fails with Prisma error `P1001: Can't reach database server at postgres:5432` | Wrong `DATABASE_URL` host (must be `postgres`), or postgres unhealthy | `docker logs gf-postgres`; confirm URL format `postgresql://user:pass@postgres:5432/db?connect_timeout=300`; special chars in password must be URL-encoded |
| Prisma migration error `P3009 / migrate found failed migrations` after an upgrade | Interrupted upgrade or version skipped too far | Restore pre-upgrade dump, return to previous tag, upgrade stepwise through releases |
| Postgres logs `FATAL: password authentication failed` after changing `POSTGRES_PASSWORD` | The DB was initialized with the old password; env change alone doesn't alter it | Either restore old value, or `ALTER USER` inside the container, or wipe the `ghostfolio_postgres` volume (demo-only, destroys data) |
| Quotes/history missing, logs show Yahoo HTTP 401/429 | Yahoo Finance rate limiting / crumb issues (keyless provider, best-effort) | Wait and re-run Gather in Admin Control → Market Data; reduce symbol count; consider `API_KEY_EOD_HISTORICAL_DATA` or `API_KEY_FINANCIAL_MODELING_PREP`; check Admin Control → Jobs for failed jobs |
| `NOAUTH Authentication required` / `WRONGPASS` in app logs | App's `REDIS_PASSWORD` differs from the one redis started with | Align `.env`, recreate both containers |
| `Bind for 0.0.0.0:3333 failed: port is already allocated` | Another service (or an old ghostfolio container) owns 3333 | `sudo ss -tlnp | grep 3333`; remove stale container or change the left side of the `ports:` mapping and the Caddy upstream |
| Health OK on 127.0.0.1 but `app.example.com` 502 | Caddy upstream mismatch or app bound to a different HOST/PORT | Confirm `ports: 127.0.0.1:3333:3333`, `reverse_proxy 127.0.0.1:3333`, `HOST=0.0.0.0` inside container |
| Rate limiting bans everyone at once / wrong client IPs in logs | `TRUST_PROXY` unset behind Caddy | `TRUST_PROXY=1` in `.env`, recreate the app container |
| Security token lost | No recovery flow exists by design | Admin: delete + recreate the user (data lost). Admin's own account: no recovery — restore DB from backup or start over. Store tokens in the password manager at creation time |

---

## Sources (official)

- https://github.com/ghostfolio/ghostfolio — README (self-hosting, env vars, upgrade, health check)
- https://github.com/ghostfolio/ghostfolio/blob/main/docker/docker-compose.yml — official compose file (fetched verbatim 2026-07-19)
- https://github.com/ghostfolio/ghostfolio/blob/main/.env.example — official env template
- https://github.com/ghostfolio/ghostfolio/blob/main/apps/api/src/services/configuration/configuration.service.ts — authoritative env-var list (`API_KEY_*`, `OIDC_*`, `ENABLE_FEATURE_*`, `TRUST_PROXY`, `ROOT_URL`)
- https://github.com/ghostfolio/ghostfolio/releases — release tags (3.29.0, 2026-07-18)
- https://github.com/ghostfolio/ghostfolio/blob/main/test/import/ok/sample.csv — official CSV import sample
- https://ghostfol.io/en/about/changelog — 2.222.0 OIDC introduction (2025-12-07)
