# CLAUDE.md — DesiSquareV3

This repository is the **product source of truth** for DesiSquare V3 ("The Living Square"): a Discourse + Ghostfolio + WhatsApp community for desi retail investors. It contains product docs (user stories, wireframe catalogs, interactive prototypes, contracts, runbooks) and the GCP deployment package — not application source code (Discourse/Ghostfolio are deployed upstream projects; the three glue services live in `deploy/gcp/`).

## Orientation

- **Canonical spec:** `docs/desisquare-user-stories.md` — 115 stories / 20 epics. Story numbers are stable across versions; v2 is archived in `docs/archive/`.
- **Prototypes are single-file HTML** (`docs/desisquare-wireframes-v4-prototype.html` is current) — vanilla JS, hash-routed, no build step, no external requests. Open directly in a browser. Keep them dependency-free if you edit them.
- **Deploying:** everything under `deploy/gcp/` — read `deploy/gcp/CLAUDE.md` first; it defines DEMO mode (no domain, sslip.io, ~1 hour) vs PRODUCTION mode (RUNBOOK.md). If the user references an increment (F0–F5), work from `deploy/gcp/REQUIREMENTS.md`: complete only that increment and finish with its acceptance table. Never print or commit secrets; `.env` stays on the VM.

## Non-negotiable product constraints (bind every change)

1. **#3** — flags are private (5 reasons → mod review queue); no public flag indicators, ever.
2. **#4** — portfolio dollars owner-only; public surfaces show allocation **%** only, default private.
3. **#5** — WhatsApp mirroring/notifications are consent-gated; E.164 numbers never appear anywhere.
4. **#7-A** — signed-out visitors get only the curated public teaser (digest cards + ticker counts); every member endpoint 401/403s anonymously — including chat, presence, search, events.
5. **#8** — maven performance is percent-only; currency stripped server-side in gf-stats (contract + leak-sweep in `docs/gf-stats-contract/`).
6. **#9** — recognition ranks engagement, never money: no leaderboard/badge/trending surface may use portfolio data or % returns.

If you edit any doc or prototype, keep these enforced — the leak-sweep CI story (12.5) is the machine backstop and must stay consistent with whatever you change.

## Conventions

- Positioning is **educational only — never investment advice**; keep disclaimers on every content surface (story 11.1).
- Personas: `quiet_lotus` (member), `nikhil_cfa` (maven, CFA), `desisquare_mod` (moderator); invite code `DSQ-2026`; corridors US/CA/UK/AE/AU/SG. Reuse these in examples/seed data.
- Theme is **Porcelain Slate** (light, client-locked). Don't introduce dark lanes.
- Labels = Discourse tags. The four reaction pills (Helpful / Insightful / Actionable / Like) are a fixed set — do not add reaction types.
