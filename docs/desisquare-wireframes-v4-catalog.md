# DesiSquare Wireframes v4 — Frame Catalog (W1–W19) · "The Living Square"

> **Prepared by:** BiGMo Consulting · **Date:** 20 July 2026 · **Theme lane:** 1c Porcelain Slate (client-locked)
> **Interactive prototype:** `docs/desisquare-wireframes-v4-prototype.html` — a full clickable walkthrough, superset of v3. Frames marked **● live** are interactive in the prototype; **○ spec** frames are specified here but stubbed or out of prototype scope.
> **Lineage:** v3 (W1–W15: core loop + F1 search + F2 maven proof + F3 popular) + v3-corpus requirements R1–R4 → **v4 adds W16–W19 and upgrades W1, W3, W4, W13, W15**. Wireframe versions number independently of product versions (this catalog accompanies user-story corpus **v3**).

## The constraint ledger (the rules every frame obeys)

| # | Constraint |
|---|---|
| **#3** | 9 reactions = 4 public pills (Helpful / Insightful / Actionable / Like) + 5 private flag reasons (Misleading / Low Effort / Spam / Violation / Marketing). Flags route privately to the review queue; never shown publicly. The pill set is fixed — v4 adds liveliness, not more reaction types. |
| **#4** | Portfolio dollar values render for the **owner only**. Public profile = allocation **% only**, default Private (nothing renders at all). |
| **#5** | WhatsApp mirroring is consent-gated end-to-end. E.164 phone numbers never appear anywhere (leak-sweep tested). Chat (W16) is never mirrored to WhatsApp. |
| **#7-A** | Signed-out visitors get **only** the curated public teaser on W1 (digest cards + ticker counts, pseudonym-only, `noindex`). Every member surface — feed, threads, search, profiles, **chat, presence, events, leaderboard, label/ticker hubs** — 401s/redirects anonymously. Teaser cards route to the join gate, never to content. |
| **#8** | Percent-only maven pipeline: currency-typed fields are stripped server-side in gf-stats; no absolute portfolio, position, or P&L value ever reaches a non-owner client. CI leak-sweep enforced (`docs/gf-stats-contract/`). |
| **#9** *(new, v3)* | Recognition ranks engagement, never money. The leaderboard (W18), badges, streaks, and trending surfaces (W19, W3 rail) use participation signals only — gf-stats data is structurally unavailable to them. |

## Flow map — every path

```
visitor       W1 Landing (join module + PUBLIC DIGEST cards + ticker strip)
              → any card/chip tap → join-gate modal → W2 Sign in (invite DSQ-2026)
member loop   W2 → W3 Feed (Popular default · LIVE pill · ticking counts)
              → W4 Post detail (live comments · typing indicator · reading-now)
              → W13 Search (text / $ticker / label) · W15 Communities (best-of cards)
              → W19 Ticker hub ($NVDA) · label browse (/label/fema)
              → W17 Events (AMA RSVP · rituals + polls) · W18 Leaderboard & badges
              → W16 Chat dock (Squares · threads · promote-to-discussion → W4)
              → W5/W6 Profile · W14 Maven proof → Ghostfolio (1-click SSO)
integrations  WhatsApp group msg → wa-bridge <60s → feed card "via WhatsApp" (+auto-labels)
              signup webhook → gf-provisioner (idempotent) → exactly one Ghostfolio account
              Ghostfolio → gf-stats (%-only) → W14 chart · search YTD chips · mavens rail
              digest job (hourly) → W1 public teaser · W15 best-of · weekly digest
moderation    any card/chat msg ⋯ → flag (5 reasons, private) → W9 Review queue (mod)
              labels → mod label-quality view · digest → mod curation queue
overlays      W10 A/B Lab · W11 Demo drawer (v4: liveliness showcases)
```

---

## A · Core member loop (upgraded in v4)

### W1 — Landing *(● live)* — the only signed-out surface, now with the public teaser (R3)
Everything from v3 (logo, headline, stats, **Join with invite code `DSQ-2026`**, sign-in, gate note) **plus**: **"Popular this week"** — 5 Reddit-style summary cards (title, 2–3-sentence summary ≤280 chars, space + label chips, reaction/comment counts, pseudonymous author + MAVEN ✓, relative age) and a **"Talked about this week"** ticker strip (label + discussion counts only — no prices, no member data). Tapping any card or chip opens the **join-gate modal**, never content (15.5). Footnote: *curated public teaser · pseudonyms only · noindex*.
**Enforcement:** digest served from a cached payload built by the digest job from public corridors only; leak-sweep crawls this surface (12.5).

### W2 — Sign in *(● live)* — three roles
Unchanged from v3: `quiet_lotus` (member) · `nikhil_cfa` MAVEN ✓ · `desisquare_mod` (moderator). Role effects now also gate chat (W16), events (W17), leaderboard (W18), and mod tools (slow mode, label curation).

### W3 — Feed *(● live)* — Popular by default, now **alive** (16.1/16.5, 20.2)
v3 layout (3-column, sort tabs, composer, mavens rail) **plus**: **live pill** ("2 new discussions — tap to see") slides in while you're reading and prepends without reload or scroll-jump; **reaction/comment counts tick live** with a subtle pulse (batched, `prefers-reduced-motion` honored); right rail adds **Trending tickers** (top 5 by discussion velocity, counts + sparkline — never prices, #9) and **Upcoming events**. Label chips render on every card; member statuses (16.4) render beside pseudonyms.

### W4 — Post detail *(● live)* — thread, now a live room (16.2/16.3)
v3 thread **plus**: new comments stream in with an entrance highlight; **"quiet_lotus is replying…"** typing indicator; **"n reading now"** in the header (count only). Cashtags render as chips → W19. Poll posts (18.4) render votable bars updating live.

### W12 — Mobile *(● live via responsive CSS)*
Single column below 960px; chat dock becomes full-screen; pills keep 44px targets; new rails stack below the feed.

## B · Money, identity & controls (unchanged rules)

### W5 — My profile, owner view *(○ spec)* / **W6 — Public profile, % only** *(● live via states)* / **W7 — Settings** *(● live excerpt)*
As v3 (#4 owner-only dollars; % only public; consent center). v4 additions to W7 spec: **Appear offline** and **gamification opt-out** (10.5), chat notification scope (17.5), event-reminder WhatsApp scope (19.4).

### W8 / W15 — Communities *(● live as W15)* — corridors + **best-of summary cards (15.4)**
v3 corridor browsing **plus**: joined communities upgrade "Popular in ‹name›" rows to **summary cards** (same anatomy as the W1 digest, member version links to threads). Fewer than 3 popular items → graceful plain rows.

## C · Trust & discovery

### W13 — Universal search *(● live)* — text / **$ticker** / **label** (R1)
v3 five-tab search **plus**: `$NVDA` (any case) pins a **ticker chip** ("$NVDA · 14 discussions · label") linking to the W19 hub; label-name queries surface a **"Label: fema · view all"** suggestion chip → label browse; empty state shows trending ticker + label chips (4.5/20.2). Operator queries (`tags:`, `#space`, `@author`) render as removable filter chips (4.8).

### W14 — Maven profile: performance proof *(● live)*
Unchanged from v3 (percent-only, eToro-referenced, honest states, no leaderboards of returns — which is precisely what #9 now codifies platform-wide).

### Label browse — `/label/‹name›` *(● live)* (14.6)
Header (label, admin description, conversation count, **Follow**), Popular/New toggle, labelled conversations. Auto-applied labels carry a tiny **auto** mark (14.3).

## D · The Living Square (new in v4)

### W16 — Squares Chat *(● live as dock)* (Epic 17)
Floating **💬 Chat** button (signed-in only, #7-A) → dock: channel list (US Square · CA Square · Ask-anything Lounge) with unread dots; pinned *"Education, not investment advice"* line (11.1); live messages with typing indicators; member send; threads affordance; **"⤴ Continue as discussion"** creates a real labelled topic with quoted pseudonym-only transcript and routes to W4 (17.3 — the anti-Discord-amnesia move). Moderator sees a **slow mode** toggle (17.4). Chat is invisible signed-out and never mirrored to WhatsApp (#5).

### W17 — Events & AMAs *(● live)* (Epic 19)
Route `#/events` + nav item. **AMA card** (maven-hosted, time in viewer's timezone, **RSVP Going/Interested** with live counts, `ama` label, ICS affordance, disclaimer); **ritual card** ("📈 US Market Week — what are you watching?", *auto-created by ritual automation*, inline sentiment **poll** with live-updating bars, 18.4/19.2); past event with collapsed **auto-summary recap** (19.5). Upcoming-events mini-rail on W3.

### W18 — Recognition *(● live)* (Epic 18)
Route `#/recognition` + nav item "Leaderboard". Weekly/Monthly/All-time tabs; members ranked by **engagement points** (posts, replies, helpfuls received — breakdown on hover); rank-change arrows; own row highlighted; standing banner: *"Ranks engagement — never portfolio performance (#9)"*. **Desi badge ladder**: First Diya 🪔 · Neighbourly 🤝 · Straight Answer ✅ · Bridge Builder 🌉 · Square Pillar 🏛 with earned states. First reaction of the session fires a ≤2s **confetti micro-moment** + toast (reduced-motion honored) — the 18.3 celebration pattern.

### W19 — Ticker hub *(● live)* (Epic 20)
`/label/nvda` upgrades to the hub: header **"$NVDA · NVIDIA"**, *14 discussions · ▲ 6 this week*, optional delayed market-context line (clearly labelled, fail-closed), **Moments** strip (upcoming AMA, promoted chat discussion), labelled discussions with Popular/New, **Follow ticker**. Zero member portfolio data — gf-stats never feeds hubs (#4/#8).

## E · Moderation, experiments & POC overlays

### W9 — Review queue *(● live, mod only)*
As v3, plus chat-message flags with channel context (17.4), denylist hits from chat/events/polls (11.3), the digest curation queue (15.3), and the label-quality view (14.4) as adjacent mod tools *(○ spec in prototype)*.

### W10 — A/B Lab *(○ spec)* / W11 — Demo drawer *(○ spec)*
W10 blocklist now includes presence visibility and leaderboard scoring inputs (13.2). W11 gains liveliness showcases: inject chat message, trigger live pill, simulate RSVP, fire celebration (12.7).

---

## Traceability: v3 requirements → frames

| Requirement | Frames | Enforcement |
|---|---|---|
| R1 — search by text / ticker / label | W13 (chips + operators), W19 hub, label browse | tags + `tags:` filters; cashtag automation (14.5) |
| R2 — labelled conversations: manual + automated + moderated | composer picker (W3), label chips everywhere, **auto** marks, W9 label-quality view | tag groups; discourse-automation + AI triage; tag admin |
| R3 — popular + summaries on free landing & per group (Reddit cards / Discord best-of) | W1 digest + ticker strip, W15 best-of cards | digest job from public corridors only; #7-A gate; mod curation (15.3) |
| R4 — as lively & interactive as possible, via Discourse | W3 live pill/ticks, W4 live thread/presence, **W16 chat**, **W17 events/polls**, **W18 recognition** | MessageBus, presence, user status, Chat, polls, gamification, calendar — all member-only (#7-A), money-free (#9) |
| Porcelain Slate lock | all frames | single light palette, non-user-selectable |
