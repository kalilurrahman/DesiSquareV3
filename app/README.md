# desisquare-app/ — the DesiSquare product app

Runnable recreation of the hi-fi clickable prototype
(`design_handoff_desisquare_build/design-refs/DesiSquare Prototype.dc.html`) as a
**zero-dependency** web app: one HTML file + one Node 22 server, no build step, no npm installs.
Seed content mirrors the prototype exactly (same pseudonyms, posts, models, KB articles) so
**demo == design**; live data from the local stack augments it with **LIVE** chips and every
card degrades gracefully back to the seeded content when its upstream is down.

```bash
cd desisquare-app && node serve.mjs      # http://localhost:5191  (PORT env-overridable)
```

## Routes (hash-routed views)
| Route | View | What's on it |
|---|---|---|
| `#/` (also `#/feed/:space`) | Community feed | inline composer (dedup-as-you-type ≥300 ms debounce, Space chips, Signal chips default None), post cards with 4 reaction pills + ⋯ 5-reason flag menu, Spaces sidebar, rail: community card, mavens box, moderator calendar, KB cta |
| `#/home` | Communities | country-scoped community list (COMMON · FREE / PUBLIC / PRIVATE), Join / Request to join; rail: Trending desis + Why trust DesiSquare. Country switcher in the top bar swaps the list live and persists (localStorage) |
| `#/post/:id` | Post detail | full body, reactions, comments, ✓ MARKED ANSWER, Convert to KB article (moderator action), public reply box |
| `#/maven/:id` | Maven profile | verified credentials, 4-dim reputation meters, documents, reviews, investment model cards with sparklines, signal-record table with green/red performance-since |
| `#/directory` | Expert directory | specialty filters (All/Tax/Equities/Retirement), maven cards with karma/followers/Follow |
| `#/kb` | Knowledge base | search (top-bar search + Enter lands here too), article cards with provenance, empty state |
| `#/me` | My activity | profile header (PEER · DESI-VERIFIED), My posts / My comments / Karma ledger tabs; rail: portfolio (private **by default**; public = allocation % only) + Following |
| `#/settings` | Settings | WhatsApp mirror **consent** toggle + notifications toggle (act immediately, with toasts), display name, portfolio visibility, verification checklist |
| `#/mod` | Moderation | structured-flag queue ("Remove + ban posting 3 days" → resolution line), moderator-managed calendar |

## How it talks to the stack (same-origin proxy in serve.mjs)
```
/api/ai/*        → :8787   ai-service       (dedup-as-you-type via POST /ask citations)
/api/wa/*        → :8788   wa-bridge        (GET /health → WhatsApp connected LIVE chip)
/api/gf/*        → :8789   gf-provisioner   (reserved for portfolio wiring)
/api/models/*    → :8791   models-service   (GET /users/:id/models + /models/:id/metrics
                                             → model cards; GET /users/:id/signals → signal table)
/api/discourse/* → :8080   Discourse core   (reserved; optional API-key injection server-side)
```
No CORS changes anywhere — in GCP this proxy becomes the LB route-map. All upstreams are
**optional**: any 502/timeout falls back to the seeded prototype content, so the app always
demos standalone. Free-only MVP: stripe-bridge is deliberately **not** proxied (Phase L).

### Live wiring details
- **Model cards + signal record** (maven profile): the app asks models-service for each maven's
  models by their pseudonym username (`nikhil_cfa`, `priya_taxes`, `arjun_quant` — the same ids
  the Discourse webhook stamps from `post.username`), matches them to the seeded models **by name**
  ("Steady Compounder", "Dividend Ladder", "Momentum Sleeve"), then renders
  `GET /models/:id/metrics` (`cagr`, `vsBenchmark`, `maxDrawdown`, `since`, `series[]`) and
  `GET /users/:id/signals` (`kind`, `stampedAt`, `sincePct`) with a LIVE chip.
- **Dedup-as-you-type**: if ai-service is up, the composer title is sent (debounced 320 ms) to
  `POST /api/ai/ask` and the returned citations become the "Already answered?" suggestions
  (LIVE chip); otherwise the seeded KB keyword match runs — typing "FCNR…" always surfaces
  the KB article.
- **WhatsApp status**: `GET /api/wa/health` lights the sidebar + Settings LIVE chips.

## Product rules honored (CLAUDE.md — test, don't trust)
- Phone numbers appear **nowhere** — not even masked or partial digits. Settings renders the
  digit-free label "number verified & hidden". (The hi-fi prototype's masked
  `+1 ····· ··84` string was deliberately dropped: rule 1 bans phone-derived digits —
  country code, trailing digits — from any UI, and a masked pattern carried onto live data
  would leak partial PII in screenshots/exports. Keep it digit-free when this surface is
  rebuilt on the Discourse theme.)
- Pseudonyms by default (`quiet_lotus`); real names only on verified mavens.
- Negative feedback (5 flag reasons) shows a **quiet inline confirmation** — "sent privately to moderators", never public state.
- Portfolio defaults **private**; public mode exposes allocation % only.
- WhatsApp mirroring is a per-user consent toggle in Settings.
- Persistent "not investment advice" disclaimer on feed + maven surfaces.
- Emoji only in the 4 reaction labels + country flags (design §8).

## Config
Copy `.env.example` → `.env` (git-ignored) to override the port or upstream URLs. Nothing is
required — defaults target the local stack.
