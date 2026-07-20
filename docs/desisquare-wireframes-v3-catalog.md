# DesiSquare Wireframes v3 — Frame Catalog (W1–W15)

> **Prepared by:** BiGMo Consulting · **Date:** 19 July 2026 · **Theme lane:** 1c Porcelain Slate (client-selected; dark & Haldi lanes retired)
> **Interactive prototype:** `docs/desisquare-wireframes-v3-prototype.html` — a full clickable walkthrough. Frames marked **● live** are interactive in the prototype; **○ spec** frames are specified here (and in Wireframes v2) but stubbed or out of prototype scope.
> **Lineage:** v2 (as-built MVP, W1–W12) + Phase 1.5 feedback → F1 search (W13), F2 maven proof (W14), F3 popular posts (W3 amendment + W15).

## The constraint ledger (the rules every frame obeys)

| # | Constraint |
|---|---|
| **#3** | 9 reactions = 4 public pills (Helpful / Insightful / Actionable / Like) + 5 private flag reasons (Misleading / Low Effort / Spam / Violation / Marketing). Flags route privately to the review queue; never shown publicly. |
| **#4** | Portfolio dollar values render for the **owner only**. Public profile = allocation **% only**, default Private (nothing renders at all). |
| **#5** | WhatsApp mirroring is consent-gated end-to-end. Consent off → unattributed guest post. E.164 phone numbers never appear anywhere (leak-sweep tested). |
| **#7** | Signed-out gate: every member API 401s without a session. Visitors see only the landing shell + public stats (`me: null`). |
| **#8** *(new, Phase 1.5)* | Percent-only maven pipeline: currency-typed fields are stripped server-side in gf-stats; no absolute portfolio, position, or P&L value ever reaches a non-owner client. CI leak-sweep enforced (`docs/gf-stats-contract/`). |

## Flow map — every path

```
member loop   W1 Landing → W2 Sign in (invite DSQ-2026) → W3 Feed (Popular default)
              → W4 Post detail · W13 Search · W15 Communities · W5/W6 Profile
              → W14 Maven proof → Ghostfolio (1-click SSO)
integrations  WhatsApp group msg → wa-bridge <60s → feed card "via WhatsApp"
              signup webhook → gf-provisioner (idempotent) → exactly one Ghostfolio account
              Ghostfolio → gf-stats (%-only) → W14 chart / search YTD chips / mavens rail
moderation    any card ⋯ → flag (5 reasons, private) → W9 Review queue (mod)
overlays      W10 A/B Lab · W11 Demo drawer
```

---

## A · Core member loop

### W1 — Landing *(● live)* — the only signed-out surface
Logo mark, headline *"Where desi money questions get trusted answers."*, public stats (members · online · pseudonymous · free), **Join with invite code** (`DSQ-2026`) + **Request to join**, gate note. Topbar collapses to logo + Sign in (#7). Global "not investment advice" footer.
**Interactions:** Join → W2. Deep-linking any member URL while signed out bounces here (the prototype enforces this, mirroring the API 401 behavior).

### W2 — Sign in *(● live)* — three roles
Role picker: `quiet_lotus` (member) · `nikhil_cfa` MAVEN ✓ (maven, CFA · ex-Fidelity PM) · `desisquare_mod` (moderator). One session per role; the pseudonym is the identity members see.
**Role effects:** moderator gains the Review queue nav item + count badge; maven posts carry the badge; the W7 performance toggle applies to mavens.

### W3 — Feed *(● live)* — the home surface, **Popular by default (F3)**
3-column: left nav (Feed / Communities / Settings / Review queue *mod-only* + Spaces list with counts + WhatsApp-connected card), center (inline composer → title/body/space chips; post cards), right rail (community stats + **Mavens in this community** with YTD % chips for sharing-ON mavens only, #8).
**Sort tabs:** **▲ Popular (default)** · New — engagement ranking (prototype: reactions + 2×comments; production: Discourse Hot). Top-3 cards carry `#n POPULAR` chips. Mirrored WhatsApp posts show the **via WhatsApp** chip (#5). Country switcher swaps the Spaces list per corridor.

### W4 — Post detail *(● live)* — thread
Full post (byline + credential, body, 4-pill row), comment composer, comments (same pill semantics; reactions received roll up to the author's profile counter). Titles everywhere (feed, search, communities, maven Posts tab) deep-link here.

### W12 — Mobile *(● live via responsive CSS)*
Single column below 960px; rails collapse; pills keep 44px tap targets; search tabs scroll horizontally.

## B · Money, identity & controls

### W5 — My profile, owner view *(○ spec — v2 as-built)*
Pseudonym header, member-since, reactions received, My posts / My comments tabs. **Portfolio card (owner only, #4):** $ value + day change, allocation bars, **Open in Ghostfolio ↗** (1-click SSO minted by gf-provisioner — no Ghostfolio password ever exists). Private ⇄ Public toggle.

### W6 — Public profile, allocation only *(● live via maven/consent states)*
What everyone else sees **when the member flips Public**: allocation % bars only — **$ never shown** (#4); posts/comments/reactions counts. Default Private → nothing renders. For a maven with performance sharing ON, W6 is superseded by W14 (a superset — never a different privacy rule).

### W7 — Settings *(● live excerpt)* — consent lives here
**WhatsApp:** linked group · Mirror my group messages (pseudonym + "via WhatsApp" label) · WhatsApp notifications. **Privacy:** display name (pseudonymous by default) · Portfolio visibility (% only when Public) · **NEW: "Share my performance publicly — % only, verified via Ghostfolio" (maven only, default OFF, #8)**. **Verification:** email ✓ · desi check ✓. Consent-off is honored end-to-end (#5) — the prototype demos the performance toggle collapsing W14 live.

### W8 / W15 — Communities *(● live as W15)* — corridors + **popular posts per joined community (F3)**
Corridor chips (US CA UK AE AU SG) swap the whole list. Per community: PUBLIC/PRIVATE chip, members/online, Join / Joined ✓ / Request pending. **Joined communities show "Popular in ‹name›"** — top posts ranked by engagement with score chips (Reddit's community-hot pattern). Unjoined public: join CTA teaser. **Private: content never previewed (#3).**

## C · Trust & discovery (Phase 1.5)

### W13 — Universal search *(● live, F1)*
Topbar box + `/` shortcut; URL-persisted query. **Tabs: All · Communities · Posts · Comments · Profiles** with counts; sort (Relevance/Newest/Most reactions) + time + corridor scope note. Per-type result cards (match highlighting; via-WhatsApp chips; maven YTD micro-stat only when sharing ON). Reddit-style All digest + Communities rail. Per-tab empty states. Privacy inherited: private communities and flags never appear.
**Production:** theme component over native Discourse search/`/search.json` + user directory + categories — no plugin.

### W14 — Maven profile: performance proof *(● live, F2)*
Header (pseudonym, MAVEN ✓, credential, verification chips, Follow, community standing) + **privacy ribbon**: *"Performance verified via linked Ghostfolio · % only — ₹/$ never shown (#8) · updated daily."*
**Tabs:** **Overview** (cumulative % chart w/ 6M·YTD·1Y·2Y·Max + S&P 500 TR benchmark; KPIs: YTD, 1Y, 2Y-annualised, max drawdown, profitable months, risk band; About; top positions as % of portfolio + return %), **Stats** (eToro-style monthly-returns heat table, year × month, from the client's reference numbers), **Allocation** (% bars), **Posts** (best-of by reactions).
**States:** consent OFF → honest "hasn't shared performance yet" (tabs collapse); stale >48h → "last verified n days ago"; <6 months history → early-history note. **No Copiers, no copy CTAs, no return-ranked leaderboards.** Disclaimer on every view.
**Production:** gf-stats %-only proxy (contract + leak-sweep test in `docs/gf-stats-contract/`).

## D · Moderation, experiments & POC overlays

### W9 — Review queue *(● live, mod only)*
Members' 5 private flag reasons land here (#3): reason chip, author, space, age, flag count, quoted content, **Remove post / Dismiss flags** (both live in prototype; badge count updates; empty state "Queue clear ✓"). Non-mods hit a gate card. Full tooling (audit trail, appeals, karma effects) is Phase 2.

### W10 — A/B Lab *(○ spec — v2 as-built)*
The v1-contested calls shipped as per-account instant experiments: feed density (comfortable/compact), reaction row (labeled/quiet), right rail (context/zen). Decision log in the repo README. *(Porcelain Slate is now decided; the lane experiment is retired.)*

### W11 — Demo drawer *(○ spec — v2 as-built)*
POC wiring panel (signed-in only, #7): wa-bridge/gf-provisioner/gf-stats status rows, inject-a-WhatsApp-message form (consented member ▾ → feed card <60s), simulate signup → provisioned/already_linked (idempotent). Real services when up, honest fallbacks when not.

---

## Traceability: feedback → frames

| Feedback | Frames | Enforcement |
|---|---|---|
| F1 — search: All/Communities/Posts/Comments/Profiles | W13 (+ topbar in W3) | native Discourse search, privacy inherited |
| F2 — maven performance proof, $ never visible | W14, W7 toggle, W3/W13 YTD chips | gf-stats whitelist + CI leak-sweep (#8) |
| F3 — popular posts on landing feed + per joined community | W3 sort tabs, W15 | Discourse Hot + per-category hot lists |
| Porcelain Slate decision | all frames | single light palette, non-user-selectable |
