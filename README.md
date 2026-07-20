# DesiSquareV3 — "The Living Square"

> **Product Version 3** of DesiSquare: a members-only, pseudonymous community for South-Asian ("desi") retail investors — now as lively and interactive as the group chats it grew out of, without giving up a single privacy constraint.
>
> **Stack:** [Discourse](https://www.discourse.org/) (community engine + Chat + the v3 plugin set) · [Ghostfolio](https://ghostfol.io/) (self-hosted portfolio tracking, bounded reskin) · WhatsApp Business Cloud API (opt-in notifications + consent-gated mirroring) · three small glue services (**wa-bridge**, **gf-provisioner**, **gf-stats**) · a **digest job** for the public teaser. Theme: **Porcelain Slate** (client-selected).

## What V3 is

V1 proved the core loop (feed, posts, reactions, private flags, %-only portfolios). V1.5 added trust & discovery (universal search, maven performance proof, popular posts). **V3 makes the Square feel alive** — and lands the client's four requirements of 20 Jul 2026:

| Req | What the client asked for | Where it lives |
|---|---|---|
| **R1** | Search on general text, stock ticker, or label | Stories 4.6–4.8 + Epic 20 (ticker hubs, trending tickers) |
| **R2** | Labelled conversations — manual, automated where the tool allows, moderator-curated | Epic 14 (tags/tag groups + discourse-automation + Discourse AI triage + label-quality view) |
| **R3** | Popular discussions + summaries on the free landing page and per chosen group (Reddit-style cards, Discord-style best-of) | Epic 15 + landing ticker strip (20.4) |
| **R4** | **As lively and interactive as possible, leveraging the power of Discourse** | **New Epics 16–20:** live feed & presence, Squares Chat, recognition & playfulness, live events & AMAs, Market Pulse |

Six non-negotiable constraints bound everything: **#3** flags private · **#4** dollars owner-only, public = % only · **#5** WhatsApp consent-gated, E.164 never leaks · **#7-A** signed-out visitors get only the curated teaser · **#8** percent-only maven pipeline · **#9** *(new in v3)* recognition ranks engagement, never money.

## Repository map

| Path | What it is |
|---|---|
| **`docs/desisquare-user-stories.md`** | **The v3 corpus — 115 stories / 20 epics / 7 personas**, G/W/T acceptance criteria, P0–P2, per-story Discourse mappings. Start here. |
| `docs/desisquare-wireframes-v4-prototype.html` | **Interactive prototype v4 "The Living Square"** — open in any browser: landing digest, live feed, chat dock, events, leaderboard, ticker hub, label browse, search. |
| `docs/desisquare-wireframes-v4-catalog.md` | Frame catalog W1–W19 for the v4 prototype: constraint ledger, flow map, traceability. |
| `docs/desisquare-wireframes-v3-prototype.html` / `-catalog.md` | The prior (v1.5) prototype + catalog, kept for lineage. |
| `docs/desisquare-handoff.md` | Handoff index — paste into any Claude session to restore full project context. |
| `docs/desisquare-phase1b-trust-and-discovery-plan.md` | Phase 1.5 plan (F1/F2/F3 specs, sprints, decisions incl. Porcelain Slate lock). |
| `docs/discourse-ghostfolio-whatsapp-community-forum-feasibility.md` | Verified feasibility analysis (what's possible vs not). `docs/desisquare-feasibility-report.html` is the branded visual version. |
| `docs/desisquare-seamless-delivery-playbook.md` | The five integration seams and how to deliver them seamlessly. |
| `docs/gf-stats-contract/` | gf-stats API contract v1.0 (%-only maven service) + golden response + whitelist serializer + **leak-sweep CI test** (`node leak-sweep.test.mjs`). |
| `docs/runbooks/` | Demo-server install runbooks 00–03 (Discourse, Ghostfolio, WhatsApp), adversarially fact-checked. |
| `docs/archive/desisquare-user-stories-v2.md` | The v2 corpus (85 stories) this version supersedes. |
| **`deploy/gcp/`** | **The GCP deployment package**: provisioning scripts, Discourse install, apps-stack compose (Ghostfolio + Postgres + Redis + wa-bridge + Caddy), backups, teardown, WhatsApp setup, roadmap + RUNBOOK. `deploy/gcp/CLAUDE.md` makes it a prompted deploy — demo mode needs no domain (sslip.io + real HTTPS), ~1 hour end-to-end, `scripts/99-teardown.sh` to stop billing. |

## Quick start

- **Read the product:** open `docs/desisquare-user-stories.md`.
- **Feel the product:** open `docs/desisquare-wireframes-v4-prototype.html` in a browser. Sign in as `quiet_lotus` (member), `nikhil_cfa` (maven), or `desisquare_mod` (moderator) — or stay signed out to see the public teaser gate (#7-A).
- **Deploy the demo:** point Claude Code at `deploy/gcp/` (it picks up `CLAUDE.md`) with a billing-enabled GCP project; demo mode is the default.

## The v3 Discourse plugin set

Core: MessageBus live updates, presence, user status, polls, badges, tags/tag groups/synonyms, Hot/Top lists. Official plugins: **Chat**, discourse-reactions (locked to the four pills), discourse-gamification, discourse-calendar + post-event, discourse-automation, Discourse AI (summaries + triage), discourse-data-explorer, discourse-topic-voting, discourse-follow. The full mapping table is at the top of the user-story corpus.

## Positioning

Educational community only — **no investment advice**. Every surface carries the disclaimer; maven "performance proof" is a percent-only track record (never currency, never a solicitation); gamification never ranks money (#9). The leak-sweep CI (story 12.5) machine-enforces all six constraints on every deploy.

---

*BiGMo Consulting · 20 Jul 2026 · lineage: v1 (70 stories) → v2 (85) → **v3 (115)***
