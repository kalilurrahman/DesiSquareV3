# DesiSquare Project — Handoff Index (for any new Claude session)

> **BiGMo Consulting · 19 Jul 2026.** Paste this document (or its raw GitHub URL) into a new Claude session to restore full project context. Everything listed is committed on **`kalilurrahman/bigmo-consulting`**, branch **`claude/discourse-ghostfolio-forum-analysis-bvm3v7`**.

## 30-second context brief

**DesiSquare** = a members-only community for South-Asian ("desi") retail investors, built as **Discourse** (forum, custom "Porcelain Slate" light theme — client-selected 19 Jul 2026; dark & Haldi lanes rejected) + **Ghostfolio** (self-hosted portfolio tracker, bounded reskin only) + **WhatsApp Business Cloud API** (opt-in notifications; never the forum), glued by three small scripts: **wa-bridge** (WhatsApp→forum mirroring, consent-gated), **gf-provisioner** (signup→one Ghostfolio account, idempotent, 1-click SSO), **gf-stats** (percent-only maven performance proxy). The demo site the client originally shared (`desisquare-production.up.railway.app`) is a rebranded Ghostfolio on Railway.

**Non-negotiable constraints:** #3 flags are private (5 reasons → mod review queue) · #4 portfolio dollars owner-only, public = allocation % only · #5 WhatsApp mirroring consent-gated, E.164 numbers never leak · #7 signed-out gate (member APIs 401) · #8 percent-only maven pipeline (currency stripped server-side, CI leak-sweep).

**Client feedback history:** F1 universal search (All/Communities/Posts/Comments/Profiles, Reddit-style) → W13. F2 maven performance proof (eToro-referenced, % only, asset values never visible) → W14 + gf-stats. F3 popular posts on the landing feed + per joined community (Reddit Hot) → W3 sort + W15. **F4** ticker/label search (`$NVDA`, `tags:fema`) → stories 4.6–4.8. **F5** conversation labelling — manual (tags/tag groups), automated (discourse-automation + Discourse AI triage), moderator-curated → Epic 14. **F6** public landing with popular-discussion **summaries** (Reddit-style cards, Discourse AI summarization) + per-community best-of → Epic 15, **amending #7 → #7-A** (curated public teaser allowed; everything else stays gated). Theme lane locked: **1c Porcelain Slate**.

## Live artifacts (viewable/shareable pages)

| Artifact | URL |
|---|---|
| **Interactive prototype — Wireframes v3** (full clickable walkthrough: landing → sign-in roles → popular feed → post detail → search → maven proof → communities → settings → mod review queue) | https://claude.ai/code/artifact/6f94a2f2-95dd-4ffa-bf7b-0a81ada43774 |
| **Feasibility report (branded visual)** — Discourse+Ghostfolio+WhatsApp critical analysis | https://claude.ai/code/artifact/a6d82b9c-1519-4329-84b1-dd630e9bdd6c |

## Repository documents (branch `claude/discourse-ghostfolio-forum-analysis-bvm3v7`)

Base URL for raw/blob links: `https://github.com/kalilurrahman/bigmo-consulting/blob/claude/discourse-ghostfolio-forum-analysis-bvm3v7/`

### Strategy & analysis
| Doc | Path |
|---|---|
| Comprehensive feasibility report (verified; what's possible vs not) | `docs/discourse-ghostfolio-whatsapp-community-forum-feasibility.md` |
| Branded HTML version of the report | `docs/desisquare-feasibility-report.html` |
| Seamless delivery playbook (the five integration seams) | `docs/desisquare-seamless-delivery-playbook.md` |

### Product (Phase 1.5 "Trust & Discovery")
| Doc | Path |
|---|---|
| Phase 1.5 plan & approach (F1/F2/F3 specs, sprints, compliance, decisions incl. Porcelain Slate lock) | `docs/desisquare-phase1b-trust-and-discovery-plan.md` |
| **User stories v2** — 85 stories / 15 epics / 7 personas, G/W/T acceptance criteria, P0-P2 (F4/F5/F6 included) | `docs/desisquare-user-stories.md` |
| **Wireframe catalog** — every frame W1–W15, constraint ledger, flow map, traceability | `docs/desisquare-wireframes-v3-catalog.md` |
| **Interactive prototype source** (single-file HTML; open directly in a browser) | `docs/desisquare-wireframes-v3-prototype.html` |

### Engineering contracts
| Doc | Path |
|---|---|
| gf-stats API contract v1.0 (%-only maven service; endpoints, auth/consent, cache, KPI derivations) | `docs/gf-stats-contract/README.md` |
| Golden example response | `docs/gf-stats-contract/example-response.json` |
| Reference whitelist serializer (constraint #8 enforcement pattern) | `docs/gf-stats-contract/serializer.mjs` |
| Leak-sweep CI test (`node leak-sweep.test.mjs` — passing) | `docs/gf-stats-contract/leak-sweep.test.mjs` |

### Demo-server install runbooks (researched July 2026, adversarially fact-checked)
| Doc | Path |
|---|---|
| **00 Overview** — topology, dependency-ordered install plan, end-to-end acceptance script | `docs/runbooks/demo-install-00-overview.md` |
| **01 Discourse** — 10 stages: bootstrap → setup wizard → Brevo SMTP/DKIM → invite gate → theme/palette lockdown → Hot default → webhooks → backups | `docs/runbooks/demo-install-01-discourse.md` |
| **02 Ghostfolio** — pinned compose + .env, first-admin token warning, market data, OIDC, Caddy, backups/upgrades | `docs/runbooks/demo-install-02-ghostfolio.md` |
| **03 WhatsApp** — Meta app/test number/tokens, first sends, webhooks→wa-bridge, template library, consent (#5), US marketing pause (131049), demo→prod path | `docs/runbooks/demo-install-03-whatsapp.md` |

## How to load this in a new Claude session

- **Claude Code (web/CLI) with this repo:** add/open `kalilurrahman/bigmo-consulting`, then `git fetch origin claude/discourse-ghostfolio-forum-analysis-bvm3v7 && git checkout claude/discourse-ghostfolio-forum-analysis-bvm3v7` — everything is under `docs/`.
- **Any Claude chat:** paste this document, or the raw URL of any doc above (`https://raw.githubusercontent.com/kalilurrahman/bigmo-consulting/claude/discourse-ghostfolio-forum-analysis-bvm3v7/docs/<path>`), or upload the `desisquare-demo-pack.zip` bundle.
- The two artifact URLs render in the browser and can be shared from their page menus.

## Open questions awaiting the client

1. Benchmark per corridor for the maven chart (S&P 500 TR for US; Nifty 50 TR for India?).
2. Minimum history before a track record renders (proposed: 6 months).
3. gf-stats refresh cadence (proposed: daily).
4. Performance profiles maven-exclusive in Phase 1.5, or member opt-in later (proposed: maven-exclusive).
5. ~~Public teaser on the signed-out landing~~ — **DECIDED via F6 (19 Jul 2026):** the landing now shows curated popular-discussion summaries under the amended #7-A boundary (public corridors only; member endpoints stay gated). Remaining sub-decision: whether the teaser page should be indexable (currently `noindex`).
