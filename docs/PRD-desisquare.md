# DesiSquare — Product Requirements Document

**"The Living Square": a pseudonymous, educational community where South-Asian retail investors learn out loud — Discourse + Ghostfolio + WhatsApp, wrapped in a branded app layer that adds search, verified maven percent-proof, karma, and a public teaser.**

| | |
|---|---|
| **Document** | Product Requirements Document (PRD) — DesiSquare V3 |
| **Version** | 1.0 |
| **Owner** | Product (DesiSquare V3) · rahman.kalilur@outlook.com |
| **Date** | 2026-07-21 |
| **Status** | Approved for build — pilot (<1,000 members) |
| **Sits above** | `docs/desisquare-user-stories.md` (124 stories / 21 epics — the canonical acceptance corpus) |
| **Companions** | `docs/desisquare-phase1b-trust-and-discovery-plan.md` · `deploy/CLIENT-INFRA-CHECKLIST.md` · `deploy/gcp/REQUIREMENTS.md` (F0–F5) · `docs/gf-stats-contract/` |
| **Theme** | Porcelain Slate (light, client-locked) |

> **How to read this document.** This PRD is the "what & why" altitude: vision, users, goals, metrics, the six non-negotiable constraints, feature requirements by area, journeys, release plan, open decisions, and compliance posture. It does **not** describe implementation internals (Discourse plugin wiring, service topology, serializers) — those live in the user-story corpus, the deploy package, and the forthcoming TRD. Where a requirement below has a canonical acceptance test, it cites the story number (e.g. **7.2**) so the two documents never drift.

---

## 1. Vision & positioning

### 1.1 The one-line vision

DesiSquare is the place a desi retail investor goes to **learn out loud, safely** — asking real money questions under a pseudonym, next to credentialed experts who prove their track record in percentages, not dollars, and never sell anything.

### 1.2 The "Living Square"

A *square* is a public gathering place with private homes around it. That is the product: a lively commons (feed, chat, events, ticker hubs, recognition) surrounded by strictly private lives (portfolios, phone numbers, flags, real identities). "Living" is the V3 promise — the Square feels *awake*: posts surface without a refresh, threads stream, presence and typing indicators show the room is occupied, celebrations mark milestones, and corridor chat carries the fast back-and-forth. Liveliness is engineered from native Discourse machinery (MessageBus, presence, Chat, gamification, calendar) — never from an unbounded emoji wall or a money leaderboard.

### 1.3 What DesiSquare **is**

- An **educational community** for South-Asian retail investors across six diaspora corridors (US, CA, UK, AE, AU, SG).
- A **trust engine**: pseudonymous by default, credential-verified mavens, structured feedback (four reaction pills), karma that rewards helpfulness, and machine-enforced privacy.
- A **percent-only performance surface**: mavens (and, opt-in, any member) can prove a track record — Monthly / Yearly / Overall returns — sourced from a real Ghostfolio account, with currency stripped server-side.
- A **three-channel product**: Discourse (community), Ghostfolio (portfolio tracking), WhatsApp (consent-gated notifications + mirroring), unified by a branded app layer (v4).

### 1.4 What DesiSquare is **not**

- **Not investment advice, ever.** Every content surface carries the educational-only disclaimer (story **11.1**). Mavens are educators sharing track records, not advisors.
- **Not a broker or copy-trading platform.** No "copy my trades", no buy/sell signals, no price targets, no solicitation CTAs — deliberately dropped from the eToro reference (Phase 1.5 plan §2.3).
- **Not a net-worth leaderboard.** No surface ranks or celebrates money (**#9**). Recognition ranks engagement.
- **Not a public broadcast.** Signed-out visitors see only a curated teaser (**#7-A**); member content is gated by construction.
- **Not a data-mining social graph.** Follower/following lists are private by default; phone numbers never render; real names never leave admin surfaces.

---

## 2. Problem statement & target users

### 2.1 Problem

Desi retail investors are underserved at the intersection of three unmet needs: (a) **community that understands their context** — cross-border tax (FEMA, FCNR, 401k), visa-linked timelines, corridor-specific products; (b) **trustworthy expertise** — the internet is full of finfluencers whose "proof" is a screenshot, and regulators (SEBI's finfluencer enforcement) are cracking down on exactly that pattern; and (c) **privacy** — people will not discuss real money if it can be tied to their legal identity or their net worth is on display. Existing venues force a bad trade: open Reddit/Discord (lively but low-trust, no verified expertise, no portfolio truth) *or* a walled advisory product (trusted but transactional, non-communal, advice-liability-laden).

DesiSquare resolves the trade: **a lively commons with verifiable, non-advisory expertise and privacy enforced in the pipeline, not the UI.**

### 2.2 Personas

| Persona | Handle | Goals | Pains today | Jobs-to-be-done |
|---|---|---|---|---|
| **Member / seeker** | `quiet_lotus` | Learn from people in the same corridor; ask money questions without exposure; track a private portfolio | Generic forums lack desi context; fears deanonymization; doesn't know who to trust | "When I have a cross-border money question, help me get a credible answer without revealing who I am or what I hold." |
| **Maven** | `nikhil_cfa` (CFA/CFP, credential-verified) | Build reputation by teaching; prove expertise with real numbers; host AMAs | Screenshots aren't credible; regulatory risk of looking like advice; no venue that verifies credentials | "Let me prove I know what I'm talking about — in percentages, verified — and be recognized for helping, without becoming a regulated adviser." |
| **Moderator** | `desisquare_mod` | Keep the Square safe and on-brand; act on flags fast; curate labels and the public teaser | Public flag counts chill reporting; label sprawl; unsafe content on the free page | "Give me a private queue with full context and structured tools so I can keep quality high without exposing reporters." |
| **Community Admin** | (corridor owner) | Configure spaces, approve memberships, credential mavens, run events & experiments | No structure controls; credential fraud risk | "Let me shape my corridor's structure and vouch for real experts." |
| **Platform Operator (Ops)** | (GCP owner) | Deploy, back up, upgrade, and monitor the stack; keep the privacy CI green | Discourse/Ghostfolio version drift; silent leaks | "Keep the stack supported, backed up, and provably leak-free." |
| **Compliance Officer** | (guardian) | Enforce educational-only positioning; minimize finfluencer risk; protect #3/#4/#5/#8/#9 | Advisory-language creep; SEBI-style exposure | "Make sure nothing we ship reads as advice or leaks a private value." |
| **Visitor** | (signed-out) | Judge whether the community is worth joining | Walled gardens show nothing; open ones show too much | "Show me enough to want in — without seeing anyone's private content." |

Personas are reused verbatim in seed data, examples, and the demo drawer (story **12.7**). Invite code: **`DSQ-2026`**.

---

## 3. Goals, non-goals & guiding principles

### 3.1 Goals (pilot horizon, <1,000 members)

1. **Activate members fast** — a new invitee reaches a relevant feed and makes a first contribution within their first session.
2. **Make trust legible** — every contributor carries credential, karma, and (opt-in) verified track-record signals, so credibility is visible at a glance.
3. **Prove the percent-only model works** — mavens opt into performance proof and members trust it *because* no dollar figure ever appears.
4. **Feel alive** — real-time feed/thread updates, corridor chat, presence, events, and celebrations make the Square a place people return to.
5. **Keep the privacy guarantees machine-true** — the six constraints hold on every deploy, verified by the leak-sweep CI (story **12.5**), not by manual review.
6. **Ship on supported infrastructure** — the full stack runs on the GCP package (F0–F5) with tested backups and a rehearsed upgrade path.

### 3.2 Non-goals (this release)

- Investment advice, portfolio management, order routing, or any transactional/brokerage feature.
- Public (signed-out) access to member content beyond the curated teaser.
- Any money-ranked surface (leaderboards, badges, trending) — permanently excluded by **#9**.
- Native mobile apps (the responsive web/PWA surface covers mobile; story **2.5**, **12** mobile frames).
- Search-engine indexing of the community (teaser is `noindex`; opening it is a separate, explicit privacy decision — §10).
- Adding reaction types beyond the fixed four, or an unbounded emoji set.
- Dark theme or user-selectable palettes (Porcelain Slate is client-locked).

### 3.3 Guiding principles

1. **Privacy is a pipeline guarantee, not a UI convention.** Currency and E.164 numbers are stripped where the data is shaped (server-side), so a leak is not possible from the client. Whitelist, never blacklist.
2. **Consent is explicit, reversible, and logged.** Every sharing surface (allocation %, gains %, maven proof, WhatsApp) is OFF by default, opt-in, and timestamped in a consent history (story **10.1**).
3. **Recognition ranks engagement, never money (#9).** Helping the community is the currency of status.
4. **Educational-only, everywhere.** Disclaimers on every content surface; advisory/solicitation language is screened and routed to moderation.
5. **Lean on native Discourse.** Liveliness, search, chat, events, and gamification are configured Discourse machinery — additive theme components and small scripts, not a custom platform.
6. **Honest states over flattering ones.** Thin history shows "not enough history"; stale data shows a timestamp or fails closed; low samples show a warning — the product never overstates.
7. **Fixed, structured feedback.** Exactly four reaction pills (Helpful / Insightful / Actionable / Like); one reaction per member per post — a semantic choice, not a limitation.

---

## 4. Success metrics & KPIs

All metrics are defined for the pilot (<1,000 members). Targets are directional pilot goals, not contractual SLAs. **No recognition or success metric ranks, scores, or celebrates money (#9)** — engagement and trust metrics use participation signals only; portfolio/return data is never an input.

### 4.1 North-Star metric

> **Weekly Contributing Members (WCM)** — the count of members who, in a rolling 7-day window, take at least one *contribution* action (post, reply, accepted-answer, chat message promoted to a topic, poll vote, or RSVP). It captures the whole thesis in one number: people showing up *and* giving to the Square, not just lurking. **Pilot target: ≥ 35% of activated members are WCM by week 8.**

### 4.2 Supporting KPIs

| Area | Metric | Definition | Pilot target |
|---|---|---|---|
| **Activation** | Invite→activated rate | Invite codes redeemed that complete email verification + onboarding (corridor + starter spaces) | ≥ 70% |
| **Activation** | Time-to-first-value | Median minutes from activation to first feed render with ≥1 relevant post | < 5 min |
| **Activation** | First-contribution rate | Activated members who post/reply/chat within 48h | ≥ 40% |
| **Engagement** | Reactions per active member / week | Total pill reactions ÷ weekly active members | ≥ 3 |
| **Engagement** | Accepted-answer rate | Questions (label `question`) that receive an accepted answer within 7 days | ≥ 50% |
| **Engagement** | Live-surface adoption | Weekly actives who use ≥1 live surface (chat, RSVP, live feed pill) | ≥ 45% |
| **Retention** | W4 retention | Activated members active in week 4 after joining | ≥ 40% |
| **Retention** | Corridor stickiness | Members returning ≥3 distinct days/week | ≥ 20% |
| **Maven trust** | Maven proof opt-in | Credentialed mavens who publish verified performance proof | ≥ 60% |
| **Maven trust** | Answered-by-maven share | Questions receiving ≥1 maven reply within 24h | ≥ 30% |
| **Maven trust** | Credibility-strip completeness | Maven profiles rendering all five credibility signals (**7.7**) | 100% |
| **WhatsApp funnel** | Notification opt-in | Members completing verified WhatsApp opt-in (**8.1**) | ≥ 25% |
| **WhatsApp funnel** | Mirror latency SLO | Consented group messages mirrored to forum in <60s (**8.3**) | ≥ 99% |
| **WhatsApp funnel** | Opt-out honored | STOP requests ceasing all sends immediately (**8.2**) | 100% |
| **Recognition (#9-safe)** | Karma-active members | Members earning karma in a rolling 30-day window | ≥ 50% |
| **Trust & safety** | Flag-resolution time | Median hours from flag to moderator action (**9.2/9.3**) | < 24h |
| **Compliance** | Leak-sweep pass rate | Deploys where the **12.5** sweep is green (zero currency/E.164/flag/#9 leaks) | 100% (blocking) |
| **Reliability** | Public teaser freshness | Signed-out digest age at render (**12.3**) | < 2h, never silently stale |

### 4.3 Guardrail metrics (must not regress)

- **Zero** currency values or E.164 numbers on any non-owner/public surface (hard gate, blocking).
- **Zero** public flag indicators for non-moderators.
- **Zero** money fields in any leaderboard/badge/karma/trending payload.
- Disclaimer present on 100% of content surfaces.

---

## 5. The six product constraints as first-class requirements

These are **hard product requirements** that bind every feature below. They are numbered to match CLAUDE.md and the corpus. The machine backstop for all six is the **leak-sweep CI (story 12.5)**, which runs on every deploy and nightly; a violation fails the deploy with the offending URL and matched pattern.

| # | Requirement | Why (rationale) | Acceptance / verification |
|---|---|---|---|
| **#3** | **Flags are private.** Five structured reasons (Misleading, Low Effort, Spam, Violation, Marketing) route to a moderator-only review queue. No public flag count, badge, or indicator, ever; flagger identity is never disclosed — even after action. | Public flag counts chill honest reporting and enable retaliation. Safe reporting is a precondition for community self-moderation. | Non-moderators (incl. the author) see no flag indicator in UI or API (**3.4**). Queue routes with reason + context (**3.5**). Queue locked to mod/admin roles; never indexed by search (**9.4**). Leak-sweep asserts absence of flag data for anon/non-mod. |
| **#4** | **Portfolio dollars are owner-only.** Public surfaces show allocation **%** only; portfolio visibility is **default private**, opt-in. | Net worth is the most sensitive fact a member holds; exposing it would break the trust that makes real discussion possible. | Owner sees full currency (**6.2**); non-owner sees %-only or nothing (**6.3**); default OFF with logged consent (**6.4**). Currency stripped server-side in gf-stats, not hidden by CSS (**6.6**). Leak-sweep crawls W6/W14 as non-owner → zero currency. |
| **#5** | **WhatsApp is consent-gated; E.164 numbers never appear anywhere.** Notifications and mirroring require explicit, verified opt-in; STOP ends all sends immediately. | Messaging without opt-in violates platform rules and trust; a leaked phone number deanonymizes a pseudonymous member. | Verified opt-in before any send (**8.1**); STOP is instant + logged (**8.2**); non-consented participants dropped (**8.4**); no E.164 in any mirrored content, metadata, HTML, or logs — typed numbers redacted (**8.5**). Leak-sweep scans mirrored posts. |
| **#7-A** | **Signed-out visitors get only the curated public teaser** (digest cards + ticker counts). Every member endpoint 401/403s anonymously — including chat, presence, search, events, leaderboards, label/ticker hubs. | The Square is a private commons; leaking any member content to anonymous visitors breaks the gate and the pseudonymity promise. | Anon deep links → W1 with no content flash (**1.1**); member JSON endpoints 403 anonymously (**1.1, 4.4, 16.6, 17.6, 18.1, 20.1**); teaser is `noindex` unconditionally (**15.1**); only anonymous data path is the cached digest payload. |
| **#8** | **Maven performance is percent-only; currency stripped server-side.** Losses render on the opposite side of a signed baseline — never as a currency figure. | Publicly displayed *returns* used to establish expertise is precisely the finfluencer pattern regulators target; the percent-only pipeline is both the client's rule and the compliant one. | W14 module + payload contain zero currency, portfolio size, share count, or absolute amount (**7.2**). Equity series is a percent index (100 at inception) by construction. Whitelist serializer + leak-sweep (contract in `docs/gf-stats-contract/`). |
| **#9** | **Recognition ranks engagement, never money.** No leaderboard, badge, streak, tier, or trending surface may rank/score members by portfolio data or % returns, or imply advice quality. | Ranking by money would turn a learning community into a performance-flexing venue and manufacture advice-like signals. | Gamification scoring has no financial field as an input (**18.1, 18.6**); karma is engagement-only (**Epic 21**); "Top contributors — by karma, never by returns" (**21.5**). Leak-sweep asserts zero % returns/currency in all recognition payloads. |

---

## 6. Feature requirements by area

Priorities: **P0** = pilot cannot ship without it (every feature whose primary purpose is enforcing a constraint is P0); **P1** = strongly expected for a credible "Living Square"; **P2** = stretch. Story references point to the canonical acceptance corpus.

### 6.1 Community forum (Discourse-native) — Epics 2, 3, 5

| Feature | Priority | Acceptance summary |
|---|---|---|
| Corridor communities + spaces (Stocks & ETFs, Taxes & FEMA, 401k & Retirement, Real Estate, Ask the community, Insurance & Visas, Watercooler) | P0 | All six corridors browsable with membership state; spaces list with post counts (**5.1**). One-click join surfaces posts in feed (**5.2**). |
| Composer requiring community + space (and ≥1 label in investing spaces) | P0 | Post lands in the right space, corridor feed, and search within 60s; drafts restored (**2.3, 14.1**). |
| Threaded replies with pseudonym-only attribution | P0 | Quote/reply renders in-thread; @mentions notify; removed posts show neutral state (**2.4**). |
| Four reaction pills — Helpful / Insightful / Actionable / Like (fixed set, one per member per post) | P0 | Exactly four pills; no dislike/downvote; second pill replaces first; instant increment + mine-highlight (**3.1, 3.2**). |
| Private flagging — five structured reasons → mod queue | P0 | Modal offers exactly five reasons + optional note; enters queue; invisible to non-mods (**3.3, 3.4, 3.5**) — **#3**. |
| Maven-badged posts with credential label + disclaimer | P1 | Badge + credential render on maven cards; educational disclaimer present (**2.6, 11.1**). |
| Trust levels (Discourse-native) underpinning label-creation & tier unlocks | P1 | Below-threshold members request labels rather than mint them (**14.1**); tiers gate abilities (**21.4**). |

### 6.2 Search & discovery (Reddit-style) — Epic 4

| Feature | Priority | Acceptance summary |
|---|---|---|
| Universal search with **All / Communities / Posts / Comments / Profiles** tabs | P0 | All = composed digest (communities → posts → profiles); tabs filter by type, preserve query; deep-link to anchor (**4.1, 4.2**). |
| Communities rail (right rail) with Join/Joined | P1 | Top community matches render with join state, corridor, member count (**4.2**). |
| Ticker search — `NVDA` / `$NVDA` → ticker-focused results + hub link | P0 | Labelled conversations rank first, then full-text; ticker chip pins `tags:` filter and links to hub (**4.6, 20.1**). |
| Label search & filter (FEMA, FCNR, 401k…) with shareable URL state | P0 | Label suggestion chip; filter persists across tabs; AND/OR explicit (**4.7**). |
| Combined query (text + ticker + label + space + author) via chips or operators | P1 | Typed operators and UI chips yield identical results; invalid operator degrades to text search (**4.8**). |
| Profiles expose pseudonyms only | P0 | Email/phone search returns zero matches; profile cards never show real name/email/E.164 (**4.3**) — **#5**. |
| Search gated when signed out | P0 | Anon search UI/JSON → 403/redirect; asserted by leak-sweep every run (**4.4**) — **#7-A**. |
| Recent + trending suggestions (incl. trending tickers) in empty state | P2 | Recent searches (local) + trending topics + top ticker chips render tappable (**4.5, 20.2**). |

### 6.3 Feed (Top/Popular) — Epics 2, 15, 16

- **P0 — Popular-by-default landing feed** scoped to joined communities, with a **New** toggle (**2.1, 2.2**). Ranking is engagement (Discourse Hot). Popular is the product default across sessions.
- **P0 — Member-only Popular feed for subscribed communities.** Each *joined* community surfaces its own "Popular in ‹community›" list; the general Popular feed and per-community Popular are both member-only. The signed-out landing never shows member Popular content — that would leak private-community posts (**5.4, 15.4**; scope guard per Phase-1b plan §F3).
- **P0 — Live feed updates.** New discussions surface via a "n new discussions — tap to see" pill within ~10s without reload; scroll position never jumps (**16.1**).
- **P1 — Live thread stream + reading-now count + typing indicator** (pseudonym-only, member-only) (**16.2, 16.3**).
- **P1 — Live engagement counts** tick in place with batched rendering (**16.5**).
- **P2 — Follow members/mavens** into a "Following" feed filter; follower lists private by default (**16.7**).

### 6.4 Maven percent-proof — Epic 7 (from F2)

The single highest-risk, highest-value feature. A public, detail-page-grade profile that proves expertise using **percentage-only** performance sourced from the maven's linked Ghostfolio. **Absolute values are never rendered, anywhere (#8).**

| Feature | Priority | Acceptance summary |
|---|---|---|
| Maven opt-in toggle (verified via linked Ghostfolio), **OFF by default** | P0 | Explainer states exactly what publishes; consent timestamped; module goes live next gf-stats cycle (**7.1**). |
| W14 tabs: **Overview / Stats / Portfolio / Chart** | P0 | Overview = cumulative % chart (ranges 6M/YTD/1Y/2Y/Max) + benchmark line + KPI row; Stats = monthly-returns heat table + yearly totals; Portfolio = allocation % bars; Chart = signed baseline % series (Phase-1b §3). |
| **Monthly / Yearly / Overall %** headline (This Month % · This Year % · Overall cumulative + annualized) | P0 | Required breakdown renders; finer periods optional; losses on opposite side of baseline, never currency (**7.2**). |
| Percent-only enforcement | P0 | Rendered DOM + JSON contain zero currency/portfolio-size/share-count/absolute values (**7.2, 6.6**) — **#8**. |
| Honest states (thin / stale / early history) | P0 | <6 months → "not enough history" / "early history" note; stale → "data as of ‹ts›" then fails closed; computation error → nothing shown (**7.3**). |
| Revocable opt-in | P0 | Toggle OFF → module stops within 60s; caches purged same window (**7.4**) — consent reversible. |
| Credentials with verification provenance | P1 | Credential (CFA) shows "verified by admins on ‹date›"; revoked → gone everywhere (**7.5, 1.6**). |
| Five-signal credibility strip (Credential · Karma tier · Accepted answers · Tenure · Track-record proof shared/not-shared) | P1 | Only the proof signal reacts to the consent toggle; strip payload has no currency/% returns (**7.7**) — proof is a state, not a number. |
| Compliance framing (no forward-looking claims, no "copy", no solicitation; disclaimer adjacent) | P0 | Denylist screens bio/module; violations route to queue; no return-ranked maven leaderboard exists (**7.6, 11.3**). |

### 6.5 Portfolio / Ghostfolio — Epic 6

| Feature | Priority | Acceptance summary |
|---|---|---|
| 1-click SSO from Discourse profile into Ghostfolio | P0 | Short-lived signed link; no email/phone in URL; reused/expired link rejected (**6.1**). |
| Owner sees full currency detail | P0 | Dollar values, P/L, transactions for the owner; "this is what others see" %-only preview (**6.2**) — **#4**. |
| Public allocation **%** only, currency stripped server-side | P0 | Non-owner sees percentages summing to ~100%, no currency anywhere in HTML/API (**6.3**) — **#4**. |
| Default-private visibility + explicit opt-in, logged | P0 | Fresh account = OFF; toggle on/off reflects within 60s; consent timestamped (**6.4**). |
| Provisioning exactly once at signup (idempotent) | P0 | One Ghostfolio account per Discourse user id; duplicate webhook = no second account (**1.5**). |
| Record holdings/transactions in bounded reskin (Porcelain Slate) | P1 | Added activity appears in holdings within 60s; reskin assertions hold; feeds gf-stats (**6.5**). |
| **Member gains toggle** — any member shares % gains (Monthly/Yearly/Overall), **OFF by default**, labelled "self-reported — not independently verified" | P0 | Independent of allocation toggle; gains module has zero currency/share-count/absolute value; distinguished from maven verified proof (**6.7**) — **#4/#8**. |

### 6.6 WhatsApp channel — Epic 8

| Feature | Priority | Acceptance summary |
|---|---|---|
| Consent-gated notification opt-in (number → verification → confirm) | P0 | No send without verified opt-in; first message states scope + STOP (**8.1**) — **#5**. |
| STOP → immediate, total opt-out, logged | P0 | All sends cease instantly; W7 toggle flips off; revocation timestamped (**8.2**). |
| Forum mirroring, consent-gated per participant, <60s | P0 | Consented participant's message → forum post in <60s, pseudonym-attributed, auto-labelled; non-consented dropped entirely (**8.3, 8.4**). |
| E.164 numbers never appear (redaction + masked logs) | P0 | No number in content/metadata/HTML/logs; typed numbers redacted (**8.5**) — **#5**. |
| Reply/mention notifications with 24h-window discipline + batching | P1 | One templated message per event within scope; batched/rate-limited (max 1/thread/15min) (**8.6**). |
| Crash-safe, duplicate-safe bridge | P1 | Restart mirrors missed messages once (dedup on message id); backoff retry; >5min down → Ops alert (**8.7**). |

Chat content is **never** sent to WhatsApp — the #5 mirror scope is forum-only (**17.5**).

### 6.7 Karma & recognition — Epics 18, 21 (bounded by #9)

| Feature | Priority | Acceptance summary |
|---|---|---|
| Weighted karma earning | P0 | **Actionable +3 · Helpful +3 · Insightful +2 · Like +1 · Accepted answer +5 · Upheld flag −5**; symmetric reversal on undo; recompute within ≤15min (**21.1**). |
| Anti-gaming | P0 | No self-reactions; daily cap (~50 reaction-karma/earner); reciprocal-ring/sockpuppet detection → mod report + forfeiture (**21.2**). |
| Byline karma chips + tier chips wherever members appear | P1 | Chip ("▲ 2.8k") with tooltip → transparency page; profiles show tier chip; payload has no % returns/currency (**21.3**) — **#9**. |
| Karma tiers with small unlocks | P2 | **New Arrival 0 · Regular 100 · Trusted 500 · Anchor 2,000 · Luminary 10,000**; threshold crossing → badge + quiet toast; tier gates abilities; names never imply financial standing (**21.4**). |
| "Top contributors — by karma, never by returns" rail + full leaderboard | P1 | W3 rail + W18 Weekly/Monthly/All-time boards rank by karma only; opted-out members absent; #9 banner (**21.5, 18.1**). |
| Desi-themed badge ladder (First Diya, Neighbourly, Straight Answer, Square Pillar, Bridge Builder…) | P1 | Participation-derived only; no badge references portfolio performance; feature up to 3 (**18.2**) — **#9**. |
| Moderator karma effects | P1 | Upheld flag reverses earnings + applies −5; dismissal karma-neutral; repeat violations → temporary freeze, no public shaming (**21.6**). |
| Celebrations (first-post confetti, streaks, cakeday), respecting reduced-motion & opt-out | P2 | Non-blocking ≤2s; streak resets quietly; opt-out removes public activity-pattern signals (**18.3, 10.5**). |
| "How karma works" transparency page with **dated changelog** | P1 | Full weights table, tier ladder, anti-gaming rules, #9 statement; every weight/rule change appends a dated entry — silent change fails a config test; static signed-out copy has zero member data (**21.7**). |

### 6.8 Moderation & trust/safety — Epics 3, 9, 11

| Feature | Priority | Acceptance summary |
|---|---|---|
| Private review queue with full context (posts + chat) | P0 | Excerpt, pseudonym, space/channel, reason(s), notes, count, age; filter by reason/community/surface; oldest-first (**9.1**). |
| Structured flag reasons incl. **Self-Marketing / Misleading** | P0 | Exactly five reasons: Misleading, Low Effort, Spam, Violation, Marketing (**3.3**). |
| Posting penalties / actions (e.g. "Remove + ban posting 3 days") | P0 | Remove hides content platform-wide <60s → neutral state; author notice cites guideline, never flagger (**9.2**); dismiss clears without notifying author (**9.3**). |
| Queue locked to mod/admin; never indexed | P0 | Members/mavens denied route + JSON; search never returns queue/flag data (**9.4**) — **#3**. |
| Moderation audit log | P1 | Actor, action, target, reason, timestamp; read-only for mods, admin-exportable (**9.5**). |
| Automated advisory-language screening (denylist) across posts, bios, chat, events, polls | P1 | Matches ("guaranteed", "sure-shot", "DM me to invest") auto-route to queue with reason (**11.3, 7.6**). |
| Educational disclaimer on every content surface | P0 | Present on W1/W3/W4/W6/W14/W16/W17/W18/W19 desktop + mobile; missing disclaimer fails the UI test (**11.1**). |
| Signup terms acknowledgment (versioned) | P1 | Explicit checkbox blocks signup if unchecked; acceptance timestamped + versioned (**11.4**). |

### 6.9 Community calendar & events — Epic 19

- **P0 — Maven AMAs as event topics** with timezone-aware cards, RSVP going/interested, ICS, `ama` label, RSVP-driven private event chat, "starting now" nudge; denylist screened; disclaimer present (**19.1**).
- **P1 — Automated recurring rituals** (e.g. "US Market Week") created on schedule with a fresh sentiment poll; previous auto-closes with a forward link (**19.2**).
- **P1 — Upcoming-events discovery** (events view + right rail + month calendar); one reminder per event per channel (**19.3**).
- **P1 — After-event AI recap** posted as a pinned, moderator-editable comment; digest-eligible (**19.5**).
- **P2 — WhatsApp event reminders** only if consent scope includes them (**19.4**) — **#5**.

**Roles:** moderators (`desisquare_mod`) run the review queue, label curation, and teaser; **moderators are not mavens** — mavens (`nikhil_cfa`) host AMAs and hold verified performance proof. Community Admins credential mavens and configure structure. These are distinct capability sets.

### 6.10 Admin — Epics 5, 12, 13

- **P1 — Corridor/space management** (create, rename, order, archive; URLs preserved on rename) (**5.5**); membership approvals for restricted communities (**5.3**); maven credentialing grant/revoke (**1.6**).
- **P0 — Ops: GCP deploy behind TLS**, nightly GCS backups with tested restore, health checks/alerting, pinned versions + rehearsed upgrade, transactional email (**12.1–12.4, 12.6**).
- **P2 — A/B Lab** with guardrails: compliance/privacy surfaces (disclaimers, the gate, flag privacy, consent flows, %-only rendering, presence visibility, `noindex`) can never be in a test cell (**13.1–13.3**).
- **P1 — Demo drawer** (demo instance only) with seeded personas + one-click role switching + liveliness showcases; fully disabled in production (**12.7**).

### 6.11 Onboarding, registration & SSO — Epics 1, 6

- **P0 — Invite + open-registration gate.** Redeem `DSQ-2026` → account creation (email, password, pseudonym); wrong code = generic error, rate-limited; email verification via SMTP activates the account (**1.2, 1.3**).
- **P0 — Pseudonymity.** Real name/email never render on any public surface (posts, profiles, search, chat, mirrored content); admin-only email visibility (**1.4**).
- **P0 — Provisioning at signup.** Exactly one Ghostfolio account, idempotent (**1.5**).
- **P1 — First-run onboarding** picks one corridor + auto-joins default spaces and the corridor chat Square (**1.7**).
- **SSO plan.** Discourse is the identity provider; Ghostfolio access is via 1-click DiscourseConnect-style signed SSO (short-lived link, no PII in URL) minted by gf-provisioner (**6.1**). No second login exists for members.

---

## 7. Key user journeys

### 7.1 New-member onboarding (`quiet_lotus`)
1. Visitor lands on the gated W1 landing → sees value prop + curated teaser (popular-this-week cards + "talked about this week" ticker counts) — nothing else (**1.1, 15.1, 20.4**).
2. Enters invite code `DSQ-2026` → account creation (email, pseudonym, password) → checks the educational-only acknowledgment (**1.2, 11.4**).
3. Verifies email via SMTP → account activates → Ghostfolio account provisioned exactly once in the background (**1.5**).
4. First-run onboarding: picks corridor (e.g. US) → auto-joined to Stocks & ETFs, Ask the community, Watercooler + the US chat Square (**1.7**).
5. Lands on W3 Popular feed, scoped to joined spaces, alive with live updates → makes a first reaction or reply. **Activation achieved.**

### 7.2 Maven publishes a track record (`nikhil_cfa`)
1. Community Admin verifies the CFA credential → maven badge + provenance appear (**1.6, 7.5**).
2. Maven opens Settings → flips "Publish my performance (percent only) — verified via linked Ghostfolio" (OFF by default) → reads the explainer → confirms; consent is timestamped (**7.1**).
3. gf-stats computes the percent index from the linked Ghostfolio account, stripping all currency server-side; on the next cycle the W14 module goes live (**7.2, 6.6**).
4. Members open W14 → see Monthly/Yearly/Overall %, monthly heat table, allocation %, top positions as % — **no dollar figure anywhere** — plus the five-signal credibility strip and the past-performance disclaimer (**7.2, 7.7, 7.6**).
5. Maven later revokes → module disappears within 60s, caches purged; only the proof signal on the strip flips to "not shared" (**7.4, 7.7**).

### 7.3 Member asks a question and gets an accepted answer
1. `quiet_lotus` opens the composer → required community + space (US → Taxes & FEMA) + ≥1 label (`fema`, `question`) (**2.3, 14.1**).
2. Post publishes → appears in space, corridor feed, and search within 60s; auto-labels may add tickers/themes (**2.3, 14.3**).
3. Members reply in-thread (live streaming, typing indicators); a maven answers (**16.2, 16.3, 2.6**).
4. Asker marks an answer **accepted** → answerer's karma +5; Helpful/Actionable reactions add +3 each (**21.1**).
5. If the discussion crosses the popularity threshold, it earns an AI summary and may enter the member-facing digests (**15.2, 15.4**).

### 7.4 WhatsApp intake → forum → reply
1. Member opts into WhatsApp (number → verification → confirm) with a chosen scope; consent logged (**8.1**).
2. In the linked group, a consented participant posts a question → wa-bridge mirrors it to the designated space in <60s, pseudonym-attributed, E.164 redacted, auto-labelled (**8.3, 8.5, 8.4**).
3. A non-consented participant's messages are dropped entirely — nothing posted or stored (**8.4**).
4. A member replies on the forum → the original poster (if opted into replies/mentions) gets one templated WhatsApp message with a deep link, batched to avoid spam (**8.6**).
5. The member replies STOP → all sends cease instantly, toggle flips off, revocation logged (**8.2**).

### 7.5 Moderator handles a flag (`desisquare_mod`)
1. A member flags a post (one of five private reasons + optional note) → confirmation "thanks, moderators will review"; nothing visible to anyone else (**3.3, 3.4**).
2. The flag enters the W9 queue within 60s with excerpt, reason, note, flagger pseudonym (mod-only), and count; multiple flags collapse to one item (**3.5**).
3. Moderator triages: **Remove** (hidden platform-wide <60s → neutral state; author notice cites the guideline, never the flagger) or **Dismiss** (content untouched; author never learns) (**9.2, 9.3**).
4. If upheld, the author's karma reverses that content's earnings and applies −5; the action is logged in the audit trail; the flagger stays private (**21.6, 9.5**).

---

## 8. Release plan (F0–F5 + Phase-1b)

Delivery maps to the six GCP increments (`deploy/gcp/REQUIREMENTS.md`) — one increment per working session, each ending in its own acceptance table. **Web can be live in ~2 days** with items 1–3 of the infra checklist in hand; **WhatsApp production is 1–3 weeks**, gated by Meta Business Verification (the critical path — start day 0).

| Increment | Scope | Delivers | Constraint focus | Exit |
|---|---|---|---|---|
| **F0** | Accounts, repo access, secrets policy | GCP project + billing, GitHub deploy access, Secret Manager agreement (checklist §1, §5) | — | Deploy account can act; nothing secret in repo |
| **F1** | GCP foundation | 2-VM topology (discourse-1 + apps-1), Caddy TLS, GCS backup wiring; demo mode on sslip.io | — | TLS green; backup job runs; teardown works |
| **F2** | Discourse | Community engine: corridors/spaces, four reaction pills, private flags + queue, pseudonymity, universal search, labels, Popular feed, karma, chat, events, liveliness | #3, #7-A, #9 | 50-user acceptance sim green (`test/community-sim/`); leak-sweep green |
| **F3** | Ghostfolio + app layer | Provisioning, 1-click SSO, owner $ / public % / default private, maven percent-proof (W14), member gains toggle, v4 app (search, teaser) | #4, #8 | W6 %-only + W14 percent-proof pass; leak-sweep zero-currency green |
| **F4** | WhatsApp | Consent-gated notifications + mirroring, STOP, E.164 hygiene, 24h-window discipline | #5 | Verified opt-in loop; mirror <60s; zero E.164 in sweep |
| **F5** | Ops & hardening | Health checks/alerting, nightly backups + tested restore, pinned versions + upgrade rehearsal, budget alert (~$150/mo cap), demo drawer off in prod | all six (via 12.5) | Restore drill logged; leak-sweep blocking on deploy; budget alert live |

**Phase-1b (Trust & Discovery)** — the client's two headline asks — lands across F2/F3: universal search (F1 feedback → Epic 4) and maven performance proof (F2 feedback → Epic 7), plus popular-posts feeds (F3 feedback → Epics 2/15). Sequenced in the Phase-1b plan as S1 (search + gf-stats whitelist/leak-sweep first), S2 (W14 renderer + consent toggle end-to-end), S3 (hardening + benchmark overlay + counsel checkpoint), ~5–6 engineer-weeks.

### 8.1 Milestone table

| Milestone | Depends on | Target signal |
|---|---|---|
| M0 — Demo live (standalone) | F0–F1 + checklist §1–3 | Discourse + Ghostfolio + seeded community on sslip.io, 50-user sim green (~2 days) |
| M1 — Community feature-complete | F2 | All P0 community/search/karma/moderation stories pass; leak-sweep green |
| M2 — Trust & proof live | F3 + Phase-1b S1–S3 | Maven percent-proof + member gains toggle live; counsel checkpoint cleared |
| M3 — WhatsApp production | F4 + Meta Business Verification | Consent loop + mirroring live on a dedicated number (1–3 weeks) |
| M4 — Production hardened | F5 | Backups/restore/alerting/upgrade rehearsed; budget alert; sweep blocking |
| M5 — Pilot open (<1,000) | M1–M4 | North-Star (WCM) instrumented; pilot invites issued |

---

## 9. Open decisions & product risks

Sourced from the infra checklist §7 (decisions held for the client) and the Phase-1b open-questions register. Each needs a dated resolution before its dependent feature ships.

| # | Open decision | Options / proposal | Blocks | Owner |
|---|---|---|---|---|
| D1 | **Karma weights confirm** | Proposed: Actionable/Helpful **+3** > Insightful **+2** > Like **+1**, accepted answer **+5**, upheld flag **−5**. Weights live in one config table; any change is dated on the transparency page (**21.7**). | Epic 21 go-live | Product + Client |
| D2 | **Corridor benchmark** for maven charts | S&P 500 TR (US) vs Nifty 50 TR (India) — per-corridor overlay index (Phase-1b Q2). | W14 Overview chart | Product + Compliance |
| D3 | **Which corridors at launch** | All six (US/CA/UK/AE/AU/SG) vs US/CA first for Chat Squares (checklist §7). | Corridor + chat provisioning | Client |
| D4 | **Teaser `noindex` posture** | Keep `noindex` (current #7-A posture). Opening to search engines requires an explicit privacy re-review — a separate story. | Teaser SEO | Compliance |
| D5 | Minimum history to show a track record | Proposal: 6 months (Phase-1b Q3). | W14 honest states (**7.3**) | Product |
| D6 | Refresh cadence for gf-stats | Proposal: daily (matches "updated daily" ribbon); intraday adds cost, no trust benefit (Phase-1b Q4). | gf-stats SLA (**7.3**) | Product + Ops |
| D7 | Non-maven gains module scope | Resolved (**6.7**): any member may opt into % gains, labelled "self-reported — not independently verified". | — (closed) | — |

### 9.1 Product risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A currency value leaks via a new Ghostfolio API field | Med | High | Whitelist (not blacklist) serializer + blocking leak-sweep in CI (**#8, 12.5**) |
| "Performance proof" read as investment advice by a regulator | Med | High | Percent-only, opt-in, credentialed, no copy/solicitation, benchmark + drawdown honesty, pervasive disclaimers, **counsel checkpoint before public launch** (Phase-1b §5) |
| Meta Business Verification delays WhatsApp | High | Med | Start day 0; test number covers the demo loop; web ships independently of F4 |
| Liveliness becomes surveillance | Low | High | Presence member-only + "appear offline" (**10.5, 16.6**); leak-sweep asserts no presence data signed-out |
| Karma gamed (rings, sockpuppets) | Med | Med | Anti-gaming caps + ring detection + forfeiture (**21.2**) |
| Discourse/Ghostfolio version drift breaks theme/reskin/plugins | Med | Med | Pinned versions + rehearsed upgrade + rollback from snapshot (**12.4**) |
| Search relevance disappoints at scale | Low | Med | Phase-2 upgrade path (server-side search plugin); theme-component UI reusable as-is |
| Public teaser silently goes stale | Low | Med | Fallback to last-good cached digest with date; Ops alert if >2h (**12.3, 15.1**) |

---

## 10. Compliance & legal

DesiSquare is a **regulated-adjacent product built to stay on the safe side of the line.** The design encodes mitigations as requirements, not suggestions.

### 10.1 Educational-only positioning
- Every content surface (W1/W3/W4/W6/W14/W16/W17/W18/W19, desktop + mobile) carries the disclaimer *"Educational content, not investment advice or a solicitation"* without user interaction (**11.1**). Investing composers show a one-line reminder; chat channels pin it in the header.
- Landing copy makes no return promises, no "beat the market" language; mavens are described as educators sharing track records, not advisors (**11.2**).
- Maven performance surfaces carry *"Past performance is not indicative of future results"* adjacent (not behind a click), with benchmark + drawdown for balanced context, and **no copy-trading mechanics, no return-ranked leaderboards, no solicitation CTAs** (**7.2, 7.6**). This directly targets the finfluencer-enforcement pattern (SEBI-style regimes; the Phase-1b plan §5 details the exposure). A **counsel checkpoint gates public launch** of the maven surface.
- Advisory/solicitation language is screened by a maintained denylist across posts, bios, chat, events, and polls, routing matches to the review queue (**11.3**).

### 10.2 Privacy posture (from #4 / #5 / #7-A)
- **#4** — portfolio dollars are owner-only; public surfaces show allocation/gains **%** only, default private, currency stripped server-side.
- **#5** — WhatsApp is consent-gated and reversible; E.164 numbers never render anywhere; typed numbers are redacted; logs mask numbers.
- **#7-A** — signed-out visitors get only the curated teaser; every member endpoint 401/403s anonymously; the teaser is `noindex` unconditionally.
- **#3** — flags and flagger identities are private, moderator-only, never indexed.
- Members can export their data and delete their account (anonymized posts/chat, Ghostfolio deletion, WhatsApp consent revocation, profile 404 within 24h) (**10.4**).
- All of the above are machine-enforced by the **leak-sweep CI (12.5)** on every deploy and nightly — a violation blocks the deploy.

### 10.3 Data residency by corridor
- Members span six diaspora corridors (US/CA/UK/AE/AU/SG), each with its own data-protection regime (GDPR/UK-GDPR for UK; provincial/PIPEDA for CA; state privacy laws for US; etc.).
- **Region choice** (`us-central1` default vs `asia-south1` India-first) is a launch decision (checklist §1) with residency implications; pseudonymity + minimal PII (email admin-only, no phone display) reduce the residency surface materially.
- The privacy policy documents chat/DM retention (channel messages default to 90-day auto-delete), consent scopes, and the export/delete path. Personal ICS-feed URLs embed a user API key and are treated as secrets (regenerable).

### 10.4 Disclaimers & terms
- Signup requires an explicit, versioned acknowledgment of educational-only terms (**11.4**).
- Terms, privacy policy, and the full disclaimer are reachable from the signed-out landing footer (**11.2**).

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Corridor** | One of six diaspora communities: US, CA, UK, AE, AU, SG. A member picks one at onboarding. |
| **Space** | A category within a corridor (Stocks & ETFs, Taxes & FEMA, 401k & Retirement, Real Estate, Ask the community, Insurance & Visas, Watercooler). |
| **Square** | The corridor's live chat channel (Discourse Chat), and figuratively the whole lively commons. |
| **Maven** | A credential-verified expert member (e.g. `nikhil_cfa`, CFA/CFP) who may opt into verified percent-proof and host AMAs. |
| **Member gains toggle** | Any member's opt-in to publish % gains (Monthly/Yearly/Overall), labelled "self-reported — not independently verified" — distinct from a maven's Ghostfolio-verified proof. |
| **Percent-proof / W14** | The maven performance profile: Overview / Stats / Portfolio / Chart, percent-only, currency never rendered. |
| **Percent index** | The equity series indexed to 100 at inception — currency never enters, so #4/#8 hold at the engine level. |
| **Karma** | Engagement-derived reputation (weighted pill reactions + accepted answers + moderation effects). Never money (#9). |
| **Tier** | Karma band: New Arrival 0 · Regular 100 · Trusted 500 · Anchor 2,000 · Luminary 10,000. |
| **Reaction pills** | The fixed four: Helpful / Insightful / Actionable / Like. One per member per post. |
| **Label** | A Discourse tag — theme (fema, fcnr, 401k) or ticker (nvda). |
| **Ticker hub** | A tag page upgraded into a per-security discussion place (`/label/nvda`), member-only. |
| **Teaser** | The curated, `noindex`, signed-out landing digest — the only anonymous data path (#7-A). |
| **Leak-sweep** | The CI job (story 12.5) that machine-enforces #3/#4/#5/#7-A/#8/#9 on every deploy. |
| **gf-stats** | The service that computes percent-only performance and strips currency server-side (contract in `docs/gf-stats-contract/`). |
| **wa-bridge / gf-provisioner** | The consent-gated WhatsApp↔forum mirror, and the idempotent signup→one-Ghostfolio-account provisioner. |
| **Corridor benchmark** | The neutral index overlaid on maven charts (S&P 500 TR / Nifty 50 TR — open decision D2). |
| **F0–F5** | The six GCP delivery increments (accounts → foundation → Discourse → Ghostfolio+app → WhatsApp → ops/hardening). |
| **Porcelain Slate** | The client-locked light theme; no dark lanes, no user-selectable palettes. |
| **DSQ-2026** | The pilot invite code. |

---

*This PRD sits above `docs/desisquare-user-stories.md` (124 stories / 21 epics — the canonical acceptance corpus) and defers all implementation detail to the corpus, the deploy package, and the TRD. Regulatory points are considerations to confirm with qualified counsel; not legal advice.*
