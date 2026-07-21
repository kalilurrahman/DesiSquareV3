# Security & Compliance Posture — DesiSquare V3 ("The Living Square")

| Field | Value |
|---|---|
| Document | Security & Compliance Posture (CTO / security-grade) |
| Product | DesiSquare V3 — a pseudonymous, educational community for the desi retail-investor diaspora on Discourse + Ghostfolio + WhatsApp + the v4 app + sidecar services |
| Version | 1.0 |
| Status | Approved for pilot (F5 hardening applies before launch) |
| Owner | Engineering / Security (rahman.kalilur@outlook.com) |
| Date | 2026-07-21 |
| Classification | Internal — no secrets, no member data |
| Companion documents | `docs/TRD-desisquare.md` (§8 security architecture — this doc aligns with it), `deploy/gcp/RUNBOOK.md` (Day 4-5 hardening), `deploy/PRODUCTION-DEPLOYMENT-GUIDE.md` (Phase F5), `deploy/gcp/whatsapp/WHATSAPP-SETUP.md`, `docs/gf-stats-contract/README.md` (percent-only strip) |

## Scope & summary

This document is the security and privacy posture for the DesiSquare production stack: the branded **v4 forum/API** (zero-dependency Node), the three **sidecar services** (wa-bridge, gf-provisioner, models-service + the gf-stats contract boundary), the two upstream products **Discourse** (community) and **Ghostfolio** (portfolio), and the **Meta WhatsApp Cloud API** channel — all deployed on **two GCP VMs behind Caddy** with secrets in **GCP Secret Manager** and nightly offsite backups to **GCS**. It covers the product-constraint control matrix, platform hardening, identity & access, data protection & privacy, WhatsApp/messaging compliance, backups & disaster recovery, monitoring & incident response, vulnerability & dependency posture, and a compliance & audit-readiness checklist.

**Posture statement.** DesiSquare's security model is *privacy-by-construction*: the six non-negotiable product constraints are enforced at the code and pipeline layer (default-deny auth gate, percent-only performance index, phone-stripping on write, whitelist serializer at the money boundary), backed by a machine leak-sweep in CI — so a misconfiguration degrades to *less* data exposure, never more, and the demo runs standalone with no live secrets.

Out of scope: legal advice (per-corridor privacy regimes are framed as *considerations requiring counsel sign-off*, §5.4), formal SOC 2 / ISO 27001 certification (the checklist in §10 is a pragmatic pilot-altitude mapping, not an attestation), and the F6 scale-out topology (Cloud Run / Cloud SQL / GKE) which is explicitly beyond the F0–F5 pilot.

---

## 1. Threat model at a glance

| Asset | Primary threats | Principal mitigations |
|---|---|---|
| Member portfolio dollar values | Leak to public/maven surfaces; scraping | Percent-only pipeline (index 100@inception); owner-only `#/me`; gf-stats whitelist serializer; leak-sweep CI (#4/#8) |
| Member phone numbers (E.164) | Exposure via posts, logs, API payloads | `stripPhoneNumbers` on write; phone-as-map-key only; salted-hash logs; `member-XXXX` pseudonym (#5) |
| Member identity / pseudonymity | De-anonymisation; correlation of handle→person | No all-digit handles; email admin-only; no real names in any member serializer |
| Anonymous access to member data | Scraping the community without an account | Default-deny dispatcher gate (401/403); Discourse `login_required`; only 5 public routes (#7-A) |
| Moderation integrity | Public exposure of who-flagged-whom; retaliation | Private flag store; mod-gated review queue; moderation events never record the flagger (#3) |
| Session / credential theft | Cookie theft, XSS, brute force, offline crack | HttpOnly + SameSite=Lax cookie; scrypt hashing; `timingSafeEqual`; server-side session table |
| Webhook forgery | Spoofed Discourse/WhatsApp callbacks | HMAC over raw body (`X-Hub-Signature-256` / `X-Discourse-Event-Signature`); constant-time compare |
| Supply-chain compromise | Malicious dependency in the integration layer | Zero-dependency stdlib Node (empty `dependencies` map); no build step; optional backends behind opt-in seams |
| Infrastructure compromise | Public SSH, open ports, secret leakage | IAP-only SSH (no public :22); firewall 80/443 only; Secret Manager; `.env` mode 600; unattended-upgrades |

---

## 2. Product-constraint control matrix

The six non-negotiable product constraints are treated as **security and privacy controls**, each with an enforcement point in a named component/layer and a verification/evidence check. This is the security-lens restatement of TRD §1 and §8.

| # | Constraint (control statement) | Enforcement point (component / layer) | Verification / evidence |
|---|---|---|---|
| **#3** | **Flags are private.** Five reasons route to a moderator review queue; no public flag indicator ever renders, and moderation actions never record who flagged. | v4 API: `POST /api/posts/:id/flag` writes to `reviewQueue` only; `myFlagFor` returns the viewer's own flag or `null`; `/api/review-queue*` is mod/admin-gated; `mod_remove` event logs the action, never the flagger. Upstream: Discourse native flag/review queue (F2). | `privacy.test.js` + community-sim **UC9** (private-flag → review queue, no public indicator); dispatcher denies `/api/review-queue` to non-mods (403). |
| **#4** | **Portfolio dollars are owner-only.** Public surfaces show allocation **%** only, default private. | v4 API: `GET /api/users/:id` branches owner → value / public → allocation-% / private; `meVM`/`authorCard` never carry a value field; gf-provisioner strips value for non-owner viewers. Owner dollar view is confined to `#/me`. | `leak-sweep.test.mjs` (story 12.5); browser assertion `/[$₹£]\d/` never matches on public/maven surfaces; F3 acceptance `node docs/gf-stats-contract/leak-sweep.test.mjs`. |
| **#5** | **WhatsApp consent-gated; E.164 never displayed.** Mirroring and notifications require opt-in; phone numbers never appear on any surface, endpoint, post, or log. | wa-bridge: phone is a private map key only, never echoed; logs use a salted hash; sender pseudonymised to `member-XXXX`. v4: `stripPhoneNumbers` on every write; consent checks in `createMirroredPost` / `notifyWhatsApp` / `syncWaConsent`; demo phones are server-side `+1-555` only. | community-sim **UC11** (no E.164/emails in payloads); `privacy.test.js` E.164 sweep; F4.4 acceptance (topic sender `member-XXXX`, no E.164). |
| **#7-A** | **Anonymous → curated teaser only.** Every member endpoint 401/403s anonymously — including chat, presence, search, events. | v4 dispatcher **auth gate** (`api.mjs`): `route.auth` **defaults `true`**; only `session`, `register`, `bootstrap`, `teaser`, `health` are `auth:false`. Upstream: Discourse `login_required = on`. | dispatcher returns `401 {"error":"sign in first"}` for all other routes; community-sim **UC10** (signed-out member endpoints 403); F2.8 anonymous `GET /latest.json` → 403/redirect. |
| **#8** | **Maven performance is percent-only.** Currency is stripped **server-side** at the Ghostfolio boundary; no currency-typed field leaves the server. | gf-stats whitelist serializer `toMavenStats()` (explicit picks, allowlisted keys, `*_pct`/ratio/month-count numerics only, forbidden key vocabulary + value patterns); percent index (100@inception) in models-service; inline `/[$₹£]\s?\d/` guard on any live feed. | `leak-sweep.test.mjs` on the **golden** example **and** a **poisoned** Ghostfolio fixture (proves upstream drift is stripped); runs in CI (story 12.5) and each release. |
| **#9** | **Recognition ranks engagement, never money.** No leaderboard/badge/trending surface may read portfolio data or % returns. | v4: `karmaFor()` sums reaction weights only (fixed 4-pill set); `/api/leaderboard` and search rank karma; removed content grants no karma; no self-reaction; `GET /api/karma/rules` is sourced from the same constants that award karma (can't drift). | community-sim **UC14** (engagement leaderboard derivable, never money); karma-rules response asserts "never uses portfolio value or returns". |

**Cross-cutting control — educational positioning.** Every content surface carries a persistent *"community discussion / educational — not investment advice"* disclaimer (story 11.1); the gf-stats client contract additionally requires *"Past performance is not indicative of future results"* on any surface rendering performance fields. This is a compliance control (see §10), not merely copy.

---

## 3. Platform hardening controls

The hardening baseline is the F5 security audit (`deploy/PRODUCTION-DEPLOYMENT-GUIDE.md` §9, `deploy/gcp/RUNBOOK.md` Day 4-5). Grouped by layer:

### 3.1 Network

| Control | How implemented | Verify |
|---|---|---|
| Only 80/443 exposed | Firewall rule `allow-web`: `tcp:80,tcp:443` to target tag `web`; no rule opens 22 to `0.0.0.0/0` | `gcloud compute firewall-rules list` — 80/443 to `web`, no public 22 |
| SSH via IAP only | `allow-iap-ssh`: `tcp:22` from `35.235.240.0/20` (Google IAP range) only; VMs use `--tunnel-through-iap` | `gcloud compute ssh <vm> --tunnel-through-iap -- true` → exit 0; port 22 unreachable from the public internet |
| OS Login | VMs created with `enable-oslogin=TRUE` (IAM-controlled SSH keys, no static key sprawl) | Instance metadata shows `enable-oslogin: TRUE` |
| Network segmentation | Discourse on its own VM (`discourse-1`); apps/services/Ghostfolio share `apps-1`; inter-service calls are container-internal (`http://gf-provisioner:8789` etc.), never public | Only Caddy (`:80/:443`) is internet-facing on `apps-1` |

### 3.2 Transport

| Control | How implemented | Verify |
|---|---|---|
| TLS everywhere | Caddy terminates TLS for `app.` / `folio.` / `wa.` with automatic Let's Encrypt certs (works with sslip.io in demo); Discourse manages its own LE cert for `community.` | `curl -sI https://<host>` → 200 with a valid cert on all four hostnames |
| Force HTTPS | Discourse `force_https = on`; Caddy redirects 80→443 | Admin → Settings `force_https` enabled; F2.7 acceptance |
| Webhook TLS verify | Discourse webhook configured with **TLS verify: on** | Webhook config screen (F2.6) |
| No body re-serialization | Caddy passes the raw request body through untouched so the WhatsApp HMAC (over raw bytes) verifies | F4 troubleshooting: signature check passes through Caddy |

### 3.3 Secrets

| Control | How implemented | Verify |
|---|---|---|
| Source of truth | GCP Secret Manager holds the Meta system-user token, Discourse API key, webhook secret, bridge API key (F5.5) | `gcloud secrets list` shows all of them |
| Runtime copy locked down | `.env` lives only on the VM at mode **600**; never committed (`.gitignore` covers `.env` and `data/db.json`) | `stat -c '%a' /opt/desisquare/.env` → `600` |
| Auto-generated secrets | First run of `03-apps-vm-setup.sh` generates `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ACCESS_TOKEN_SALT`, `JWT_SECRET_KEY`, `BRIDGE_API_KEY`, `WEBHOOK_VERIFY_TOKEN` with `openssl rand` | Secrets are high-entropy random, not defaults |
| No secrets in code/logs/docs | Docs use placeholders only; gf-stats logs status+timing, never payload bodies; the `events` ring buffer never records phone numbers | Grep of repo for secret patterns; leak-sweep of logs |
| Empty HMAC secret forbidden | An empty `DISCOURSE_WEBHOOK_SECRET` disables HMAC verification and is explicitly forbidden in production (F5.6) | Secret non-empty on Discourse **and** both sidecar scripts |

### 3.4 Host

| Control | How implemented | Verify |
|---|---|---|
| Automatic OS patching | `unattended-upgrades` (Ubuntu 24.04 LTS default) active on both VMs; reboot in a quiet window when required | F5.6 audit — `unattended-upgrades` active |
| Minimal package surface | VMs run only Docker + the stack; Discourse/Ghostfolio/Postgres/Redis in containers; no ad-hoc packages | Package inventory on each VM |
| Swap sizing | 2 GB swap on discourse-1 (Discourse launcher requirement) | `swapon --show` |
| Least-privilege service account | Compute default SA granted only `storage.objectAdmin` on the backups bucket | `gsutil iam get gs://<project>-backups` |

### 3.5 Application

| Control | How implemented | Verify |
|---|---|---|
| Webhook HMAC | All inbound webhooks HMAC-verified over the **raw** body: WhatsApp `X-Hub-Signature-256` (Meta app secret), Discourse `sha256=` in `X-Discourse-Event-Signature`; compared with constant-time `safeEqual`/`timingSafeEqual` | Tampered payload → 401 (F4.3); `hmacSha256Hex` = `createHmac('sha256', secret)` in `v4/src/util.mjs` |
| Session cookie flags | `Set-Cookie: dsq_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600` (14 days). HttpOnly blocks JS access (XSS token theft); SameSite=Lax mitigates CSRF; sign-out sets `Max-Age=0` | `v4/src/api.mjs` `setHeader('set-cookie', …)`; `robustness.test.js` cookie-fault cases |
| Session tokens | 24-byte random hex (`randomBytes(24)`), server-side `sessions` table maps token→`{userId, createdAt}` | `newToken()` in `v4/src/util.mjs` |
| Password hashing | scrypt via `node:crypto`: `scrypt$<salt>$<hash>`, 16-byte per-user random salt, 64-byte hash, verified with `timingSafeEqual`. Demo personas carry **no** `passwordHash` (can't be password-logged-in) | `hashPassword`/`verifyPassword` in `v4/src/util.mjs` |
| Default-deny auth | Dispatcher gate: any route with `auth`/`mod`/`admin` requires a session (401) then group membership (403); `auth` defaults `true` so a new route is private-by-default | `api.mjs` dispatcher (`if (r.auth \|\| r.mod \|\| r.admin) …`) |
| Request-body cap | `readBody` caps bodies at **256 KB** (rejects oversized input); malformed JSON → 400; malformed `%`-escape in a path → clean 404, never a crash | `readBody(req, limit = 256*1024)`; `robustness.test.js` oversized-body case |
| No-store on API responses | The `json()` helper sets `Cache-Control: no-store` on every API response so member data is never cached by intermediaries | `json()` in `v4/src/util.mjs` |
| Output encoding | `escapeHtml` on rendered strings; SPA renders by string concatenation with no external network requests (tight CSP-friendly surface) | `escapeHtml` in `v4/src/util.mjs` |
| Zero-dependency = minimal supply chain | Every service has an empty `dependencies` map; HTTP/crypto/test/persistence are all Node stdlib; heavy optional backends sit behind opt-in `dynamic import()` seams | `package.json` dependencies empty; `make install` only checks Node version |

---

## 4. Identity & access management

### 4.1 Pseudonymity as a first-class control

- Handles are the pseudonymous identity (`quiet_lotus`, `nikhil_cfa`, `desisquare_mod`). Registration **rejects all-digit handles** so nothing that reads like a phone number can become a username.
- Member view-models (`authorCard`, `meVM`) never carry `email` or phone. `email` is stored on the user record but leaves only via explicitly admin-scoped serializers (`adminUserSummary`).
- E.164 numbers are never displayed anywhere; WhatsApp senders surface as `member-XXXX` (§6).
- Real names are never collected or rendered on member surfaces.

### 4.2 Roles and capabilities

| Role (v4 group) | Can do | Cannot do |
|---|---|---|
| **member** | Read feed/posts/search/profiles/calendar (authenticated); create posts/comments; toggle the 4 reactions; private-flag; manage own settings/consent/portfolio visibility; open own Ghostfolio via 1-click SSO; view own dollar values at `#/me` | See others' dollar values; see who flagged; access review queue or admin surfaces; react to own posts |
| **maven** | Everything a member can, plus a **percent-only** performance proof surface (opt-in, consent-gated via gf-stats `perf_sharing`); carries a `credential` (e.g. CFA) | Expose currency; be ranked by returns; bypass the percent-only serializer |
| **moderator** | Read/resolve the flag review queue; remove content (`banDays` suspension); manage calendar events | See the flagger's identity in logs; grant/revoke roles; see member emails; view portfolio dollars |
| **admin** | Role grant/revoke (`mavens`/`moderators`/`admins` + credential); space & content administration; admin overview/users — **the single place `email` may appear** | Nothing that would leak portfolio dollars or E.164; overriding percent-only or the flag-privacy rules (structurally enforced) |

Admin least-privilege: the admin overview/users endpoints are the *only* member-facing path where email appears, and that path is `admin`-gated in the dispatcher. Discourse staff accounts must have **2FA enabled** (F5.6). Ghostfolio's first user becomes admin; its security token is stored in the vault/Secret Manager and is **unrecoverable** if lost.

### 4.3 Discourse trust levels

Discourse's native trust-level system (TL0 new → TL4 leader) governs upstream community capabilities (posting rate, link/image permissions, flag weight). It complements — and is independent of — DesiSquare's engagement karma (#9), which is an application-layer recognition signal derived only from reaction weights and never from money or trust level.

### 4.4 DiscourseConnect SSO phase-in (F5.7)

Launch runs on **Discourse-native auth** (email-verified signup, invite-only "desi check", invite code `DSQ-2026`). The documented phase-in makes the **DesiSquare v4 app the IdP** via DiscourseConnect:

1. Set `SSO_SECRET` (rotate the dev default) shared between the app and Discourse.
2. Configure Discourse `enable_discourse_connect` + `discourse_connect_url` → the app's SSO endpoint.
3. Map the app's user id → Discourse `external_id`; **keep display handles pseudonymous** (no member re-identification).
4. Phase in behind a toggle; until then v4's own registration runs standalone.

Security intent: one verified registration, pseudonymity preserved end-to-end, `external_id` correlation kept server-side.

---

## 5. Data protection & privacy

### 5.1 Data inventory & classification

| Datum | System of record / where it lives | Classification | Who can see it |
|---|---|---|---|
| Email address | Discourse Postgres; v4 user record | **Restricted (PII)** | Admin panel only (`adminUserSummary`); never in member serializers |
| Phone number (E.164) | wa-bridge phone→member map (key only) | **Restricted (PII)** | **No one** on any surface; logs store a salted hash; pseudonymised to `member-XXXX` |
| Pseudonymous handle | v4 `users`, Discourse | Internal / public-safe | Public (it is the identity); never all-digits |
| Portfolio holdings & dollar value | Ghostfolio Postgres 15 (+ Redis cache) | **Restricted (financial)** | Owner only, at `#/me`; never public/maven |
| Allocation % / % returns | models-service / gf-stats (derived) | Public-safe (percent-only) | Public/maven surfaces (opt-in for maven proof) |
| Karma / engagement | v4 (`karmaFor`, reaction weights) | Public | Public (leaderboard, profile) |
| Session token | v4 `sessions` table (server-side) | **Secret** | Server only; cookie is HttpOnly |
| Password hash | v4 user record (`scrypt$…`) | **Secret** | Never leaves the server; verified in place |
| WhatsApp consent flags | v4 user record (`waLinked`/`waConsentMirror`/`waNotifs`) | Internal | Owner + server logic |
| Private flags | v4 `reviewQueue` (`flags[]`) | **Restricted** | Moderators/admins only; flagger identity never surfaced |
| Ops/moderation events | v4 `events` ring buffer (capped 200) | Internal | Ops; **never** contains phone numbers, never records who flagged |
| Secrets (tokens/keys) | GCP Secret Manager; `.env` mode 600 | **Secret** | Ops with IAM; never in git/logs |

### 5.2 Data minimisation & residency

Each datum lives in exactly one system of record; the integration layer never becomes a second source of truth for portfolio value or phone numbers (TRD §4.3). The percent-only pipeline means the maven/public analytics path *never receives* currency data in the first place — minimisation by construction, not by redaction after the fact.

Region choice is a deployment-time control: **`us-central1`** (default) or **`asia-south1`** (Mumbai, India-first audience). Region selection determines where member data and backups physically reside and is an input to the data-residency considerations in §5.4.

### 5.3 Retention, export & right-to-erasure

| Concern | Mechanism |
|---|---|
| Member data export | Discourse's built-in per-user data export (account → export) provides subject-access/portability for community data |
| Right to erasure | Discourse account deletion/anonymisation; wa-bridge mapping removed on opt-out/erasure; Ghostfolio account deletion removes portfolio data at its source of record |
| Backup retention | Discourse built-in nightly backups **7-day** retention; GCS offsite backups **30-day** lifecycle (auto-delete) — bounded retention limits the erasure "long tail" |
| Ops log retention | `events` ring buffer capped at 200 entries (self-truncating); contains no PII |
| Consent record | WhatsApp opt-in/opt-out state is retained as a boolean flag; opted-out members are treated as unmapped |

Note: erasure requests that span Discourse + Ghostfolio + wa-bridge require action in each system of record; a documented runbook for cross-system erasure should be maintained by ops and is a recommended pre-GA task.

### 5.4 Per-corridor privacy regimes (considerations — counsel sign-off required)

> **Not legal advice.** The corridors (US / CA / UK / AE / AU / SG) touch multiple privacy regimes. The points below are engineering-facing *considerations* to route to qualified counsel; **no control here is a determination of legal applicability or compliance.** Counsel sign-off is a launch checkpoint.

| Corridor | Regime to consider | Engineering-facing considerations (for counsel review) |
|---|---|---|
| UK | **UK-GDPR** / DPA 2018 | Lawful basis for processing; DSAR/export & erasure workflow; data-residency expectations; international transfer basis if hosted in `us-central1` |
| EU-adjacent members | **GDPR** | Same as UK-GDPR; transfer mechanism (adequacy/SCCs) if data leaves the EEA |
| SG | **PDPA (Singapore)** | Consent for collection/use; DNC considerations for WhatsApp outreach; data-breach notification thresholds |
| AU | **Australia Privacy Act / APPs** | Notifiable Data Breach scheme; cross-border disclosure (APP 8); collection notice |
| AE | **UAE PDPL** | Consent, data-subject rights, and cross-border transfer conditions; hosting/residency posture |
| US | Sectoral / state (e.g. CCPA-family) | State-by-state consumer-privacy considerations; WhatsApp marketing-template constraints (US +1 marketing paused by Meta) |

Cross-cutting for counsel: DesiSquare is positioned **educational, not financial/investment advice** — the disclaimer control (§2, §10) is part of the regulatory posture, not just UX. The **region/residency choice** (`us-central1` vs `asia-south1`) is the primary technical lever available to satisfy residency-driven requirements and should be decided with counsel before onboarding members in a given corridor.

---

## 6. WhatsApp / messaging compliance

The production standard is the **official Meta WhatsApp Cloud API only**. Unofficial WhatsApp-Web automation libraries are a ToS violation and a ban risk; the deploy guardrails forbid even *suggesting* them.

| Control | Requirement | Enforcement / evidence |
|---|---|---|
| Official API only | 1:1 intake number + portal-as-hub; the On-Premises API was retired Oct 2025 | Deploy guardrails forbid WhatsApp-Web automation; F4 uses Cloud API only |
| Group mirroring out of scope | The Groups API cannot read group messages at community scale (single-digit participant cap); the optional `whatsapp-web.js` inbound seam (`WA_BACKEND`) is **off by default, dependency-free until enabled, and OUT OF SCOPE for production** — it stays uninstalled/disabled behind a separate business go/no-go | `WA_BACKEND=mock` default; enabling group inbound is a deliberate, separately-approved decision; outbound **always** uses the compliant Cloud API |
| Opt-in consent | Mirroring/notifications require member opt-in (`waConsentMirror` / `waNotifs`); non-consenting authors are demoted to "WhatsApp guest" attribution (never a number) | Consent checks in `createMirroredPost` / `notifyWhatsApp` (#5) |
| Opt-out (STOP) | `STOP` / `UNSUBSCRIBE` / `CANCEL` suppresses outbound until the member writes again; opted-out members are treated as unmapped | `OPT_OUT_KEYWORDS=STOP,UNSUBSCRIBE,CANCEL`; F4.6 acceptance |
| 24-hour window | Free-form replies only within 24 h of the member's last inbound message; outside it, only the approved `community_reply` **template** | `SERVICE_WINDOW_HOURS=24`; error 131047 → template path; F4.5 |
| Approved templates | Templates governed in `whatsapp/message-templates.json` (`community_reply` UTILITY, `optin_confirm` UTILITY, `weekly_digest` MARKETING); each carries the "not financial advice" line + "Reply STOP to opt out" footer; submitted for Meta approval | Manage Templates ≥ pending (F4.7); US (+1) marketing templates paused by Meta → US digests via email/in-window |
| E.164 never shown (#5) | The number is the map key only, never returned by any endpoint or written into a post; logs use a salted hash; unmapped senders post as guest with a join CTA; demo phones are server-side `+1-555` only | community-sim UC11; F4.4 (sender `member-XXXX`) |
| Webhook integrity | GET verify handshake echoes `hub.challenge`; POST HMAC-verified (`X-Hub-Signature-256`, raw body, `META_APP_SECRET`); tampered payload → 401 | F4.3 acceptance |
| Idempotency | Meta delivers at-least-once; dedupe on `wamid` → a duplicate inbound yields a single Discourse post | F4.3 (duplicate `wamid` → single post) |
| Quality governance | Monthly review of Meta Business Manager WhatsApp **quality rating** + template status; rotate the system-user token before expiry | Steady-state ops cadence (§7, §8) |

---

## 7. Backups & disaster recovery

### 7.1 Backup design

| Layer | Mechanism | Retention |
|---|---|---|
| Discourse (community) | Built-in nightly backups (Admin → Backups) | 7 days on-box |
| Offsite (both VMs) | `scripts/04-backups.sh` + cron `30 2 * * *`: discourse-1 rsyncs its tar.gz backups; apps-1 `pg_dump`s Ghostfolio Postgres and copies `.env` — all to `gs://<project>-backups/{discourse,ghostfolio,config}/` | 30-day GCS lifecycle |
| Pre-upgrade snapshot | Snapshot Postgres before any Ghostfolio upgrade (auto-migrations run on boot, forward-only) | Ad hoc, before each upgrade |

### 7.2 Targets & drill

- **RPO ≤ 24 h** (nightly cadence). **RTO ≤ 4 h** (rebuild VM from image + restore).
- **Restore drill is a launch gate (F5.2)** and runs **quarterly** thereafter: download a Discourse backup and restore via Admin → Backups on a scratch container; load a Ghostfolio dump into a throwaway Postgres. Document the output each time — do not assume.
- Availability SLO: **99.5% monthly** for the web surfaces at pilot (< 1k members).

### 7.3 DR runbook (scenario → action → owner)

| Scenario | Action | Owner |
|---|---|---|
| Discourse bad rebuild | Revert `containers/app.yml`, `./launcher rebuild app` again; data persists in `/var/discourse/shared`; restore a tar via Admin → Backups if needed | Platform admin |
| Apps stack regression | `cd /opt/desisquare && docker compose down && git -C app_src checkout <prev> && docker compose up -d`; restore Postgres from the latest GCS dump if data is affected | Ops |
| Ghostfolio upgrade failure | Pin the previous image tag in compose; restore the pre-upgrade Postgres snapshot | Ops |
| WhatsApp incident (spam/abuse via the number) | Disable the Meta webhook (stops inbound) or `docker compose stop wa-bridge` (stops outbound); Discourse/site unaffected | Ops + moderation |
| VM/zone loss | Rebuild VM from image in-region + restore from GCS (RTO ≤ 4 h) | Platform admin |
| DNS/cutover problem | Re-point A records to the last-good host (keep TTL low, e.g. 300 s) | Platform admin |
| Secret compromise | Rotate the affected secret in Secret Manager **and** `.env` together; restart the service; revoke the old token at the provider (Meta/Discourse) | Security owner |

---

## 8. Monitoring & incident response

### 8.1 Monitoring

- **Google Ops Agent** on both VMs → metrics + logs to Cloud Monitoring/Logging.
- **Uptime checks** on the four public URLs with an email notification channel: `https://community.<domain>` (200), `https://app.<domain>/api/health`, `https://folio.<domain>/api/v1/health`, `https://wa.<domain>/health`. Health endpoints back each check.
- **Billing budget alert** (~$150/mo, thresholds 50/90/100%) guards runaway cost/abuse.
- **Structured logs.** Each service logs `[service] kind: detail`; the v4 `events` ring buffer records wa-inbound/webhooks/provisioning/moderation — **never phone numbers**, and moderation events never record who flagged. gf-stats logs status + timing only, never Ghostfolio payload bodies (they carry values).
- **WhatsApp quality monitoring.** Monthly review of the Meta Business Manager quality rating and template status; token/quality check is a recurring operational task.

### 8.2 Incident severity ladder

| Severity | Definition & examples | Response expectation |
|---|---|---|
| **SEV1** | Confirmed leak of a constraint-protected datum (a dollar value, E.164 number, email, or flagger identity on a public/member surface), credential/secret compromise, or full outage of a public surface | Immediate: page the security owner; contain (disable the leaking path / rotate the secret / take the surface offline); begin timeline; assess notification obligations with counsel |
| **SEV2** | Partial outage or degraded integration with a workaround (e.g. wa-bridge down → mirroring falls back; Ghostfolio down → SSO shows a hint), failed backup, or a webhook-forgery attempt blocked by HMAC | Same-day: acknowledge, mitigate, monitor; fix root cause within the sprint; verify graceful degradation held |
| **SEV3** | Cosmetic/non-exposing bugs, single-user issues, elevated but non-critical error rates, template rejection by Meta | Next business day: triage into the backlog; batch with routine maintenance |

### 8.3 Comms plan (basic)

1. **Detect** → whoever detects opens an incident and sets a preliminary severity.
2. **Notify** → SEV1 pages the security owner (rahman.kalilur@outlook.com) + platform admin; SEV2/3 notified in the ops channel.
3. **Contain & communicate** → for SEV1, post a holding status to affected members via the community/status surface once the leak is contained; do not disclose PII in the notice.
4. **Regulatory** → any personal-data breach triggers the §5.4 counsel checkpoint to assess notification duties (GDPR/UK-GDPR 72 h, AU NDB, PDPA, PDPL) — **counsel decides**, engineering supplies the timeline and scope.
5. **Post-incident** → within 5 business days, a blameless review: timeline, root cause, the control that failed or was missing, and a tracked remediation (often a new leak-sweep/test case so it becomes a regression, §9).

---

## 9. Vulnerability & dependency posture

| Area | Posture |
|---|---|
| Supply chain | **Zero-dependency stdlib Node** across every service in this repo (empty `dependencies` maps): no transitive-dependency attack surface, no build step, `node <entry>` boots everything. Optional heavy backends (live WhatsApp client, live price feeds) sit behind opt-in `dynamic import()` seams and stay uninstalled until explicitly enabled. |
| Upstream products | Discourse and Ghostfolio (verified against **v3.21.0**) carry their own dependency surface; mitigated by the **monthly upgrade cadence** (Discourse `./launcher rebuild app`; `docker compose pull && up`), snapshotting Postgres before Ghostfolio upgrades. |
| Base images / OS | `unattended-upgrades` patches the host; container images refreshed on the monthly cadence. Frozen images are prohibited in production (e.g. Discourse-on-Railway is demo-only — no security updates). |
| Token rotation | Meta system-user token rotated before expiry (monthly quality/token check); `DISCOURSE_WEBHOOK_SECRET`, `BRIDGE_API_KEY`, DB/Redis passwords rotated **quarterly**, updating `.env` + Secret Manager together. |
| Secret scanning | `.gitignore` covers `.env`/`data`; docs use placeholders; recommended pre-GA: enable repo secret-scanning (e.g. GitHub secret scanning / push protection) as a backstop. |
| Security regression tests | The **leak-sweep** (`leak-sweep.test.mjs`, story 12.5) runs in CI on the golden **and** poisoned fixtures — it is both a #8 enforcement and an **upstream-drift tripwire**. The v4 `privacy.test.js` (E.164/email sweeps), `robustness.test.js` (malformed input, cookie faults, oversized bodies), and the community-sim UC9/UC10/UC11/UC14 gates are the standing security regression suite. Each release re-runs the leak-sweep/constraint check. |

---

## 10. Compliance & audit-readiness checklist

Pragmatic, pilot-altitude mapping to SOC 2-style control families. This is a readiness checklist, **not** a certification or attestation.

**Access control**
- [ ] Default-deny dispatcher gate; only 5 public routes; member endpoints 401/403 anonymously (#7-A)
- [ ] Role model enforced (member/maven/moderator/admin); admin least-privilege; email admin-only
- [ ] Discourse staff 2FA enabled
- [ ] SSH IAP-only; no public port 22; OS Login on
- [ ] Ghostfolio admin token stored in vault/Secret Manager (unrecoverable if lost)

**Encryption**
- [ ] TLS on all four hostnames (Caddy/Let's Encrypt; Discourse `force_https`)
- [ ] Passwords scrypt-hashed with per-user salt + constant-time compare
- [ ] Session cookie HttpOnly + SameSite=Lax; API responses `Cache-Control: no-store`
- [ ] Secrets in Secret Manager; `.env` mode 600; never committed

**Backup & recovery**
- [ ] Discourse nightly backups (7-day) + GCS offsite (30-day lifecycle) for both VMs
- [ ] Restore drill executed and documented (launch gate F5.2; quarterly thereafter)
- [ ] RPO ≤ 24 h / RTO ≤ 4 h targets recorded; rollback quick-reference maintained

**Logging & monitoring**
- [ ] Ops Agent on both VMs; uptime checks on the four URLs + email alerting; billing budget armed
- [ ] Structured logs with no PII; `events` buffer never records phone numbers or flagger identity
- [ ] gf-stats logs status/timing only, never payload bodies
- [ ] Incident severity ladder + comms plan adopted (§8)

**Change management**
- [ ] Leak-sweep + privacy/robustness tests green each release (story 12.5)
- [ ] Monthly Discourse/Ghostfolio upgrade cadence; Postgres snapshot before Ghostfolio upgrades
- [ ] Quarterly secret rotation (webhook secret, bridge key, DB/Redis passwords)
- [ ] Cutover/rollback runbook followed for any migration (freeze → export → verify → switch → scale down)

**Vendor / third-party management**
- [ ] WhatsApp on official Meta Cloud API only; group-mirroring seam uninstalled/disabled (§6)
- [ ] Meta Business Verification completed; token rotation + quality monitoring monthly
- [ ] SMTP relay (Brevo) with SPF/DKIM/DMARC configured; port 587
- [ ] Ghostfolio pinned to a tested version; upstream-drift tripwire (poisoned fixture) in CI

**Privacy & data protection**
- [ ] Data inventory & classification maintained (§5.1); minimisation by design verified
- [ ] Export / right-to-erasure paths documented across Discourse + Ghostfolio + wa-bridge
- [ ] Per-corridor privacy regimes reviewed with counsel; region/residency choice signed off (§5.4)
- [ ] E.164 never displayed; portfolio dollars owner-only; percent-only pipeline verified (#4/#5/#8)

**Product / positioning control**
- [ ] "Educational — not investment advice" disclaimer on every content surface (story 11.1)
- [ ] "Past performance is not indicative of future results" on every performance-rendering surface
- [ ] Recognition ranks engagement karma, never money (#9)

---

*End of document. This posture must stay consistent with the six constraints and with `docs/TRD-desisquare.md` §8; the leak-sweep CI (story 12.5) is the machine backstop for any change touching maven/portfolio/PII surfaces. Per-corridor legal applicability is for counsel, not this document.*
