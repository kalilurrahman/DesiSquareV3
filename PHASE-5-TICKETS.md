# Phase 5 tickets (DS-2xx) — EP-03 Hub · EP-04 Deals · production deploy

*Owner: rahman.kalilur@outlook.com · created 2026-07-21 · repo: `kalilurrahman/DesiSquareV3` · branch `claude/desi-square-product-gh4xbh`*

Phase 5 brings the next roadmap slice into DesiSquareV3: the **Services & Products Hub** (EP-03)
and the **Deals & Offers Engine** (EP-04), plus the **production-deploy** prep (DS-195). This ticket
sheet bridges the epic stories to work items in *this* repo's architecture and records what shipped.

> **Continuity note.** The EP-03/EP-04 story specs originate in the sibling `kalilurrahman/DesiSquare`
> (v1/InvestClub) line, where new capability lands as `ai-service/src/<name>.js` modules. DesiSquareV3
> has a different, equally zero-dependency shape: the v4 app (`v4/src/api.mjs` route groups + a
> file-backed store in `v4/data/`) and standalone `services/`. Tickets below are **mapped to
> DesiSquareV3's real structure** — e.g. the EP-03 "hub module" is `v4/src/hub.mjs` + hub routes in
> `api.mjs`, not an `ai-service` module. No v1-repo code is imported or assumed.

## The V3 cut

| Wave | Scope | Status |
|---|---|---|
| **Wave 1** | EP-03 Hub — data model, module, public directory + catalog + guides, member booking, SPA surface, tests | ✅ **shipped** this commit |
| **Wave 2** | EP-04 Deals — object model, lifecycle, member shelf, redemption/attribution, sponsor walling; EP-03 public static hub site + SEO | ▶ planned |
| **Wave 3** | DS-195 production deploy execution (F1–F4) + key-gated activations | ⏸ gated on client GCP creds / API keys |

Status legend: ✅ done · ▶ next · ⏸ gated (needs an external input).

---

## EP-03 — Services & Products Hub (HUB-S01…S12 → DS-201…DS-206)

| Ticket | Maps | Title | Acceptance | Status |
|---|---|---|---|---|
| **DS-201** | HUB-S01/S02 | Expert directory + verified flair | `GET /api/hub` returns verified-expert cards (name, flair, credential, specialties, corridors); ordered by name, **never by returns** (#9); no email/phone (#5) | ✅ |
| **DS-202** | HUB-S03/S04 | Service catalog | Services carry a **qualitative price tier** (Complimentary/Member/Premium) — never a currency amount (#4/#8); each links to its expert | ✅ |
| **DS-203** | HUB-S05/S06 | Booking rail (member-gated) | `POST /api/hub/bookings` 401s anonymously (#7-A); a signed-in member can book; the note is phone-stripped (#5) and never echoed back; `GET /api/hub/bookings` returns the member's own | ✅ |
| **DS-204** | HUB-S07/S08 | Canonical guides pipeline (answers→guides) | Guides seeded from community answers (`sourcePostId`); `GET /api/hub/guides/:slug` resolves a programmatic page, currency-scrubbed | ✅ seed + API (auto-distillation automation → Wave 2) |
| **DS-206** | HUB-S11 | Hub SPA surface | `#/hub` renders the directory + catalog + guides + booking; `$`-free; nav entry added | ✅ |
| **DS-205** | HUB-S09/S10/S12 | Public hub **static site** + SEO/programmatic pages | A public, no-auth hub site (roadmap-site pattern) consuming the public `/api/hub` endpoints; sitemap + per-guide/expert pages; `noindex` posture confirmed with the user | ▶ Wave 2 |

**Wave-1 evidence:** `v4/src/hub.mjs` (percent-only, identity-safe serializers), hub routes in
`v4/src/api.mjs`, `hub` store key in `v4/src/store.mjs` + `v4/data/seed.json`, SPA `renderHub()` +
`#/hub` route + `hub-book` action in `v4/public/app.js`, styles in `v4/public/styles.css`, and
`v4/test/hub.test.js` (5 tests: directory %-only/$-free/PII-free, ordering ≠ returns, booking
member-gate, unknown-service reject, guide-by-slug). Full suite **52/52 green**.

## EP-04 — Deals & Offers Engine (DLS-S01…S12 → DS-210…DS-215) — Wave 2

| Ticket | Maps | Title | Acceptance (planned) | Status |
|---|---|---|---|---|
| **DS-210** | DLS-S01/S02 | Deal object model | `v4/src/deals.mjs` + `deals` store key: id, sponsor, title, category, terms, window, caps, disclosure | ▶ |
| **DS-211** | DLS-S03/S04 | Deal lifecycle | draft → live → paused → expired state machine; server-enforced windows | ▶ |
| **DS-212** | DLS-S05/S06/S07 | Member deals shelf + **honest filtering** | member-only shelf; filters never dark-pattern; sponsored items clearly labelled | ▶ |
| **DS-213** | DLS-S08/S09 | Redemption + attribution rails | redemption tokens + attribution events; **no portfolio $ or returns** ever attached (#4/#9) | ▶ |
| **DS-214** | DLS-S10/S11 | Sponsor walling | sponsor-only surfaces gated; disclosure copy on every sponsored unit | ▶ |
| **DS-215** | DLS-S12 | Deals SPA surface | `#/deals` shelf; consistent with the Hub's design system | ▶ |

> Guardrails for EP-04: deals are **commercial offers, not portfolio value** — they must never render
> a member's dollars or returns, never appear on a recognition/leaderboard surface (#9), and every
> sponsored unit must carry a disclosure. Signed-out visitors see none of it (#7-A).

## DS-195 — Production cloud deploy (F1–F4) — Wave 3, gated

| Ticket | Title | Acceptance | Status |
|---|---|---|---|
| **DS-220** | Deploy prep (infra, backups, email, alerts) | Runbook + phased plan ready to execute | ✅ **prep complete** — see `deploy/PRODUCTION-DEPLOYMENT-GUIDE.md`, `deploy/F0-KICKOFF.md`, `deploy/DEMO-QUICKSTART.md`, `docs/SECURITY-COMPLIANCE.md`, `docs/COST-AND-SCALING.md` |
| **DS-221** | Execute F1–F4 on GCP | 2 VMs, Discourse, Ghostfolio, WhatsApp live; acceptance table green | ⏸ gated on client GCP project/billing + the F0 intake form |
| **DS-222** | Key-gated activations | Live LLM (topic summaries/auto-label), Stripe, WhatsApp Cloud template, VAPID push | ⏸ gated on the user supplying keys |

---

## Conventions honoured

- **Zero-dependency** `node:http` / `node:test`; new capability = a module + file-backed store +
  routes + a `node:test` suite (matches `karma`, `review-queue`, etc.).
- **Six non-negotiables** enforced server-side on every new surface: #3 flags private · #4 dollars
  owner-only · #5 no E.164 · #7-A anon = teaser only · #8 maven %-only · #9 recognition ≠ money.
- **CI stays green at every commit** (`node --test` in `v4/` and each service).
- Docs updated in lockstep: `docs/PRD-desisquare.md` (roadmap), `docs/TRD-desisquare.md` (hub module
  + endpoints), and the CTO dashboard reference this sheet.
