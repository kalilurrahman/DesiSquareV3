# DesiSquare Phase 1.5 — "Trust & Discovery"

### Plan, approach & product spec for the client's Phase 1 feedback: universal search + maven performance proof

> **Prepared by:** BiGMo Consulting · **Date:** 19 July 2026
> **Inputs:** `Phase_1_Feedback.docx` (client review of the Phase 1 MVP design), `DesiSquare_prototype_project_wireframes__Revised_Phase_I` (Wireframes v2, as-built, W1–W12)
> **Companions:** feasibility report (`discourse-ghostfolio-whatsapp-community-forum-feasibility.md`) · delivery playbook (`desisquare-seamless-delivery-playbook.md`)
> **Product output:** interactive Wireframes v3 prototype — `docs/desisquare-wireframes-v3-prototype.html` (W13 + W14 live · Porcelain Slate, the client-selected lane)

---

## 1. What the client asked for (feedback → requirements)

The Phase 1 feedback contains exactly two asks, each with a visual reference:

| # | Feedback (verbatim intent) | Reference shown | Requirement |
|---|---|---|---|
| **F1** | "Search functionality is critical… results based on **All, Communities, Posts, Comments, Profiles**" | Reddit search results page ("nri investment": tab row, sort controls, Communities rail) | **W13 — Universal search**: one search box, one results surface, five tabs, per-type result cards |
| **F2** | "**Maven Profile** — need to be able to see his **performance chart to prove he is an expert**… leverage features available in Ghostfolio. OK to take detail page also. **Only thing is his asset value mustn't be visible**" | eToro investor profile (Overview / Stats / Portfolio / Chart tabs; yearly + monthly **%** returns; risk score; profitable weeks; recently-traded with P/L %) | **W14 — Maven performance profile**: a public, detail-page-grade profile proving expertise with **percentage-only** performance sourced from the maven's linked Ghostfolio — **absolute values never rendered, anywhere** |

The client explicitly said the references are *design ideas, not a copy spec* ("You don't have to copy exactly this design") — so we take the information architecture (tabs, % returns, monthly heat table, stats) and re-express it in DesiSquare's own visual system (Porcelain Slate — the lane the client selected from Wireframes v2).

**Both asks extend — not disturb — the as-built v2 anatomy.** The flow map, 9-reaction system, WhatsApp mirroring, consent model, and mod queue all stand. This is additive: one new surface reachable from the (already present but inert) topbar search field, and one new surface reachable from every maven mention.

### F3 — Popular posts, Reddit-style *(post-review addition, client, 19 Jul 2026)*

> *"The landing page should show popular posts in feeds. Same with the communities joined by the user — highly popular posts displayed, just like Reddit."*

Two behaviors, both native-Discourse-backed:

- **W3 amendment — the signed-in landing feed defaults to Popular.** Sort tabs **Popular ▲ (default) · New** on the home feed; ranking by engagement (reactions + comments — the prototype uses `reactions + 2×comments` as a stand-in). *Production mapping:* Discourse's built-in **Hot** topic list (the native hot algorithm, tunable via the `hot_topics_*` site settings) set as the default home via `top_menu` (`hot|latest|new|…`), presented through the theme component. Discourse's **Top** (period) lists are the fallback/alternate. No plugin required.
- **W15 — Communities view (NEW).** Each **joined** community shows its own "Popular in ‹community›" top posts (Reddit's community-hot pattern); unjoined public communities show a join CTA ("join to follow — its popular posts then rank into your landing feed"); private communities never preview content (#3). *Production mapping:* per-category Hot/Top lists (`/c/‹category›/l/hot`), rendered as compact rows by the theme component.
- **Scope guard:** the **signed-out landing (W1) stays gated** per #7 — surfacing popular member posts to visitors would leak private-community content. If the client wants a public teaser, that is a separate, explicit decision (anonymized titles only) flagged for review — not part of F3 as built.

---

## 2. Product decisions (the judgment calls, made explicit)

These are the decisions embedded in the v3 spec, each traceable to a constraint from v2 or the feedback:

1. **The %-only rule becomes a *pipeline guarantee*, not a UI convention → new constraint #8.**
   v2's constraint #4 said "dollar values render for the owner only." F2 hardens this: the maven surface is built so absolute values are *not present in the data* that reaches any other member's browser — a server-side field whitelist, not CSS hiding. (Same philosophy as v2's E.164 leak-sweep, #5.) **Percent, ratio and rank fields only; currency-typed fields never leave the stats service.**

2. **Performance display is maven opt-in, default OFF → W7 gains one toggle.**
   Mirrors the consent architecture (#5). A maven flips **"Show my performance publicly (% only)"** in Settings; until then W14 renders credentials + activity only, with an honest "performance not shared" state. No maven is ever auto-exposed.

3. **Prove-the-expert, not copy-the-trader.**
   The eToro reference is a *regulated broker* running copy-trading. DesiSquare is a community. We deliberately **drop Copiers / "Copy" CTAs / open-trade P/L feeds** and keep: return chart (%), monthly returns table (%), risk/consistency stats, allocation mix (%), top positions as **% of portfolio** with return % (no quantities, no values), credentials, and community standing (posts, reactions received, helpful-rate). Follow = forum follow, nothing financial.

4. **Search is native Discourse, surfaced Reddit-style.**
   Discourse already indexes everything we need; the work is presentation (five tabs mapping onto Discourse's search + directory APIs) — a theme component, not a search engine build.

5. **The contested visual calls stay in the A/B Lab.**
   v3 adds no new global design decisions; W13/W14 render in the selected Porcelain Slate lane and inherit the existing A/B variants where relevant (feed density affects result rows).

---

## 3. The two new surfaces (wireframe spec)

### W13 — Universal search *(NEW · from F1)*

**Entry:** the W3 topbar field (now live), `/` keyboard shortcut, and the mobile search icon. Query persists in the URL (`/search?q=…&tab=…`) so results are shareable.

**Layout (desktop):** results column + right rail (matching v2's 3-col rhythm).

- **Tab row: All · Communities · Posts · Comments · Profiles** — counts on each tab; All is a composed digest (top community matches → top posts → top profiles), exactly the Reddit pattern the client referenced.
- **Controls:** sort (Relevance ▾ / Newest / Most reactions) · time (All time ▾) · scope note showing the active corridor ("searching US · change ▾" — country switcher applies, per v2's corridor model).
- **Result cards by type:**
  - *Community:* icon, name, PUBLIC/PRIVATE chip, members · online, one-line description, Join/Joined button (W8 semantics).
  - *Post:* space chip, title with match highlight, snippet, author pseudonym (+ MAVEN ✓ if applicable), reaction pills (compact), comments count, "via WhatsApp" chip when mirrored.
  - *Comment:* parent post title (linked), the matching comment snippet, author, thread deep-link.
  - *Profile:* avatar, pseudonym, MAVEN ✓ where applicable, credential line (mavens), reactions received; **maven cards additionally show the return-YTD % micro-stat if (and only if) that maven's performance sharing is ON** — search becomes a maven-discovery surface for free.
- **Right rail:** "Communities" module (top community matches with Join) — the Reddit rail, reused from W3's community rail component.
- **Empty state:** per-tab, with query suggestions ("try a ticker · a space · a member").
- **Privacy inherits:** search never returns private-community content to non-members, never returns flags/review-queue content (#3), and profile results respect W6 (private portfolio ⇒ no numbers of any kind on the card).

### W14 — Maven profile: performance proof *(NEW · from F2)*

**Entry:** every maven mention — feed card byline, W3 mavens rail, W13 profile results, post detail header.

**Header:** avatar · pseudonym · **MAVEN ✓** · credential line ("CFA · ex-Fidelity PM") · verification chips (✓ credential reviewed · ✓ desi check) · Follow button · member-since + community standing (posts / comments / reactions received / helpful rate).

**Privacy ribbon (always visible):** *"Performance verified via linked Ghostfolio · **% only — ₹/$ never shown** · updated daily"* — the trust device that makes the proof credible *and* advertises the privacy rule.

**Tabs (the "detail page" the client OK'd):**
1. **Overview** — cumulative return chart (%, area/line; ranges 6M · YTD · 1Y · 2Y · Max) benchmarked against a neutral index line (e.g. S&P 500 TR) for honest context; KPI row: **Return YTD · Return 1Y · Return 2Y (annualised) · Max drawdown · Profitable months · Risk band (Low/Med/High from realised volatility — a band, not a broker-style score)**; About/bio; **Top positions** list — each as **% of portfolio + return %**, no quantities, no values.
2. **Stats** — the eToro-style **monthly returns heat table** (year × month grid, green/red intensity by %, hover for exact value) + yearly totals column. This is the single strongest "prove it" artifact in the reference set.
3. **Allocation** — the W6 allocation-% bars (asset class + geography), unchanged semantics.
4. **Posts** — the maven's community activity (their best-of, sorted by reactions received) — expertise proof isn't only returns.

**States:** performance sharing OFF → tabs collapse to Posts + About with "This maven hasn't shared performance yet"; data-stale (> 48h) → chip "last verified n days ago"; insufficient history (< 6 months) → chart renders with an "early history" note rather than implying a track record.

**Compliance furniture (non-negotiable, on-surface):** footer disclaimer on every W14 view — *"Past performance is not indicative of future results. Educational content, not investment advice or a solicitation."* No "copy", no "beat the market" copy, no ranking of mavens by return (leaderboards by *reactions*, never by returns).

### Amendments to existing frames

- **W3 Feed:** topbar search is now functional (was decorative); maven byline links to W14.
- **W6 Public profile:** unchanged for members; for mavens with sharing ON, W6 *is* W14 (one public profile, superset).
- **W7 Settings:** new toggle under Privacy — **"Share my performance publicly · % only, verified via Ghostfolio"** (maven role only, default OFF). Sits directly below "Portfolio visibility," inheriting its explanatory-copy pattern.
- **Constraint list:** add **#8 percent-only pipeline** — *currency-typed fields are stripped server-side in gf-stats; no absolute portfolio, position, or P&L value ever reaches a non-owner client. Leak-sweep tested like #5.*

---

## 4. Implementation approach (production, not prototype)

v2's closing note defines the production shape: *"native Discourse config + theme component + two small scripts."* Phase 1.5 keeps that shape — **one theme-component workstream and one new small script.**

### 4.1 F1 Search — a theme component over Discourse's native search

Discourse already indexes posts, topics, categories, users and tags with full-text search, advanced filters and a JSON API. The build is a **"Universal Search" theme component** that presents those native results in the five-tab layout:

| Tab | Backed by (native Discourse) | Notes |
|---|---|---|
| Posts | `/search.json?q=…` topic results | space chip = category; supports `#space`, `in:title`, ticker terms |
| Comments | `/search.json` post-level results (non-OP posts) | deep-link to post-in-thread |
| Profiles | user search / directory (`/u/search/users`, directory API) | maven badge + credential from group + custom user fields; YTD% micro-stat fetched from gf-stats only for sharing-ON mavens |
| Communities | categories + groups from `site.json` (client-side match on name/description) | corridor-aware: filter by the active country's category tree (W8 model) |
| All | composition of the above | Reddit-style digest ordering: communities → posts → profiles |

- **Why not a search plugin?** Native search already covers the corpus; a plugin (server-side unified endpoint, custom ranking) is a Phase 2 upgrade path if relevance tuning demands it. Theme-component-only keeps Phase 1.5 deployable on the existing install with zero new server surface.
- **Search privacy is inherited, not built:** Discourse's search respects category permissions (private communities) natively; flags/review-queue content is never indexed. This is why building on native search is also the *safe* choice.
- **A/B Lab:** result-row density follows the existing Feed-density experiment variant.

### 4.2 F2 Maven performance — `gf-stats`, the third small script

A new sibling to `wa-bridge` and `gf-provisioner`:

```
Ghostfolio (maven's linked account)
        │  server-side, maven's scoped token (minted at provisioning — no password exists, per v2)
        ▼
   gf-stats  ── polls Ghostfolio portfolio-performance + holdings + allocations APIs
        │      · computes: cumulative % series, monthly returns, YTD/1Y/2Y, max drawdown,
        │        profitable-months %, realised-vol risk band, allocation %, top positions (% + return %)
        │      · WHITELIST serializer: percent/ratio/date fields only — currency-typed fields
        │        are stripped at the boundary (constraint #8), enforced by schema + leak-sweep test
        │      · respects the W7 consent flag (queried from Discourse group/user API) — consent OFF ⇒ 404
        │      · caches per-maven JSON (daily refresh + manual bust), rate-limit friendly
        ▼
   Discourse theme component (W14 renderer)
        · plugin-outlet connectors on the user-profile route for group "mavens"
        · renders chart/table/stats client-side from gf-stats JSON
        · shows honest states: not-shared / stale / early-history
```

**Why a proxy service rather than calling Ghostfolio from the browser:** (a) the %-only rule must be *unfalsifiable from the client* — enforcement lives where the data is shaped; (b) mavens' Ghostfolio tokens never reach any browser; (c) caching protects the market-data budget; (d) it gives us one place to add the consent check, the staleness stamp, and the leak-sweep test. This is constraint #8's home.

**Ghostfolio side:** read-only use of existing APIs (performance chart series in percentage mode, holdings/allocations) on the accounts `gf-provisioner` already creates — no Ghostfolio fork changes required for Phase 1.5.

### 4.3 Effort & sequencing (three sprints, ~5–6 engineer-weeks)

| Sprint | Scope | Exit criteria |
|---|---|---|
| **S1** (wk 1–2) | Universal Search theme component (tabs, cards, rail, empty states, URL state); gf-stats service skeleton + **whitelist serializer with leak-sweep test first** | Search usable on staging across all five tabs; gf-stats returns %-only JSON for a seeded maven; leak-sweep green |
| **S2** (wk 3–4) | W14 renderer (chart, monthly table, KPIs, positions, states); W7 consent toggle wired end-to-end (OFF ⇒ 404 ⇒ honest empty state); maven micro-stat in search profiles | A maven can opt in and their public profile proves performance in %; opting out removes it everywhere within one cache cycle |
| **S3** (wk 5–6) | Hardening: benchmark overlay, stale/early-history states, mobile pass (44px targets), A/B density hookup, docs + decision-log update, counsel review checkpoint | Acceptance list below fully green on staging; sign-off demo |

### 4.4 Acceptance criteria (the demo script)

1. `/` focuses search; "FCNR" returns the mirrored WhatsApp post under **Posts**, its reply under **Comments**; "nikhil" returns the maven under **Profiles** with YTD % chip; "invest" returns **US Investment** under Communities with Join.
2. Private-community content never appears for a non-member account; review-queue/flag content never appears for anyone.
3. W14 for `nikhil_cfa` (sharing ON): chart, monthly table, KPIs, allocation, top positions — **grep of every payload and rendered DOM finds zero currency-formatted values** (automated leak-sweep, extended from the #5 E.164 sweep).
4. Flip the W7 toggle OFF → W14 collapses to the not-shared state; search micro-stat disappears.
5. A maven with 3 months of history shows the early-history note, not a 2Y return.
6. Every W14 view renders the past-performance disclaimer; no surface ranks mavens by return.
7. All of the above in the Porcelain Slate lane (1c — the client-selected production theme) and on mobile.

---

## 5. Compliance treatment (read before building F2)

F2 is the risk-bearing feature: **publicly displayed returns used to establish investment expertise is precisely the pattern SEBI's finfluencer enforcement targets** (see the feasibility report §8 — association bans, the ₹546cr Dec 2025 order). The design above already encodes the mitigations; they are requirements, not suggestions:

- **Maven opt-in, verified identity, credentials displayed** — the platform doesn't manufacture the claim; a credentialed member chooses to substantiate theirs.
- **% only, no values** (the client's own rule, which is also the compliant one), **no copy-trading mechanics, no return-ranked leaderboards, no solicitation CTAs.**
- **Benchmark overlay + drawdown + early-history honesty** — presenting balanced performance, not cherry-picked upside.
- **Pervasive disclaimers** on every performance surface; educational positioning in Terms & moderation policy (already in v2's landing footer).
- **Counsel checkpoint in S3** before public launch: confirm the maven-performance surface, as scoped, doesn't require registration (India SEBI RIA/RA; US adviser rules for the US corridor) and whether any paid tier changes that answer.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| A currency value leaks via a new Ghostfolio API field | Whitelist (not blacklist) serializer + automated leak-sweep in CI (constraint #8) |
| Maven's linked portfolio has short/thin history → misleading chart | Early-history state; minimum 6-month history before the chart claims a track record |
| Search relevance disappoints at scale | Phase 2 upgrade path: server-side search plugin with unified endpoint + ranking; theme component UI is reusable as-is |
| Regulatory reading of "performance proof" | §5 mitigations + counsel checkpoint gate the launch |
| Ghostfolio API drift (~100 releases/yr) | gf-stats pins the Ghostfolio version contract; playbook's thin-fork/upgrade cadence applies |

## 7. Open questions for the client

1. **Theme lane:** ~~1a–1d (or hybrid) is still unpicked~~ — **DECIDED (client, 19 Jul 2026): 1c Porcelain Slate.** Dark (1a Midnight Bazaar) and 1d Haldi & Rani are rejected. Production implication: ship a single light color palette in the Discourse theme, assign **no dark palette**, and mark palettes non-user-selectable so members can't flip to an unbranded dark scheme; the Ghostfolio reskin uses the same Porcelain Slate tokens (light mode pinned).
2. **Benchmark choice** for the overlay per corridor (S&P 500 TR for US; Nifty 50 TR for India?).
3. **Minimum history** to display a track record — proposal: 6 months.
4. **Refresh cadence** — proposal: daily (matches "updated daily" ribbon); intraday adds cost with no trust benefit.
5. Should **non-maven members** ever get the % performance module on their public profile (opt-in), or is this maven-exclusive in Phase 1.5? Proposal: maven-exclusive.

---

## 8. Product output shipped with this plan

**`docs/desisquare-wireframes-v3-prototype.html`** — a self-contained interactive prototype (also published as a shareable artifact):

- **W13 live:** topbar search + `/` shortcut → five-tab results over seeded corpus (communities, posts incl. via-WhatsApp, comments, profiles), Reddit-pattern All digest, per-tab empty states, corridor note.
- **W14 live:** nikhil_cfa's performance profile — cumulative % chart with range switching and benchmark overlay, monthly-returns heat table (2024–2026), KPI row, risk band, allocation %, top positions (% + return %), consent-OFF state demo (priya_ea), privacy ribbon, disclaimers.
- **v2 anatomy preserved:** 3-col feed hub with reaction pills, mavens rail, via-WhatsApp chip; W7 settings excerpt with the new performance toggle.
- **Theme lane locked: 1c Porcelain Slate** (client decision, 19 Jul 2026 — dark and Haldi & Rani retired; lane switcher removed). Tokens remain a single `common.scss`-shaped variable block for direct transfer to the production Discourse theme.
- **Zero dollar values anywhere in the maven surfaces** — the prototype honors constraint #8 in its own seed data.

---

*Advisory prepared for scoping. Regulatory points are considerations to confirm with qualified counsel; not legal advice.*
