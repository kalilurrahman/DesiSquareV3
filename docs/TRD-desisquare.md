# Technical Requirements Document — DesiSquare V3 ("The Living Square")

| Field | Value |
|---|---|
| Document | Technical Requirements Document (TRD) |
| Product | DesiSquare V3 — Discourse + Ghostfolio + WhatsApp community for the desi retail-investor diaspora |
| Version | 1.1 |
| Status | Approved for build (Phase 1 shipped; Phase 2 in progress; **Phase 5 EP-03 Hub wave 1 shipped 2026-07-21**) |
| Owner | Engineering (rahman.kalilur@outlook.com) |
| Date | 2026-07-21 |
| Changelog | 2026-07-21 — Phase 5 EP-03 Hub module added (`v4/src/hub.mjs`, the `hub` store key, `/api/hub*` routes); see §2, §4.1, §5.1 and §5.5. Tracked in `PHASE-5-TICKETS.md` (DS-201..DS-206, wave 1) |
| Repository | `DesiSquareV3` — product source of truth and final integration of the v1/v2 codebases |

**One-line summary.** DesiSquare is a pseudonymous, public-first, educational community where desi retail investors get trusted answers on the web *and* on WhatsApp, backed by verified **percent-only** maven performance and a one-click Ghostfolio portfolio per member.

**Relationship to the PRD.** This TRD is the engineering counterpart to the product specification carried in `docs/desisquare-user-stories.md` (the canonical PRD: 124 stories / 21 epics, stable story numbers across versions). The PRD states *what* and *why*; this TRD states *how* — architecture, data model, API contracts, security enforcement, and non-functional targets — and is bound by the six non-negotiable product constraints reproduced in §1 and enforced technically throughout. Where the PRD and this TRD disagree on a constraint, the constraint wins and the leak-sweep CI (story 12.5) is the machine backstop.

---

## 1. Non-negotiable constraints (bind every requirement in this document)

| # | Constraint | Primary technical enforcement point |
|---|---|---|
| #3 | Flags are **private** — 5 reasons route to a moderator review queue; no public flag indicator, ever | `POST /api/posts/:id/flag` writes to `reviewQueue` only; `postVM.myFlag` returns the viewer's own flag or `null`; review queue is moderator-gated |
| #4 | Portfolio **dollars are owner-only**; public surfaces show allocation **%** only, default private | `GET /api/users/:id` branches owner → value / public → allocation-% / private; gf-provisioner strips value server-side for non-owner viewers |
| #5 | WhatsApp mirroring/notifications are **consent-gated**; **E.164 numbers never appear** anywhere | `stripPhoneNumbers()` on every inbound write; consent checked in `createMirroredPost`/`notifyWhatsApp`; wa-bridge keeps phone as a private map key, never echoed |
| #7-A | Signed-out visitors get only the curated public teaser; **every member endpoint 401/403s anonymously** | Dispatcher gate: `route.auth` defaults `true`; only teaser/health/bootstrap/session/register are public |
| #8 | Maven performance is **percent-only**; currency stripped server-side | Percent index (100 at inception); gf-stats whitelist serializer; inline `/[$₹£]\s?\d/` guard on any live feed; leak-sweep in CI |
| #9 | Recognition ranks **engagement, never money** | `karmaFor()` sums reaction weights only; no leaderboard/badge/trending surface may read portfolio data or % returns |

Cross-cutting rules: positioning is **educational only, never investment advice** (a persistent disclaimer rides every content surface, story 11.1); the theme is **Porcelain Slate** (light, client-locked); reactions are a fixed four-pill set (Helpful / Insightful / Actionable / Like); labels are Discourse tags.

---

## 2. Architecture overview

DesiSquare is a **thin, zero-dependency integration layer** wrapped around two mature upstream products (Discourse for community, Ghostfolio for portfolios) and one external platform (Meta WhatsApp Cloud API). The integration code — the branded forum experience `v4/`, plus three sidecar services — is written entirely against the Node standard library so it can run standalone on a laptop with no `npm install`, degrade gracefully to seeded content when upstreams are down, and later point at the real upstreams with **environment-variable changes only**.

The branded experience `v4/` is a single-file hash-routed SPA served by a stdlib `node:http` server. It exposes three HTTP surfaces from one process: (a) the **member JSON API** (`/api/*`, privacy rules enforced server-side); (b) a **Discourse-compatible subset** (`/categories.json`, `/posts.json`, `/u/:user.json`, `/t/:id`) so the unmodified wa-bridge binary can mirror WhatsApp posts into it exactly as it would into real Discourse; and (c) the **demo driver** (session-gated). The same app runs standalone OR against a real Discourse when `DISCOURSE_URL` is set.

The three sidecar services each own one integration seam and are independently runnable and testable. In production all of them, plus Ghostfolio and its datastores, sit on a single application VM behind Caddy; Discourse runs on its own VM.

### Production topology (GCP, 2 VMs)

```
                          Internet (HTTPS 443, TLS via Let's Encrypt)
                                        │
        ┌───────────────────────────────┼────────────────────────────────┐
        │                               │                                 │
 community.<domain>              app./folio./wa.<domain>                   │
        │                               │                                 │
        ▼                               ▼                                 │
┌─────────────────┐        ┌──────────────────────────────────────────┐  │
│  VM discourse-1 │        │  VM apps-1 (e2-standard-2)                │  │
│  (e2-medium)    │        │  ┌────────┐  Caddy terminates TLS         │  │
│                 │        │  │ Caddy  │──► app.  → v4 forum   :8786    │  │
│  Discourse      │◄──────►│  └────────┘    folio.→ Ghostfolio :3333    │  │
│  (Docker)       │  REST/ │                 wa.   → wa-bridge  :8788    │  │
│  + own Postgres │  webhk │   gf-provisioner :8789   models-service :8791│ │
└────────┬────────┘        │   Ghostfolio ── Postgres 15 + Redis 7      │  │
         │                 └──────────────────┬───────────────────────┬─┘  │
         │ SMTP 587                           │ server-side only        │   │
         ▼                                    ▼                         ▼   │
   Brevo (email)                    Meta WhatsApp Cloud API      GCS bucket │
                                    (outbound notifications)   (nightly backups)
         │                                                                  │
   GCP Secret Manager (source of truth for tokens/keys) ────────────────────┘
```

### Component inventory

| Component | Responsibility | Tech | Port | Stateful? | Scales how |
|---|---|---|---|---|---|
| `v4/` forum (app/API/compat/demo) | Branded SPA, member API, teaser, Reddit-style search, maven percent-proof, Discourse-compat intake for wa-bridge | Zero-dep Node 22 (`node:http`, `node:crypto`, `node:fs`) | 8786 | Yes — JSON file store (`data/db.json`) | Vertical now; stateless-app + Cloud SQL on F6 path |
| `v4/src/hub.mjs` — **EP-03 Services & Products Hub** (Phase 5) | Pure, zero-dep serializers for the public Hub (expert directory + service catalog + canonical guides): `publicExpertCard` (percent-only track record via the maven `buildPerformance().overall.cumulativePct`; no email/phone), `publicServiceCard` (qualitative `priceTier` from `HUB_PRICE_TIERS` — never a currency amount), `publicGuideCard`, `orderExperts` (by name, never by returns), `validateBooking` | Zero-dep module inside `v4/` (no I/O; imported by the `api.mjs` hub routes) | (part of 8786) | No — pure functions over `store` state | With the v4 app |
| models-service | Maven **investment models & signals**: declared-entry ledger + EOD prices → CAGR / vs-benchmark / max-drawdown, equity indexed to 100 | Zero-dep Node 22 (`node:http`, `node:test`) | 8791 | Yes — `data/state.json` (schema maps 1:1 to Postgres) | Stateless compute; promote store to Postgres |
| gf-provisioner | On registration create/link **one** Ghostfolio account; serve % summary for profile card; mint 1-click SSO deep-link | Zero-dep Node (Ghostfolio client behind a seam) | 8789 | Yes — `identity_link` file store (per-process; → Postgres) | Stateless behind shared identity table |
| wa-bridge | WhatsApp ↔ Discourse mirror (consent-gated); outbound notifications via Cloud API | Zero-dep Node (WA client behind a seam) | 8788 | Yes — phone map + message log (→ Postgres/Redis) | **Single stateful instance** (session/dedupe); StatefulSet+PVC on GKE |
| gf-stats (contract) | Percent-only maven-stats boundary: whitelist serializer strips every currency-typed field before it leaves the server | Zero-dep Node serializer + leak-sweep test | (reverse-proxied) | Cache only (24 h/48 h stale) | Stateless; per-maven daily cache |
| Discourse | Community engine (topics, categories, trust, native flags, backups, SSO) | Official Docker install | 443 via Caddy | Yes — own Postgres | Upstream VM; vertical |
| Ghostfolio | Portfolio tracker (holdings, performance, allocation); verified against **v3.21.0** | Docker | 3333 behind Caddy | Yes — Postgres 15 + Redis 7 | Upstream; vertical → managed DB on F6 |
| Caddy | TLS termination (Let's Encrypt) for `app.` / `folio.` / `wa.` | Caddy | 80/443 | No | Per-VM |
| Postgres 15 / Redis 7 | Ghostfolio backing store + cache | Docker | internal | Yes | Managed (Cloud SQL / Memorystore) on F6 |
| Meta WhatsApp Cloud API | Outbound member notifications (official) | External SaaS | — | External | Meta-managed |
| SMTP relay (Brevo) | Discourse transactional email (port 587) | External SaaS | — | External | Provider-managed |

---

## 3. Engineering principles

1. **Zero-dependency stdlib Node.** Every service in this repo has an empty `dependencies` map. HTTP is `node:http`, crypto/HMAC/scrypt is `node:crypto`, tests are `node:test`, persistence is `node:fs`. Consequences: no supply-chain surface, no build step, `node <entry>` boots everything, and `make install` only verifies the Node version. Heavy optional backends (e.g. the live WhatsApp client, live price feeds) sit behind a **seam** and are `dynamic import()`-ed only when explicitly enabled, so the default path stays dependency-free.
2. **Single-file SPA, string-concatenation rendering, no build step.** The client is `public/index.html` + `public/app.js` + `public/styles.css`: vanilla JS, hash-routed (`#/feed`, `#/post/:id`, `#/u/:id`, `#/search`, `#/communities`, `#/maven/:id`, `#/review`, `#/admin`, `#/register`), rendered by string concatenation into `#app`. No framework, no bundler, no external network requests. Open it directly or serve it from `server.mjs`.
3. **Degrade gracefully to a seeded fallback.** The app is fully functional standalone. `integrations.mjs` probes each sidecar every 30 s (with a shape-validator so a mis-pointed URL that returns HTTP 200 does not count as "up") and **upgrades live** when a service answers — WhatsApp mirroring, provisioning, SSO, live maven feed — with no code change. When a service is down the app falls back to a deterministic seeded computation, so demos never block.
4. **Percent-only is a pipeline invariant, not a UI rule.** Currency never enters the maven-performance computation at any layer: the equity series is a **percent index anchored at 100 at inception**, KPIs are compounded percentages, and the one boundary that reads Ghostfolio (gf-stats) is a whitelist serializer that constructs output by explicit picks and forbids currency-typed keys and value patterns. Machine backstops (inline regex guard + leak-sweep test) fail the build if a dollar figure ever reaches a public or maven surface.
5. **Privacy is enforced on write and on read.** Phone-shaped strings are stripped on ingest (`stripPhoneNumbers`), and view-models (`authorCard`, `meVM`) never carry email or phone. Email appears only in explicitly admin-scoped serializers.
6. **Idempotency at every integration boundary.** Provisioning is idempotent by `userId`/`email`; WhatsApp inbound is deduped by `wamid`; models-service signals are idempotent on `postId` and the Discourse event id; webhooks are HMAC-verified with the raw body.

---

## 4. Runtime & data model

Each datum lives in exactly one system of record. The integration layer never becomes a second source of truth for portfolio value or phone numbers.

### 4.1 v4 forum state store

State lives in `data/db.json` (git-ignored), built on first boot from `data/seed.json` and persisted with **atomic writes** (temp file + `rename`) that are **debounced 250 ms** so a burst of reactions costs one disk write. `store.reset()` rebuilds from seed (used by the demo reset). On boot, `store.load()` also runs a **backfill migration**: it diffs a fresh seed build against an existing `db.json` and copies over any **top-level key introduced since that file was written** (e.g. the Phase-5 `hub` key), persisting once if anything changed — so a running store gains a newly-shipped module without a `reset()` or manual wipe. Top-level shape:

| Key | Shape | Notes |
|---|---|---|
| `users` | `{ [id]: user }` | `id` is the pseudonymous handle; fields include `groups[]` (`mavens`/`moderators`/`admins`), `role`, `credential`, `desiVerified`, `country`, WhatsApp consent flags (`waLinked`/`waConsentMirror`/`waNotifs`), `portfolioPublic`, `experiments`, `theme`, `portfolio`, `ghostfolio`, and (registered accounts only) `passwordHash`. `email` is stored but never leaves via member serializers. |
| `posts` | `[ { id, space, author, createdAt, via, title, body, bodyFull, reactions{4}, removed, comments[] } ]` | `via` ∈ `web`/`whatsapp`; `removed` posts are excluded from feeds/search/karma |
| `spaces` | `[ { id, name, desc, count, public?, archived? } ]` | Discourse categories; `public !== false` spaces feed the teaser |
| `communities` | `[ { id, name, country, type, members, online, desc } ]` | one free community per corridor (US/CA/UK/AE/AU/SG) + public/private sub-communities |
| `reviewQueue` | `[ { id, postId, reason, flags[], status, createdAt, resolvedAt?, resolvedBy? } ]` | private flag store (constraint #3); `flags[]` records `{by,reason,at}` but is never surfaced publicly |
| `calendar` | `[ { id, date, title, host, kind, scope } ]` | moderator-managed events, member-only read |
| `hub` | `{ experts[], services[], guides[], bookings[] }` | **EP-03 Services & Products Hub** (Phase 5). `experts`/`services`/`guides` are curated from `seed.json`; `bookings` grow at runtime. `experts[]` = `{ userId, flair, tagline, specialties[], corridors[] }`; `services[]` = `{ id, expertId, title, kind, durationMin, format, priceTier }` (`priceTier` a qualitative tier, never a currency amount); `guides[]` = `{ id, slug, title, summary, body, author, sourcePostId, tags[], updatedAt }`; `bookings[]` = `{ id, serviceId, memberId, note, status, createdAt }` — `note` is phone-stripped at write and **never returned**. Added to existing stores by the `load()` backfill above, no reset required |
| `inviteCodes` | `[ "DSQ-2026", … ]` | invite-gated registration |
| `countries` | `[ { code, … } ]` | the six corridors |
| `waMappings` | `[ { waHandle, userId } ]` | consent mapping seed; demo phone numbers are derived server-side and never stored here |
| `reactionsBy` | `{ "userId:postId": { helpful:true, … } }` | per-member toggle state (prevents self-reaction and double-counting) |
| `sessions` | `{ [token]: { userId, createdAt } }` | server-side session table |
| `events` | `[ { at, kind, detail } ]` (capped 200) | ops/demo log — **never contains phone numbers** |

### 4.2 Session model

Login (demo, invite, open registration, or username+password) calls `startSession`, which mints a 24-byte random hex token, stores `{userId, createdAt}` in `sessions`, and sets a cookie:

```
Set-Cookie: dsq_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600
```

HttpOnly (no JS access), SameSite=Lax (CSRF mitigation), 14-day lifetime. Passwords for open-registration accounts are stored as `scrypt$<salt>$<hash>` (`node:crypto` scrypt, 16-byte per-user salt, 64-byte hash) and verified with `timingSafeEqual`. **Demo personas carry no `passwordHash`**, so they can only enter through the `mode:'demo'` path and can never be logged into by password.

### 4.3 Other systems of record

| Datum | System of record | Never duplicated in |
|---|---|---|
| Portfolio holdings, value, performance | Ghostfolio → Postgres 15 (+ Redis 7 cache) | v4 app (holds only a manual `portfolio` demo block + a `ghostfolio` link record) |
| Identity link (user → Ghostfolio account) | gf-provisioner `identity_link` (file store → Postgres) | — |
| Community topics, categories, trust, native flags | Discourse's own Postgres | — |
| Phone ↔ member map, WhatsApp message log / dedupe | wa-bridge (file store → encrypted Postgres + Redis) | v4 app, logs (salted hash only) |
| Maven models, immutable entry ledger, signals, price bars | models-service `state.json` (→ Postgres) | — |
| Secrets (Meta token, Discourse API key, webhook secret) | GCP Secret Manager (source of truth); `.env` on VM mode 600 | git |

---

## 5. API surface

### 5.1 Key v4 endpoints

Auth level is what the **dispatcher** enforces before the handler runs (see §5.2). "mod-in-handler" means the route is dispatcher-`auth` but calls `isModOrAdmin(user)` internally, so moderators **and** admins pass.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/session` | public | Sign in: `mode:'demo'` (persona), `mode:'invite'` (code+pseudonym), `mode:'request'` (membership request), or `username`+`password` login |
| POST | `/api/register` | public | Open registration: pseudonymous handle (never all-digits) + email + password ≥ 8; auto-provisions one Ghostfolio account |
| DELETE | `/api/session` | public | Sign out (clears cookie + server session) |
| GET | `/api/bootstrap` | public | App bootstrap; anonymous → public stats + demo accounts + catalogs only; authenticated → adds `me`, spaces, communities, mavens |
| GET | `/api/teaser` | public | The **only** unauthenticated content path: top ~6 hot posts from public spaces, currency-scrubbed, pseudonym-only, no bodies/email/phone |
| GET | `/api/health` | public | Liveness: `{ ok, service, posts, users }` |
| GET | `/api/feed` | auth | Member feed; `sort=popular` (hot ranking, top 3 get `popRank`) or `new` |
| POST | `/api/posts` | auth | Create post (phone-stripped; suspended authors 403) |
| GET | `/api/posts/:id` | auth | Post with comments |
| POST | `/api/posts/:id/comments` | auth | Reply; fires consent-gated WhatsApp notification to author |
| POST | `/api/posts/:id/react` | auth | Toggle one of the 4 positive reactions (cannot react to own post) |
| POST | `/api/posts/:id/flag` | auth | **Private** flag → review queue (5 reasons) |
| GET | `/api/users/:id` | auth | Profile: posts/comments/karma + portfolio (owner value / public %-only / private) |
| POST | `/api/me/portfolio/sso` | auth | Mint 1-click Ghostfolio SSO deep-link (provisions on demand) |
| PUT | `/api/me/settings` | auth | Toggle WhatsApp consent/notifs, portfolio visibility, corridor (each syncs to sidecars) |
| PUT | `/api/me/experiments`, `/api/me/theme` | auth | A/B variant + theme (client-locked default `warm`/Porcelain in prod) |
| GET | `/api/communities`, POST `/api/communities/:id/join` | auth | List / join (private → request) |
| GET | `/api/calendar` | auth | Member-only event read |
| POST/DELETE | `/api/calendar[/:id]` | mod-in-handler | Moderators/admins manage events |
| GET | `/api/leaderboard` | auth | Top-10 by **engagement karma** (never money) |
| GET | `/api/karma/rules` | auth | Published karma rules, sourced from the same constants that award karma |
| GET | `/api/search` | auth | Reddit-style search across posts/communities/comments/profiles |
| GET | `/api/mavens/:id/performance` | auth | **Percent-only** performance proof (404 unless target is a maven) |
| GET | `/api/hub` | public | **EP-03 Hub** — expert directory + service catalog + canonical guides (percent-only, identity-safe; public like the teaser) |
| GET | `/api/hub/guides/:slug` | public | A canonical guide by slug (programmatic/SEO page), currency-scrubbed (404 on unknown slug) |
| POST | `/api/hub/bookings` | auth | Request a service booking; `note` is phone-stripped (#5) and **never echoed back** (400 on unknown `serviceId`) |
| GET | `/api/hub/bookings` | auth | The member's own booking requests (`note` never returned) |
| GET/POST | `/api/review-queue[/:id]` | mod | Moderator flag queue; `POST /:id/remove` (with `banDays`) and `/:id/dismiss` are mod-or-admin |
| GET | `/api/admin/overview`, `/api/admin/users` | admin | Admin summaries (**the one place `email` may appear**) |
| POST | `/api/admin/users/:id/role` | admin | Grant/revoke `mavens`/`moderators`/`admins` (+ credential) |
| POST/PUT | `/api/admin/spaces[/:id]`, POST `/api/admin/posts/:id/remove` | admin | Space & content administration |
| GET/POST | `/api/demo/*` | auth | Session-gated demo driver (status, wa-inbound, signup, reset) |

### 5.2 The dispatcher auth gate (mechanism enforcing #7-A)

Every route is declared with `{ auth, mod, admin }` where **`auth` defaults to `true`**. The dispatcher matches method + compiled path regex, decodes params (a malformed `%`-escape becomes a clean 404, never a crash), then applies the gate before invoking any handler:

```js
if (r.auth || r.mod || r.admin) {
  user = currentUser(req);
  if (!user) return json(res, 401, { error: 'sign in first' });
  if (r.mod   && !user.groups.includes('moderators')) return json(res, 403, { error: 'moderators only' });
  if (r.admin && !user.groups.includes('admins'))     return json(res, 403, { error: 'admins only' });
}
```

Because the *default is authenticated*, a new route is private unless a developer explicitly opts it out. Only these are `auth:false`: `session`, `register`, `bootstrap`, `teaser`, `health`, and the two EP-03 Hub reads (`/api/hub`, `/api/hub/guides/:slug`) — curated, currency-scrubbed, identity-safe public surfaces, like the teaser. Everything else — feed, post read, search, profiles, presence, calendar, leaderboard, maven performance, **Hub bookings** — 401s anonymously with `{"error":"sign in first"}`. Handler exceptions become `HttpError.status` or a generic 500; bodies are capped at 256 KB and are `Cache-Control: no-store`.

### 5.3 Status-code conventions

| Code | Meaning in this API |
|---|---|
| 200 / 201 | Success / resource created |
| 302 | Discourse-compat deep link (`/t/:id`) → SPA post page; SSO click → Ghostfolio callback |
| 400 | Malformed JSON body |
| 401 | Not signed in (`{"error":"sign in first"}`) — the #7-A anonymous gate |
| 403 | Signed in but lacking the group (`moderators only` / `admins only`), suspended author, or bad compat Api-Key |
| 404 | No such resource; also the deliberate "no consent / not a maven" indistinguishable response |
| 409 | Conflict — pseudonym/email taken; immutable ledger edit rejected (models-service) |
| 413 | Request body over the 256 KB cap |
| 422 | Validation failure (unknown reaction/reason/role/action, invalid username/email/password) |
| 500 / 503 | Internal error / upstream unavailable and cache expired (gf-stats) |

### 5.4 Response shapes

`GET /api/karma/rules` (constants are the single source of truth, so the published rules can never drift from awarded karma):

```json
{
  "statement": "Karma measures community engagement — never money. Portfolio value and % returns can never affect it (#9).",
  "earn": [
    { "action": "\"Actionable\" reaction received on your post or comment", "points": 3 },
    { "action": "\"Helpful\" reaction received on your post or comment", "points": 3 },
    { "action": "\"Insightful\" reaction received on your post or comment", "points": 2 },
    { "action": "\"Like\" reaction received on your post or comment", "points": 1 },
    { "action": "Your reply is marked the accepted answer", "points": 5, "note": "Phase-2 — accepted answers are not tracked yet" }
  ],
  "tiers": [
    { "name": "New Arrival", "min": 0 }, { "name": "Regular", "min": 100 },
    { "name": "Trusted", "min": 500 }, { "name": "Anchor", "min": 2000 },
    { "name": "Luminary", "min": 10000 }
  ],
  "antiGaming": [
    "You cannot react to your own posts, so you cannot award yourself karma.",
    "Content removed by moderation grants no karma — and its author is stripped of any karma it earned.",
    "Karma only ever comes from reactions others give your contributions; it never uses portfolio value or returns."
  ]
}
```

`GET /api/mavens/:id/performance` — note there is **no currency field anywhere**; `series[].index` is a percent index (100 at inception):

```json
{
  "overall": {
    "cumulativePct": 34.8, "annualizedPct": 18.9, "ytdPct": 9.1,
    "twoYearPct": 31.2, "profitableWeeksPct": 63, "riskScore": 4
  },
  "yearly":  [ { "year": 2025, "pct": 14.2 }, { "year": 2026, "pct": 9.1 } ],
  "monthly": [ { "ym": "2025-01", "pct": 2.1 }, { "ym": "2025-02", "pct": -1.3 } ],
  "series":  [ { "date": "2025-01-01", "index": 100.0 }, { "date": "2025-01-08", "index": 101.4 } ],
  "allocation": [ { "label": "US Equity", "pct": 62.0 }, { "label": "Bonds", "pct": 18.0 } ],
  "recent": [ { "ticker": "NVDA", "side": "SELL", "at": "2026-07-14T00:00:00.000Z", "plPct": 4.2 } ]
}
```

### 5.5 EP-03 Services & Products Hub — constraint enforcement (Phase 5, wave 1)

The **Services & Products Hub** (`PHASE-5-TICKETS.md`, DS-201..DS-206, wave 1) is a public, SEO-facing surface — an expert directory, a service catalog, and a canonical-guides library distilled from community answers. It is held to the same six non-negotiables as every other surface, and they are enforced **at the data layer** (the serializers in `v4/src/hub.mjs`), not merely in the UI:

- **#4 / #8 — percent-only.** An expert's track record is `publicExpertCard`'s `trackRecordPct` — the maven's `buildPerformance().overall.cumulativePct` (a percent, rounded to 0.1) or `null` — and can never be a dollar value. Service prices are qualitative **tiers** (`HUB_PRICE_TIERS` = `Complimentary` / `Member` / `Premium`), words rather than a currency amount, so nothing on the Hub can trip the leak-sweep; `/api/hub/guides/:slug` additionally runs `scrubCurrency()` on the body defensively.
- **#5 — no PII.** Cards are built from the identity-safe `authorCard()` — no email, no phone. A booking `note` is phone-stripped on write (`stripPhoneNumbers`) **and never echoed** by either the create or the list response, so an E.164 can never leak back out.
- **#7-A — booking is member-gated.** `GET /api/hub` and `GET /api/hub/guides/:slug` are `auth:false` public reads; `POST /api/hub/bookings` and `GET /api/hub/bookings` carry the dispatcher `auth` flag, so anonymous callers 401 (§5.2).
- **#9 — recognition ≠ money.** `orderExperts()` sorts the directory by **name** (every Hub expert is verified) — never by % returns or money.

Backstopped by `v4/test/hub.test.js` (5 tests: directory is public, %-only, `$`-free and PII-free; ordering by name ≠ returns; member-gated booking where a phone-in-note is never echoed; unknown-service reject; canonical guide by slug). It runs green inside the v4 suite, which stands at **52/52**.

---

## 6. The percent-only performance pipeline (constraints #4 & #8, in depth)

The single most-emphasized product rule is that maven and member performance is **percent-only — Monthly / Yearly / Overall — never dollar amounts**. This holds across three complementary layers, all of which anchor an **equity/percent index at 100 at inception** so currency is structurally absent.

**1. Declared-entry ledger + EOD prices (models-service).** Nothing is self-reported: mavens declare timestamped BUY/SELL **entries** (immutable — corrections are new entries; edits are rejected 409), and the service computes outcomes from end-of-day close prices. A daily equity series is built from entry weights × closes, **indexed to 100 at the first entry date**; gross exposure is capped at 100% (cash idles at 0%, never negative); a missing bar carries the last close forward. From that series it derives **CAGR** (annualized over the actual window; windows under a year are *not* extrapolated — `annualized:false`), **vs-benchmark** (model CAGR − benchmark CAGR in percentage points; default `SPY`), and **max-drawdown** (worst peak-to-trough, negative %). Signal rows carry `sincePct` (close-vs-refPrice; **sign flips for SELL** so an avoided fall scores positive). The price fixture is generated by a **seeded PRNG (mulberry32, no `Math.random`)**, so metrics are byte-reproducible offline; `PRICES_MODE=live` swaps a real EOD feed of the same shape with no code edit.

**2. Self-contained percent computation (v4 `buildPerformance`).** For the standalone branded proof, the app compounds declared monthly percentages into Monthly, per-year (`compoundPct`), and Overall figures — `cumulativePct`, `annualizedPct` (`(1+cum)^(12/n)−1`), `ytdPct`, `twoYearPct`, `profitableWeeksPct`, `riskScore` (clamped 1–7) — and samples a ~150-point percent index for the sparkline with a deterministic intra-month wiggle (±0.35% via `sin`, no RNG). The **signed baseline chart** renders gains upward and losses mirrored below a proportional zero baseline so a losing month reads as a mirrored dip, not a currency drop.

**3. The gf-stats currency-strip contract (the Ghostfolio boundary).** gf-stats is the only service that reads a maven's linked Ghostfolio account, and constraint #8 is enforced *at this boundary*: the reference serializer `toMavenStats()` **constructs output by explicit picks — it never spreads or passes through upstream objects**. The contract (`docs/gf-stats-contract/`) states the rule precisely: (1) keys are allowlisted; (2) every numeric leaf must be a percent (`*_pct`), a ratio band, or a month count (`months`/`min_months_required`) — there is no other legal numeric field; (3) a forbidden key vocabulary (`value, amount, balance, quantity, price, cash, dividend, marketValue, grossPerformance, netPerformance, …` — Ghostfolio's currency-carrying names named explicitly so upstream drift can't reintroduce them); (4) forbidden value patterns (currency symbols before digits, ISO codes like `"USD"`, thousand-separated number strings); (5) no PII. Tokens never reach the browser; gf-stats is the only Ghostfolio caller and logs status+timing only, never payload bodies.

**Why currency can never enter, and the backstops.** Because every layer computes on percentages and the one boundary that touches money is a subtractive whitelist, there is no code path by which an absolute value reaches a public or maven surface. Two machine backstops enforce it:

- **Inline guard.** Before `GET /api/mavens/:id/performance` will serve a *live* gf-provisioner feed, it asserts the payload has no `value` key and that `!/[$₹£]\s?\d/.test(JSON.stringify(live))`; any failure falls back to the guaranteed-safe seeded computation. The teaser runs `scrubCurrency()` on titles/snippets.
- **Leak-sweep (`leak-sweep.test.mjs`, story 12.5).** A zero-dependency CI test asserts the forbidden keys/patterns never appear, run against both the golden example **and** a deliberately *poisoned* Ghostfolio-shaped fixture (containing values, quantities, balances, currency codes) — proving the serializer strips what upstream sends. The browser assertion (`/[$₹£]\d/` never matches on rendered maven/public surfaces) and the community-sim's UC11 leak scan are the same posture at the UI and E2E levels.

The one place an absolute value may render is the **owner-only dollar view** (`#/me`, story 6.7/7.2); it must never leak to a public or maven surface, and the leak-sweep is the backstop for that boundary.

---

## 7. Integration contracts

### 7.1 Discourse (community engine)

- **REST API.** A global API key (user `system`) authorizes server-to-server calls. The v4 app also *exposes* the exact Discourse subset wa-bridge consumes (`GET /categories.json`, `POST /posts.json`, `GET /u/:user.json`, `GET /t/:id` → 302 to the SPA post page), so the wa-bridge binary runs unmodified against either the prototype or real Discourse.
- **Webhooks.** `post_created` → `https://wa.<domain>/webhooks/discourse` (wa-bridge) and, for the models pipeline, `POST /webhook/discourse` (HMAC `sha256=` in `X-Discourse-Event-Signature`; idempotent on `postId` **and** `X-Discourse-Event-Id`, deduped only after a terminal outcome so a redelivery is never swallowed). gf-provisioner subscribes `user_created` / `user_confirmed_email`.
- **Category ids.** The **WhatsApp Intake** category id is recorded in `apps-stack/.env` as `DISCOURSE_WA_CATEGORY_ID`.
- **DiscourseConnect SSO (F5.7 — planned).** Launch on Discourse-native auth; the documented phase-in makes the DesiSquare app the **IdP** via DiscourseConnect, preserving pseudonymous handles. Toggle steps are listed in the requirements register; no member re-identification.

### 7.2 Ghostfolio (portfolio tracker) — via gf-provisioner

- **Client.** The Ghostfolio client sits behind a seam (`src/ghostfolio.js`): **mocked/offline by default**, or live against a self-hosted Ghostfolio. Live methods are **implemented and verified against Ghostfolio v3.21.0** (create anonymous user, exchange per-user security token for a JWT, read `portfolio/details` + `portfolio/performance`).
- **Provisioning idempotency.** On the verified-email webhook, create/link **one** account, idempotent by `userId` and by `email` — a repeat webhook never double-creates. Unverified users are skipped.
- **1-click SSO (exchange-at-click).** Ghostfolio has no URL-param SSO, so `GET /sso/:userId` returns a short-lived HMAC token whose URL points back at our own `GET /sso/click?sso=<token>`; at click time the middleware verifies the token, exchanges the account's **stored** security token for a fresh JWT (`POST /api/v1/auth/anonymous` — the security token never leaves the server), then 302-redirects into Ghostfolio's own `/{lang}/auth/:jwt` callback. Browser-verified end-to-end; bad/expired tokens render a branded 401/410.
- **Config.** `GHOSTFOLIO_URL`, `GHOSTFOLIO_LIVE=true`, `SSO_TTL_SECONDS`. The v4 app fires provisioning as the same HMAC-signed `user_confirmed_email` webhook Discourse would send.

### 7.3 WhatsApp — via wa-bridge

The **production standard is the official Meta WhatsApp Cloud API only** (F4.1; the deploy guardrails forbid suggesting WhatsApp-Web automation). Enforced platform rules on the compliant path:

- **Webhook verify handshake** (GET) at `https://wa.<domain>/webhooks/whatsapp`; the `messages` field is subscribed.
- **HMAC signature verification** — `X-Hub-Signature-256` over the **raw** request body with the app secret; a tampered payload → 401.
- **Idempotency** via `wamid` dedupe — a duplicate inbound produces a single Discourse post.
- **24-hour window** — free-form replies allowed in-window; outside it, only the approved `community_reply` template (templates in `whatsapp/message-templates.json`, submitted for approval).
- **Opt-out** — STOP / UNSUBSCRIBE suppresses outbound until the member writes again; opted-out members are treated as unmapped.
- **Phone privacy (#5)** — the number is the map key only, **never returned by any endpoint or written into a post**; logs use a salted hash; unmapped senders post as a guest with a join CTA. Demo phone numbers are generated server-side in the fiction-reserved `+1-555` range and sent only to wa-bridge.

> **Known architectural tension (documented, not hidden).** The official Cloud API **cannot read WhatsApp group messages**; only the unofficial `whatsapp-web.js` library can. wa-bridge therefore ships an *optional* inbound seam (`src/wa-client-live.js`, selected by `WA_BACKEND`) that is **off by default**, dependency-free until enabled, and explicitly gated behind a business go/no-go because a headless WhatsApp Web session **violates WhatsApp ToS and can get the number banned**. **Outbound notifications always use the compliant Cloud API.** The production topology and F4 acceptance treat Cloud-API-only as the standard; enabling group inbound is a deliberate, separately-approved decision, run as a single stateful instance with the paired session on a mounted volume. **Project decision (2026-07-21): WhatsApp is scoped to 1:1 intake only** — `WA_BACKEND` stays unset, `whatsapp-web.js`/Chromium are never installed, and group mirroring is out of scope unless re-approved as an exception (see `docs/SECURITY-COMPLIANCE.md`).

### 7.4 Key integration sequences

**(a) WhatsApp inbound → feed (consent-gated mirror).** `integrations.injectWhatsApp` self-heals against a cold start (re-probes once if the bridge looks down) and prefers the real bridge; the built-in fallback honours the same consent rule so a demo never blocks:

```
member sends WA group message
      │
      ▼
wa-bridge  ── maps phone→member (opt-out ⇒ treated as unmapped) ── dedupe by wamid
      │  POST /posts.json  (Discourse-compat surface, Api-Username = member)
      ▼
v4 createMirroredPost() ── if author has NOT consented (waConsentMirror=false) ⇒ demote to
      │                     "WhatsApp guest" attribution (never a phone number)
      │                  ── stripPhoneNumbers(title, raw) on the way in
      ▼
post appears in the feed, via:"whatsapp", attributed to pseudonym (or guest + join CTA)
```

**(b) Registration → provisioning → SSO.** On invite or open registration the app fires the same HMAC-signed `user_confirmed_email` webhook Discourse would send:

```
POST /api/session (invite) or /api/register
      │  startSession() sets dsq_session cookie
      ▼
integrations.provisionGhostfolio(user)  ── HMAC sha256 over raw body
      │   gf-provisioner reachable? ── no ⇒ record simulated account (built-in sim), best-effort
      ▼   yes ⇒ POST /discourse/webhook ⇒ create/link ONE Ghostfolio account (idempotent by userId/email)
later: POST /api/me/portfolio/sso
      ▼
gf-provisioner GET /sso/:userId ⇒ short-lived HMAC token ⇒ url → /sso/click
      ▼   verify token → exchange stored security token for JWT → 302 into /{lang}/auth/:jwt
authenticated Ghostfolio dashboard for the correct account
```

Outbound reply notifications follow the mirror image of (a): `POST /api/posts/:id/comments` calls `notifyWhatsApp`, which fires only when the recipient has `waLinked && waNotifs` and the bridge is up, exactly as Discourse's `notification_created` webhook would.

---

## 8. Security & privacy architecture

- **Secrets.** GCP Secret Manager is the source of truth for the Meta token, Discourse API key, and bridge/webhook secrets; `.env` files live only on the VM at mode `600` and are never committed (`.gitignore` covers `.env` and `data/db.json`).
- **Transport.** Caddy terminates TLS with automatic Let's Encrypt certificates (works with sslip.io in demo); Discourse `force_https` on.
- **Sessions.** HttpOnly + SameSite=Lax cookies; server-side session table; scrypt password hashing with `timingSafeEqual`.
- **Webhook integrity.** All inbound webhooks (Discourse→sidecars, WhatsApp→bridge) are HMAC-verified over the raw body; `safeEqual`/`timingSafeEqual` guard comparisons.
- **Pseudonymity.** Handles are validated to never be all-digits (nothing that reads like a phone number); `stripPhoneNumbers` (broad `PHONE_PATTERN` + bare 10–15 digit runs) runs on every write; member serializers carry no email or phone.
- **Least exposure on public APIs.** The teaser emits pseudonym + counts + currency-scrubbed snippets only — no bodies, cards, email, phone, or currency. Anonymous callers 401 everywhere else.
- **Network.** SSH is IAP-only (public port 22 closed); firewall admits only 80/443 to the `web` tag; unattended-upgrades enabled.

### Constraint → enforcement map

| Constraint | Concrete enforcement point |
|---|---|
| #3 flags private | `POST /api/posts/:id/flag` writes `reviewQueue` only; `myFlagFor` returns viewer's own flag/null; `/api/review-queue*` mod-gated; `mod_remove` event logs the action, never who flagged |
| #4 dollars owner-only | `GET /api/users/:id` owner/public/private branch; `meVM`/`authorCard` never carry value; gf-provisioner strips value for non-owner viewers |
| #5 WhatsApp consent + no E.164 | `stripPhoneNumbers` on all writes; consent checks in `createMirroredPost`/`notifyWhatsApp`/`syncWaConsent`; wa-bridge phone-as-key + salted-hash logs; demo phones server-side only |
| #7-A anonymous 401/403 | dispatcher gate (`auth` default true; mod/admin group checks); only 5 public routes |
| #8 percent-only maven | percent index 100@inception; gf-stats whitelist serializer; inline `/[$₹£]\s?\d/` live-feed guard; leak-sweep on golden + poisoned fixtures |
| #9 engagement-only recognition | `karmaFor` = reaction weights only; leaderboard/search rank karma; removed content grants no karma; no self-reaction |

---

## 9. Non-functional requirements

- **Performance.** Zero-dependency Node servers with in-memory state + debounced disk writes; member API reads are single-process map lookups (sub-10 ms typical). Teaser and feed are computed on request from ≤ a few hundred seeded/live posts at pilot scale (< 1k members). Sidecar probes time out at 1.5 s; live cross-service calls at 4–8 s with graceful fallback so a slow upstream never blocks a page.
- **Availability / SLOs.** Pilot target **99.5% monthly** for the web surfaces. Health endpoints on every service (`/api/health`, `/health`, `/healthz`, Ghostfolio `/api/v1/health`, Discourse `/about.json`). Cloud Monitoring uptime checks on all four public URLs (`community.` / `app.` / `folio.` / `wa.`) with email alerting; a billing budget alert (~$150/mo) guards runaway cost.
- **Backups & DR.** Discourse built-in **nightly backups, 7-day retention**; `scripts/04-backups.sh` + cron push **nightly offsite backups** for both VMs to a GCS bucket with a 30-day lifecycle. A **restore drill is a launch gate (F5.2)**: a Discourse backup must restore and the Ghostfolio dump must load into a scratch Postgres, run quarterly thereafter. Targets: **RPO ≤ 24 h** (nightly), **RTO ≤ 4 h** (rebuild VM from image + restore). Rollback: Discourse `./launcher rebuild app` on reverted `app.yml` (data persists in `/var/discourse/shared`); apps stack `docker compose down && git checkout <prev> && up` + DB restore.
- **Scalability & the F6 evolution path.** Two VMs (discourse-1 `e2-medium`, apps-1 `e2-standard-2`) carry the pilot vertically. Beyond it (explicitly out-of-scope for F0–F5, on-demand per roadmap Phase 6): VM resize triggers → **Cloud Run** for the stateless app/sidecars, **Cloud SQL** for Postgres, **Memorystore** for Redis, **GKE Autopilot** (with wa-bridge as a StatefulSet+PVC given its single-instance session), and a CDN. The zero-dependency, file-store-maps-1:1-to-Postgres design is what makes this a config/plumbing migration rather than a rewrite.
- **Env-var reference.** See Appendix (§13); every value is optional in dev (the app runs fully standalone with no `.env`).

---

## 10. Observability

- **Google Ops Agent** on both VMs (metrics + logs to Cloud Monitoring/Logging).
- **Uptime checks** on the four public URLs with email alerting; health endpoints back each check.
- **Structured logs.** Each service logs `[service] kind: detail` lines; the v4 `events` ring buffer (capped 200) records wa-inbound, webhooks, provisioning, and moderation actions — **never phone numbers**, and moderation events never record who flagged. gf-stats logs status + timing only, never Ghostfolio payload bodies (they carry values).
- **WhatsApp quality monitoring.** Monthly review of Meta Business Manager WhatsApp **quality rating** and template status (steady-state ops cadence); token/quality check is a recurring operational task.

---

## 11. Testing & quality strategy

- **Per-service `node --test`.** models-service (fixture recompute ±0.1%, immutability 409, webhook idempotency, `sincePct` SELL sign-flip), gf-provisioner (8 unit tests + offline smoke: register → provision → summary → SSO), wa-bridge (12 unit tests + smoke: map → mirror → dedupe → guest).
- **v4 forum suites** (`node --test test/*.test.js`): `api.test.js` (core flows), `privacy.test.js` (E.164 / email leak sweeps), `increment.test.js` (incremental acceptance), `robustness.test.js` (malformed input, cookie faults, oversized bodies), `compat.test.js` (Discourse-compat surface), `hub.test.js` (EP-03 Hub: `$`-free/PII-free/percent-only directory, ordering ≠ returns, member-gated booking with a never-echoed phone-in-note, guide-by-slug), `extended.test.js`. `helpers.mjs` boots an ephemeral server per suite; the full v4 suite runs **52/52** green.
- **Leak-sweep (`leak-sweep.test.mjs`, story 12.5).** The machine backstop for #8: forbidden keys/value-patterns asserted on the golden example and a poisoned Ghostfolio fixture; must run in CI.
- **50-user community simulation (`test/community-sim/`).** Turns an empty Discourse into a living DesiSquare — 50 pseudonymous members across 6 corridors (2 mavens), 15 multi-turn discussions (59 replies), a native poll, a maven AMA, and two deliberate policy-violating posts — then runs **14 acceptance use-cases (UC1–UC14)** mapped to the story corpus and emits Markdown + JSON reports. Notable checks: UC9 private-flag → review queue (#3), UC10 signed-out member endpoints 403 (#7-A), UC11 no E.164/emails in payloads (#5), UC14 engagement leaderboard derivable but never money (#9). A bundled mock Discourse lets the whole pipeline self-test with no live forum. `WARN` (not `FAIL`) is used where a check depends on instance config the runbooks own.
- **Cross-service smoke** (`make smoke`, `v4/scripts/smoke.mjs`) boots the services wired together and runs the acceptance gates.
- **Browser verification.** SSO one-click and the signed-baseline maven chart are verified in a real browser against live Ghostfolio v3.21.0.

---

## 12. Deployment & environments

| Environment | How | URL / topology |
|---|---|---|
| **Dev (v4 forum only)** | `make v4` (or `make dev-v4` to also run gf-provisioner + wa-bridge + models-service) | http://localhost:8786; sidecars on 8788/8789/8791; degrade to seeded fallback |
| **Dev (v2/v3 product app)** | `make dev` | http://localhost:5191 + 3 services |
| **Demo** | `deploy/gcp/` DEMO mode — sslip.io wildcard DNS, Let's Encrypt, ~1 hour, email stubbed | `community\|app\|folio\|wa.<IP>.sslip.io` |
| **Production** | `deploy/gcp/RUNBOOK.md` — real domain, Brevo SMTP (587), Meta verification | `community.<domain>` → discourse-1; `app./folio./wa.<domain>` → apps-1 behind Caddy |

Production is delivered as an ordered increment register — **F0 (accounts/prereqs) → F1 (GCP foundation) → F2 (Discourse) → F3 (Ghostfolio + app) → F4 (WhatsApp) → F5 (ops/hardening/launch)** — each with a testable acceptance table in `deploy/gcp/REQUIREMENTS.md`; complete one increment per session and finish with its acceptance table. Read `deploy/gcp/CLAUDE.md` first (it defines DEMO vs PRODUCTION mode). Web is live in ~2 days; WhatsApp production in 1–3 weeks (Meta Business Verification is the critical path — start Day 0). Additional deploy references: `v4/RUNBOOK.md`, `v4/DEPLOY.md`, `v4/PRODUCTION.md`, and the WhatsApp setup guide `deploy/gcp/whatsapp/WHATSAPP-SETUP.md`. Secrets never printed or committed; `.env` stays on the VM (mode 600), Secret Manager is the production source of truth.

---

## 13. Appendix — environment variable reference

No real secrets appear here; values are placeholders. In dev every variable is optional — with no `.env` the app runs fully standalone.

| Variable | Service | Purpose | Example (placeholder) |
|---|---|---|---|
| `PORT` | v4 app / each service | Listen port | `8786` (app), `8791/8789/8788` (services) |
| `PUBLIC_URL` | v4 app | External base URL for links | `https://app.example.com` |
| `DATA_DIR` | v4 app | Override state directory | `/opt/desisquare/data` |
| `MIRROR_SPACE` | v4 app | Space WhatsApp posts mirror into | `help` |
| `DISCOURSE_URL` | v4 app / models-service | Discourse base (unset = standalone) | `https://community.example.com` |
| `DISCOURSE_API_KEY` | integrations / sim | Global API key (user `system`) | `<secret>` |
| `DISCOURSE_WA_CATEGORY_ID` | apps-stack | WhatsApp Intake category id | `14` |
| `DISCOURSE_WEBHOOK_SECRET` | app / gf-provisioner / wa-bridge / models-service | Shared HMAC secret (same value across services) | `<secret>` |
| `COMPAT_API_KEY` | v4 compat surface | Pin the wa-bridge-facing Api-Key (empty = any non-empty) | `<secret>` |
| `GUEST_USERNAME` | v4 compat surface | Attribution for unmapped senders | `system` |
| `WA_BRIDGE_URL` | v4 app | wa-bridge base | `http://localhost:8788` |
| `GF_PROVISIONER_URL` | v4 app | gf-provisioner base | `http://localhost:8789` |
| `GHOSTFOLIO_URL` | v4 app / gf-provisioner | Ghostfolio base | `http://localhost:3333` |
| `GHOSTFOLIO_LIVE` | gf-provisioner | Enable live Ghostfolio client (else mock) | `true` |
| `SSO_TTL_SECONDS` | gf-provisioner | Lifetime of the 1-click SSO token | `120` |
| `MAILHOG_URL` | v4 app (dev) | Local mail catcher link | `http://localhost:8025` |
| `WA_BACKEND` | wa-bridge | Inbound client seam (`mock` \| `whatsapp-web.js`) | `mock` |
| `WA_CLOUD_TOKEN` | wa-bridge | Meta Cloud API token (outbound) | `<secret>` |
| `WA_PHONE_NUMBER_ID` | wa-bridge | Cloud API phone-number id | `<id>` |
| `ALLOWED_GROUPS` | wa-bridge | Allow-listed group JIDs (empty = dev allow-all) | `<jid>` |
| `PRICES_MODE` | models-service | `fixture` (default) \| `live` | `fixture` |
| `PRICES_FIXTURE` | models-service | Path to committed price fixture | `./test/fixtures/prices.json` |
| `PRICES_API_URL` / `PRICES_API_KEY` | models-service | Live EOD feed (live mode only) | `<url>` / `<secret>` |
| `BENCHMARK` | models-service | vs-benchmark instrument | `SPY` |
| `REPRICE_INTERVAL_MINUTES` | models-service | >0 runs the reprice job on a timer | `0` |
| `DOMAIN` | apps-stack | Base domain / sslip.io host | `<IP>.sslip.io` |
| `ACME_EMAIL` | apps-stack (Caddy) | Let's Encrypt registration email | `admin@example.com` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Discourse | Transactional email relay (Brevo, port 587) | `smtp-relay.brevo.com` / `587` / `<user>` / `<secret>` |

---

*End of TRD. This document must stay consistent with the six constraints in §1; the leak-sweep CI (story 12.5) is the machine backstop for any change touching maven/portfolio surfaces.*
