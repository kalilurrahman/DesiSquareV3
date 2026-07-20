# DesiSquare Project — Handoff Index (for any new Claude session)

> **BiGMo Consulting · 20 Jul 2026.** Paste this document (or its raw GitHub URL) into a new Claude session to restore full project context. Everything listed is committed in **`kalilurrahman/DesiSquareV3`** — this repository is the product source of truth for **Product Version 3 ("The Living Square")**. The prior doc branch on `kalilurrahman/bigmo-consulting` (`claude/discourse-ghostfolio-forum-analysis-bvm3v7/docs`) is superseded by this repo.

## Lineage & code integration (20 Jul 2026)

This repo is the **final integrated product**, standing on the two prior codebases: **v1** `kalilurrahman/DesiSquare` (the runnable `phase1-mvp/` — `make demo`, plus the glue services) and **v2** `kalilurrahman/DesiSquareV2` (the `desisquare-app/` zero-dep product app + `services/models-service/` percent-only performance engine). V3 integrates the v2 product slice under **`app/`** and **`services/`** (models-service, wa-bridge, gf-provisioner), applies the Phase-1 feedback (search tabs; maven performance chart to prove expertise, leveraging Ghostfolio, **asset value never visible**) and the client's Maven/member visibility rules (percent-only, Monthly/Yearly/Overall, member gains visible/private), and keeps the docs/prototype/deploy/test layers already here.

## 30-second context brief

**DesiSquare** = a members-only community for South-Asian ("desi") retail investors, built as **Discourse** (forum + **Chat**, custom "Porcelain Slate" light theme — client-selected 19 Jul 2026) + **Ghostfolio** (self-hosted portfolio tracker, bounded reskin only) + **WhatsApp Business Cloud API** (opt-in notifications; never the forum), glued by three small scripts: **wa-bridge** (WhatsApp→forum mirroring, consent-gated), **gf-provisioner** (signup→one Ghostfolio account, idempotent, 1-click SSO), **gf-stats** (percent-only maven performance proxy) — plus a **digest job** that builds the public teaser. Deployment target: **GCP, 2 VMs** (`deploy/gcp/`, demo mode on sslip.io). The client's original demo (`desisquare-production.up.railway.app`) is a rebranded Ghostfolio on Railway.

**Non-negotiable constraints:** #3 flags are private (5 reasons → mod review queue) · #4 portfolio dollars owner-only, public = allocation % only · #5 WhatsApp mirroring consent-gated, E.164 numbers never leak · #7-A signed-out visitors get only the curated public teaser (member APIs 401, incl. chat/presence/search) · #8 percent-only maven pipeline (currency stripped server-side, CI leak-sweep) · **#9 (new in v3) recognition ranks engagement, never money**.

**Requirement history:** F1 universal search → W13. F2 maven performance proof (% only) → W14 + gf-stats. F3 popular posts on landing feed + per joined community → W3 sort + W15. **v2 (19 Jul):** F4 ticker/label search, F5 labelled conversations (manual + automated + moderated), F6 public landing summaries (Reddit-style cards, Discord best-of) → #7 amended to #7-A. **v3 (20 Jul):** R1–R3 restate and deepen F4–F6; **R4 "as lively and interactive as possible, leveraging the power of Discourse"** → Epics 16–20 (live feed & presence, Squares Chat, recognition & playfulness, live events & AMAs, Market Pulse ticker hubs). **R5 karma** (carried from the parallel karma build, remapped: their Epic 16/W17/Stage 8C → our Epic 21/W18/runbook-01 Stage 8C): weighted earning + anti-gaming, byline karma chips, tiers, "top contributors — by karma, never by returns", moderator karma effects, dated-changelog transparency page, five-signal maven credibility strip (7.7). Theme lane locked: **1c Porcelain Slate**.

## Repository documents (`kalilurrahman/DesiSquareV3`, branch `claude/desi-square-product-gh4xbh`)

### Product (V3)
| Doc | Path |
|---|---|
| **User stories v3 — 123 stories / 21 epics / 7 personas**, G/W/T, P0–P2, Discourse plugin mappings | `docs/desisquare-user-stories.md` |
| **Interactive prototype v4 "The Living Square"** (single-file HTML; open in a browser) | `docs/desisquare-wireframes-v4-prototype.html` |
| **Wireframe catalog v4** — frames W1–W19, constraint ledger incl. #9, flow map, traceability R1–R4 | `docs/desisquare-wireframes-v4-catalog.md` |
| User stories v2 (superseded, 85 stories) | `docs/archive/desisquare-user-stories-v2.md` |
| Prototype + catalog v3 (superseded, kept for lineage) | `docs/desisquare-wireframes-v3-prototype.html`, `docs/desisquare-wireframes-v3-catalog.md` |

### Strategy & analysis
| Doc | Path |
|---|---|
| Comprehensive feasibility report (verified; what's possible vs not) | `docs/discourse-ghostfolio-whatsapp-community-forum-feasibility.md` |
| Branded HTML version of the report | `docs/desisquare-feasibility-report.html` |
| Seamless delivery playbook (the five integration seams) | `docs/desisquare-seamless-delivery-playbook.md` |
| Phase 1.5 plan & approach (F1/F2/F3 specs, sprints, decisions) | `docs/desisquare-phase1b-trust-and-discovery-plan.md` |

### Engineering contracts
| Doc | Path |
|---|---|
| gf-stats API contract v1.0 (%-only maven service) | `docs/gf-stats-contract/README.md` |
| Golden example response · whitelist serializer · leak-sweep CI test (`node leak-sweep.test.mjs`) | `docs/gf-stats-contract/…` |

### Deployment (GCP)
| Doc | Path |
|---|---|
| **Prompted-deploy entry point** (DEMO mode: no domain, sslip.io + HTTPS, ~1h; PRODUCTION via RUNBOOK) | `deploy/gcp/CLAUDE.md` |
| **Incremental requirements register F0–F5** (one increment per session, acceptance tables; ready-to-paste prompts) | `deploy/gcp/REQUIREMENTS.md` |
| **Railway pack** — verdict (Ghostfolio clean; Discourse demo-only on frozen Bitnami image; SMTP = Pro plan), runbook Paths A/B, env samples | `deploy/railway/` |
| **50-user community simulation & acceptance suite** (personas, dialogues, UC1–UC14, report generator, mock self-test 14/14) | `test/community-sim/` |
| Roadmap (architecture, phases, costs, risks) · RUNBOOK (day-by-day go-live) | `deploy/gcp/roadmap.md`, `deploy/gcp/RUNBOOK.md` |
| Provision / install / backups / teardown scripts, apps-stack compose, wa-bridge service, WhatsApp setup | `deploy/gcp/scripts/…`, `deploy/gcp/apps-stack/…`, `deploy/gcp/wa-bridge/…`, `deploy/gcp/whatsapp/…` |

### Demo-server install runbooks (researched July 2026, adversarially fact-checked)
| Doc | Path |
|---|---|
| 00 Overview · 01 Discourse · 02 Ghostfolio · 03 WhatsApp | `docs/runbooks/demo-install-0*.md` |

## How to load this in a new Claude session

- **Claude Code (web/CLI):** add/open `kalilurrahman/DesiSquareV3` — everything is under `docs/` and `deploy/`.
- **Any Claude chat:** paste this document, or the raw URL of any doc above (`https://raw.githubusercontent.com/kalilurrahman/DesiSquareV3/<branch>/docs/<path>`).

## Open questions awaiting the client

1. Benchmark per corridor for the maven chart (S&P 500 TR for US; Nifty 50 TR for India?).
2. Minimum history before a track record renders (proposed: 6 months).
3. gf-stats refresh cadence (proposed: daily).
4. ~~Performance profiles maven-exclusive, or member opt-in?~~ **DECIDED (20 Jul 2026): any member can opt in.** Story 6.7 — members share gains **percent-only, Monthly/Yearly/Overall, never dollars**, default private (self-reported/unverified); maven proof (7.1/7.2) is the Ghostfolio-*verified* superset. Implemented in the integrated `app/` + `services/models-service/`.
5. Public teaser SEO: keep `noindex`, or open the landing digest to search engines? (#7-A currently ships `noindex`.)
6. *(new, v3)* Which corridors get a chat Square at launch — all six, or US/CA first?
7. *(new, v3)* Discourse AI needs an LLM key for summaries/triage — client to choose provider & budget (excerpt fallback works without it).
8. *(new, v3 · R5)* Confirm karma weights: Actionable & Helpful **+3** rank above Insightful **+2** (rewarding practically useful answers over interesting ones), Like +1, accepted answer +5, upheld flag −5. Easy to retune — weights live in one config table and the transparency page requires changes be dated, never silent.
