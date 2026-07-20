> ⚠️ **HARNESS SELF-TEST** — run against the bundled in-memory mock (`mock/mock-discourse.mjs`), not a live community. It proves the pipeline end-to-end; the real report regenerates in `report/` when run against a live Discourse.

# DesiSquare — 50-User Community Simulation Report

**Target:** http://127.0.0.1:3939 · Discourse mock-3.5.0 · run 2026-07-20T06:44:58.805Z
**Outcome:** 14 passed · 0 warnings · 0 failed (of 14 use-cases)

## What was simulated

- **51 pseudonymous members** across 6 corridors (US 16 · CA 8 · UK 8 · AE 6 · AU 6 · SG 6), incl. 2 mavens and 1 flag-exercise account.
- **15 discussions / 59 replies** of realistic multi-turn dialogue: FEMA repatriation, Roth-vs-traditional on H-1B, rebalancing bands, $NVDA trim debate, FCNR rate shopping, ISA-vs-pension, TFSA cross-border, DIFC gratuity, CPF-vs-SRS, super on 482, buy-vs-remit real estate, a weekly ritual with a **native poll**, a maven **AMA with pinned recap**, term insurance, GIFT City fine print.
- **169 reactions**, 6 accepted answers, 3 private flags on 2 policy-violating posts.
- Labels exercised: 401k, ama, cpf, discussion, fcnr, fema, guide, insurance, isa, nvda, poll, question, real-estate, roth, super, tfsa, weekly-watch.

## Acceptance results

| # | Use case | Result | Evidence |
|---|---|---|---|
| UC1 | User provisioning: 50 pseudonymous members active & postable (story 1.2/1.4 analog) | ✅ PASS | 51 created, 0 pre-existing, 0 failures |
| UC2 | Labelled posting: topics created with required labels (14.1) | ✅ PASS | 15/15 topics, all with tags |
| UC3 | Threaded dialogue: multi-turn replies land in-thread (2.4) | ✅ PASS | 59/59 corpus replies across 15 topics |
| UC4 | Reactions: structured feedback accrues (3.1/3.2) | ✅ PASS | 169 reactions applied (0 failures) |
| UC8 | Accepted answers mark solutions (Solved / karma 21.1 input) | ✅ PASS | 6 accepted |
| UC9 | Private flags route to the mod review queue (3.3/9.1, #3) | ✅ PASS | 3 flags filed; 2 reviewable(s) in queue |
| UC5 | Search by general text finds discussions (4.1) | ✅ PASS | search "FEMA" → 1 topics, FEMA guide found |
| UC6 | Search by ticker label: tags:nvda + label hub page (4.6/4.7, 20.1) | ✅ PASS | tags:nvda → 1 topics; /tag/nvda → 1 topics |
| UC7 | Popular surfaces the highest-engagement discussions (2.1/F3) | ✅ PASS | /hot returned 17 topics |
| UC12 | Profiles are pseudonym-only to other members (1.4/4.3) | ✅ PASS | member-view profile payload contains no email |
| UC13 | Native poll renders on the ritual thread (18.4/19.2) | ✅ PASS | polls[] present on first post |
| UC10 | Signed-out gate: member endpoints 403/redirect anonymously (#7-A, 1.1/4.4) | ✅ PASS | /latest.json→403 · /search.json?q=FEMA→403 · /u/quiet_lotus.json→403 · /tag/nvda.json→403 · /hot.json→403 |
| UC11 | Leak scan: no E.164 numbers, no emails in thread payloads (#5, 12.5) | ✅ PASS | 6 thread payloads scanned, 0 hits |
| UC14 | Engagement leaderboard derivable — by karma, never by returns (#9, 18.1/21.5) | ✅ PASS | top: nikhil_cfa(42), priya_ea(20), h1b_horizon(12), masala_momentum(7), toronto_totka(6) |

## Community pulse (from seeded engagement — engagement only, #9)

| Rank | Member | Reactions received |
|---|---|---|
| 1 | nikhil_cfa | ▲ 42 |
| 2 | priya_ea | ▲ 20 |
| 3 | h1b_horizon | ▲ 12 |
| 4 | masala_momentum | ▲ 7 |
| 5 | toronto_totka | ▲ 6 |
| 6 | first_gen_saver | ▲ 6 |
| 7 | chai_and_charts | ▲ 6 |
| 8 | maple_moong | ▲ 6 |

## Notes

- All dialogue bodies are percent/ratio-based — no personal portfolio currency amounts — so public-surface leak scans stay clean by construction.
- The two flagged posts ("guaranteed returns" solicitation, low-effort) exercise the 3.3 → 9.1 private-flag pipeline; moderate them from /review.
- WARN rows are configuration follow-ups (runbook stages), not seeding failures.
