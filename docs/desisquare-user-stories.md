# DesiSquare — User-Story Corpus v3 (Product Version 3 · "The Living Square")

**Scope:** Product build **DesiSquareV3**, deployed on GCP per `deploy/gcp/` (discourse-1 + apps-1 VMs, Caddy TLS, GCS backups; demo mode on sslip.io hostnames). Systems: **Discourse** (Porcelain Slate theme + the v3 plugin set below), **Discourse Chat**, **Ghostfolio** (bounded reskin), **wa-bridge**, **gf-provisioner**, **gf-stats**, **WhatsApp Business Cloud API**, and the **digest job** (public teaser builder).
**Positioning:** Educational community only. No investment advice. Non-negotiable constraints referenced inline: #3 flags private, #4 dollars owner-only / public % only, #5 WhatsApp consent + no E.164 leakage, #7-A public-teaser gate, #8 percent-only maven pipeline, **#9 recognition ranks engagement, never money (new in v3)**.
**Lineage:** v1 (Phase 1, 70 stories) → v2 (Phase 1.5 + F4/F5/F6, 85 stories — archived at `docs/archive/desisquare-user-stories-v2.md`) → **v3 (this document, 124 stories)**. Stories carried from v2 keep their numbers; changes are marked **(AMENDED · v3)**; additions are marked **(NEW · v3)**.

## What's new in v3 (client requirements, 20 Jul 2026)

| Req | Requirement (client wording) | Where it lands | Discourse-native mechanism |
|---|---|---|---|
| **R1** | "Search interface on general text or stock ticker or labels" | Epic 4 (4.6–4.8, carried) + **Epic 20 — Market Pulse** (ticker hubs, trending tickers) | Full-text search + tags-as-labels + `tags:` filters + cashtag automation + tag pages as ticker hubs |
| **R2** | "Community conversations and interactions should be labelled … manually … automated if the tool allows … moderated by the moderator for effectiveness" | Epic 14 (carried, deepened) | Tags + tag groups (manual), discourse-automation + Discourse AI triage (automated), tag admin rename/merge/synonyms + label-quality view (moderated) |
| **R3** | "Popular discussions, summaries should appear in the free landing page, and popular discussions in the group one chooses … Reddit-style summary interface, best of Discord discussions as reference" | Epic 15 (carried, deepened) + landing ticker strip (20.4) | Hot/Top lists (global + per category) + Discourse AI topic summaries + cached digest job + custom-homepage theme |
| **R4** | **"The new version should be as lively and interactive as possible"** + "leverage the power of Discourse" | **New Epics 16–20** + R4-driven amendments across Epics 1, 2, 3, 9, 10, 11, 12, 13, 15 (1.1, 1.4, 1.7, 2.2, 2.5, 3.1, 9.1, 10.3, 10.4, 11.1, 11.3, 12.3, 12.4, 12.5, 12.7, 13.2, 15.1) | MessageBus live updates, presence, user status, **Discourse Chat**, discourse-reactions, native polls, discourse-gamification, badges, discourse-calendar/post-event, discourse-automation, Data Explorer |
| **R5** | **Karma system** (carried from the parallel karma build, 20 Jul 2026): weighted earning + anti-gaming, byline chips, tiers, "top contributors by karma never returns", moderator karma effects, transparency page | **New Epic 21** + 7.7 five-signal credibility strip + 18.1 amendment | Gamification scoring + Solved accepted answers + scheduled badge queries (tiers) + theme components (chips/strip) |

> **Constraint #9 (new, forced by R4):** *Recognition ranks engagement, never money.* No leaderboard, badge, streak, or trending surface may rank or score members by portfolio returns, and none may imply advice quality. Maven percentages appear **only** inside that maven's own W14 module (#8). Leaderboard and badge payloads are covered by the leak-sweep (12.5): zero % returns, zero currency, zero E.164.
>
> **A deliberate non-change:** the public reaction set stays **exactly four pills** (Helpful / Insightful / Actionable / Like). v3 implements them via discourse-reactions configured to that fixed set — liveliness comes from real-time counts, celebration micro-moments, chat, and events, **not** from an unbounded emoji wall that would dilute the structured-feedback semantics of #3.

## The v3 Discourse plugin set (the "power of Discourse" R4 leans on)

| Machinery | Kind (verified Jul 2026) | Powers |
|---|---|---|
| MessageBus live updates | core (always on) | 16.1, 16.2, 16.5 live feed/thread/counter updates |
| Presence (typing/replying) + user status | core (user status: enable `enable_user_status`) | 16.3, 16.4 |
| **Discourse Chat** | **core** (bundled since 3.0; gate via `chat_allowed_groups`) | Epic 17 — corridor Squares, threads, DMs, chat→topic transcripts |
| discourse-reactions | bundled into core since 3.5 (enable via setting; fixed set via config) | Epic 3 pills (exactly 4) with live counts |
| Native poll builder | core (plugins/poll) | 18.4 sentiment & discussion polls |
| discourse-gamification | bundled into core mid-2025 (off by default) | Epic 21 karma + 18.1 leaderboards (#9-bounded) |
| Badge system (custom badge SQL via `enable_badge_sql`, console — self-hosted freedom) | core | 18.2 desi-themed badge ladder |
| discourse-topic-voting | bundled into core Jul 2025 (off by default, per-category) | 18.5 community roadmap voting |
| Discourse Calendar & Events (post-event) | bundled into core since 3.5 (enable `calendar_enabled` + `discourse_post_event_enabled`) | Epic 19 AMAs, rituals, RSVPs, ICS, RSVP-driven event chat channels |
| Automation (formerly discourse-automation) | core since 2024 | 14.3 auto-labelling triggers, 19.2 rituals, 20.2 trending refresh |
| Watched-words **tag** action | core | 14.3/14.5 literal keyword/cashtag → label |
| Discourse AI (summarize, llm_tagger/llm_triage) | official plugin + BYO LLM key (Claude supported) | 15.2 summaries, 14.3 semantic label proposals, 19.5 recaps |
| Tags, tag groups, synonyms | core (creation/tagging gated by `*_allowed_groups`) | Epic 14 labels, 20.1 ticker hubs |
| Hot/Top lists (global + per category) | core (anon-403 under login-required — teaser goes through the digest job's API-key proxy) | 2.1, 5.4, Epic 15 digests |
| discourse-data-explorer | bundled into core Jul 2025 (staff-only) | 14.4 label metrics, 20.2 trending tickers |
| discourse-whos-online | official plugin, **not** bundled (app.yml clone; count-only mode) | Epic 16 online-now signals (sized <100 concurrent) |
| discourse-follow | official plugin, **not** bundled (app.yml clone) | 16.7 follow mavens/members |

> **Ops note (12.4):** the mid-2025 core-bundling wave means upgrade runbooks must **remove** stale `app.yml` clone lines for gamification/solved/cakeday/calendar/topic-voting/data-explorer/automation (rebuilds fail otherwise); only discourse-ai, discourse-whos-online, and discourse-follow remain external clones on current versions.

---

## Personas

| Persona | Description |
|---|---|
| **Visitor** | Signed-out person who landed on community.example.com. Sees only the gated landing (W1) with the public teaser digest. Has (or lacks) an invite code. |
| **Member** | Pseudonymous retail investor (e.g., `quiet_lotus`) in a country corridor. Posts, reacts, flags, chats, RSVPs, tracks a private portfolio, may opt into WhatsApp. |
| **Maven** | Credentialed expert member (e.g., `nikhil_cfa`, CFA). May opt into public performance proof — percent-only, never currency. Hosts AMAs. |
| **Moderator** | Trusted member who works the private review queue (W9): removes content, dismisses flags, curates labels and the public digest, moderates chat. |
| **Community Admin** | Owns a corridor community's configuration: spaces, membership approvals, maven credentialing, chat channels, events, experiments (W10). |
| **Platform Operator (Ops)** | Runs the GCP stack: deploy, TLS, backups, upgrades, monitoring, leak-sweep CI, demo drawer (W11), plugin-set pinning. |
| **Compliance Officer** | Guardian of educational-only positioning, disclaimers, SEBI finfluencer risk, WhatsApp opt-in rules, and privacy constraints #3/#4/#5/#8/#9. |

---

## Epic 1 — Onboarding & Access

**1.1** As a **Visitor**, I want the signed-out landing to show only the curated public teaser and nothing else, so that member content stays private until I'm invited (#7-A). **(AMENDED · v3: chat and presence added to the excluded list)**
- Given I am signed out, When I open community.example.com, Then I see the W1 landing (value prop, invite field, sign-in link) plus the public digest (Epic 15) — and nothing beyond it: no full threads, no comments, no member lists, no search, **no chat, no presence/online indicators, no events/calendars, no leaderboards, no label/ticker hubs (16.6, 17.6, Epic 19, 18.1, 20.1)**.
- Given I request any deep URL (post, profile, community, search, chat channel, label/ticker hub `/label/*`, event, or leaderboard page) while signed out, When the page loads, Then I am redirected to W1 with no content flash — teaser cards link to the join gate, not the thread (15.5).
- Given I query Discourse member JSON endpoints (`/latest.json`, `/u/…`, `/search.json`, `/chat/…`) anonymously, When the response returns, Then it is 403/redirect, not content; the only anonymous data path is the cached digest payload of 15.1.
- **Priority:** P0 · **Wireframe:** W1 · **Systems:** Discourse

**1.2** As a **Visitor**, I want to redeem invite code `DSQ-2026` to create an account, so that I can join the community.
- Given I enter `DSQ-2026` on W1, When I submit, Then I proceed to account creation (email, password, pseudonym).
- Given I enter a wrong code, When I submit, Then I see a generic "invalid code" error with no hint about valid formats, and repeated attempts are rate-limited.
- Given I complete signup, When my email is verified via transactional SMTP, Then my account activates and I land on the W3 feed.
- **Priority:** P0 · **Wireframe:** W1, W2 · **Systems:** Discourse

**1.3** As a **Visitor**, I want a clear sign-in screen with honest error states, so that returning is frictionless.
- Given valid credentials on W2, When I sign in, Then I reach the W3 feed in one step.
- Given a wrong password, When I submit, Then I see a single non-enumerating error ("email or password incorrect") and a reset-password path via SMTP.
- Given 5 failed attempts, When I try again, Then the attempt is throttled.
- **Priority:** P0 · **Wireframe:** W2 · **Systems:** Discourse

**1.4** As a **Member**, I want to participate under a pseudonym, so that my financial discussions aren't tied to my legal identity. **(AMENDED · v3: chat added to the pseudonymity surfaces; profile allowlist extended for v3 elements)**
- Given signup, When I choose a handle like `quiet_lotus`, Then my real name and email never render on any public surface (posts, profiles, search, chat, mirrored content).
- Given another member views my W6 public profile, When it loads, Then only pseudonym, corridor, join date, badges (incl. featured badges and karma tier, Epic 21), user status (16.4), streak/cakeday marks (18.3, unless opted out per 10.5), and (if opted-in) allocation % appear — never a real name, email, or E.164 number.
- Given an admin exports member lists, When staff views them, Then email visibility is restricted to admin role only.
- **Priority:** P0 · **Wireframe:** W2, W6 · **Systems:** Discourse

**1.5** As a **Member**, I want a Ghostfolio account provisioned automatically and exactly once at signup, so that portfolio tracking works without a second registration.
- Given my Discourse signup completes, When the signup webhook fires, Then gf-provisioner creates exactly one Ghostfolio account linked to my Discourse user id.
- Given the webhook is delivered twice (retry/replay), When gf-provisioner processes it, Then no second account is created (idempotency on user id).
- Given provisioning fails transiently, When the retry succeeds, Then my W5 "Open my portfolio" SSO link works; until then W5 shows a "setting up your portfolio" state, not an error page.
- **Priority:** P0 · **Wireframe:** W2, W5 · **Systems:** gf-provisioner, Discourse, Ghostfolio

**1.6** As a **Community Admin**, I want to grant and revoke maven credentials, so that expert badges are earned, not self-declared.
- Given a member submits credential evidence (e.g., CFA), When I approve it, Then their profile and posts show the maven badge with credential label within one page refresh.
- Given I revoke maven status, When the member's content renders, Then the badge disappears everywhere and their W14 performance module (if any) is unpublished.
- Given a non-admin tries the credential admin route, When they request it, Then access is denied.
- **Priority:** P1 · **Wireframe:** W5, W14 · **Systems:** Discourse, gf-stats

**1.7** As a **Member**, I want first-run onboarding to pick my corridor and starter spaces, so that my feed is relevant from day one. **(AMENDED · v3: also joins the corridor's chat Square)**
- Given first sign-in, When onboarding runs, Then I pick one corridor (US/CA/UK/AE/AU/SG) and am auto-joined to its default spaces (Stocks & ETFs, Ask the community, Watercooler) **and its corridor chat channel (17.1), with a one-line explainer and a leave affordance**.
- Given I skip onboarding, When I land on W3, Then a persistent-but-dismissible prompt lets me finish later; the feed still renders with sensible defaults.
- **Priority:** P1 · **Wireframe:** W2, W8 · **Systems:** Discourse

---

## Epic 2 — Feed & Posting

**2.1** As a **Member**, I want my feed to default to Popular, so that I see the community's best current discussions first.
- Given I open W3, When the feed loads, Then the sort is Popular (Discourse Hot) scoped to my joined communities/spaces.
- Given a post gains reactions and replies, When Hot recalculates, Then it rises in Popular without manual curation.
- Given I return in a new session, When W3 loads, Then Popular is still the default (my last toggle may persist per session, but the product default is Popular).
- **Priority:** P0 · **Wireframe:** W3 · **Systems:** Discourse

**2.2** As a **Member**, I want to switch between Popular and New sorts (F3), so that I can catch fresh posts too. **(AMENDED · v3: live pill integration)**
- Given W3, When I tap "New", Then the feed re-orders strictly by created-at descending without a full page reload.
- Given "New" is active, When a post is created elsewhere, Then it appears at the top on next refresh **or via the live pill (16.1) without any refresh**.
- Given I switch back to Popular, When the list renders, Then ordering matches Discourse Hot for the same scope.
- **Priority:** P0 · **Wireframe:** W3 (F3) · **Systems:** Discourse

**2.3** As a **Member**, I want a composer that requires choosing a community and space, so that posts land where the right people see them.
- Given I open the composer from W3, When I write, Then community + space (e.g., US → Taxes & FEMA) are required before Post enables.
- Given I post, When it publishes, Then it appears in that space, in my corridor feed, and in universal search within 60 seconds.
- Given my draft is unsent, When I navigate away and return, Then the draft is restored.
- **Priority:** P0 · **Wireframe:** W3, W4 · **Systems:** Discourse

**2.4** As a **Member**, I want threaded replies on a post detail page, so that discussions stay readable.
- Given W4, When I reply to the post or quote a specific comment, Then my reply renders in-thread with attribution to the pseudonym only.
- Given a reply mentions `@quiet_lotus`, When it posts, Then the mentioned member gets an in-app notification (and WhatsApp, if opted-in — see 8.6).
- Given a post is removed by moderation, When I open its URL, Then I see a neutral "removed" state, not the content.
- **Priority:** P0 · **Wireframe:** W4 · **Systems:** Discourse

**2.5** As a **Member**, I want the feed and composer to work well on mobile, so that I can participate from my phone. **(AMENDED · v3: liveliness surfaces added to the mobile acceptance)**
- Given a 360px viewport, When I browse W3/W4, Then no horizontal scroll occurs, tap targets are ≥44px, and the sort toggle and reaction pills remain reachable.
- Given the mobile composer, When I post, Then behavior (required space, draft restore) matches desktop.
- Given a 360px viewport, When I use chat (W16), events/RSVP (W17), and the leaderboard (W18), Then the same rules hold — no horizontal scroll, ≥44px targets — and the chat dock goes full-screen (17.1).
- **Priority:** P1 · **Wireframe:** W12, W16, W17, W18 · **Systems:** Discourse

**2.6** As a **Maven**, I want my posts visibly badged, so that readers can weigh credentialed perspectives (without implying advice).
- Given `nikhil_cfa` posts, When the card renders in W3/W4, Then the maven badge + credential label appear next to the pseudonym.
- Given any maven-badged post, When it renders, Then the standard "educational, not investment advice" disclaimer is present on the post detail (see 11.1).
- **Priority:** P1 · **Wireframe:** W3, W4 · **Systems:** Discourse

---

## Epic 3 — Reactions & Flagging

**3.1** As a **Member**, I want four public reaction pills — Helpful, Insightful, Actionable, Like — so that I can give structured feedback. **(AMENDED · v3: implemented via discourse-reactions, fixed set)**
- Given any post/comment, When I tap a pill, Then it increments instantly, highlights as mine, and tapping again removes it.
- Given the pill set, When I inspect the UI, Then exactly these four exist and no dislike/downvote exists; **the discourse-reactions configuration is locked to these four — members cannot add other emoji**.
- Given native reactions semantics, When I pick a second pill on the same post, Then it replaces my first (one reaction per member per post — a deliberate structured-feedback choice, not a limitation to work around).
- Given I react on mobile (W12), When I tap, Then the same behavior holds.
- **Priority:** P0 · **Wireframe:** W3, W4 · **Systems:** Discourse (discourse-reactions)

**3.2** As a **Member**, I want to see aggregate reaction counts per pill, so that I can gauge community sentiment.
- Given a post with reactions, When W4 renders, Then per-pill counts display; tapping a count shows reacting pseudonyms (public reactions are attributable, unlike flags).
- Given zero reactions, When the card renders, Then pills show without counts (no "0" clutter).
- **Priority:** P1 · **Wireframe:** W3, W4 · **Systems:** Discourse

**3.3** As a **Member**, I want to flag content with one of five private reasons — Misleading, Low Effort, Spam, Violation, Marketing — so that moderators can act (#3).
- Given W4's overflow menu, When I choose Flag, Then a modal offers exactly the five reasons plus optional free-text note.
- Given I submit, When the flag is recorded, Then it enters the W9 queue and I see a "thanks, moderators will review" confirmation.
- Given I already flagged an item, When I try again, Then I'm told my flag is pending rather than double-counting.
- **Priority:** P0 · **Wireframe:** W4, W9 · **Systems:** Discourse

**3.4** As a **Member**, I want my flags to be invisible to everyone except moderators, so that reporting is safe (#3).
- Given content I flagged, When any non-moderator (including the author) views it, Then no flag count, badge, or indicator appears anywhere in the UI or API responses.
- Given the author of flagged content, When they check notifications, Then nothing reveals a flag occurred until a moderator action (removal) happens — and even then the flagger's identity is never disclosed.
- **Priority:** P0 · **Wireframe:** W4, W9 · **Systems:** Discourse

**3.5** As a **Moderator**, I want each flag to route into the review queue with reason and context, so that triage is fast.
- Given a new flag, When it's created, Then a W9 queue item appears within 60 seconds containing content excerpt, reason, note, flagger pseudonym (mod-visible only), and flag count.
- Given multiple flags on one item, When the queue renders, Then they collapse into one item with all reasons listed.
- **Priority:** P0 · **Wireframe:** W9 · **Systems:** Discourse

---

## Epic 4 — Search & Discovery

**4.1** As a **Member**, I want universal search with an "All" results view, so that one query finds anything (F1).
- Given W13, When I search "FEMA", Then the All tab returns mixed results (communities, posts, comments, profiles) grouped with section headers, best-match first.
- Given results, When I click one, Then I deep-link to the exact post/comment anchor or profile.
- Given no matches, When results return, Then an empty state with search tips appears (no error).
- **Priority:** P0 · **Wireframe:** W13 (F1) · **Systems:** Discourse

**4.2** As a **Member**, I want dedicated tabs — All / Communities / Posts / Comments / Profiles — so that I can narrow by type.
- Given a query, When I switch tabs, Then results filter to that type only, preserving the query.
- Given the Comments tab, When results render, Then each shows the comment snippet plus its parent post title.
- Given the Communities tab, When results render, Then each shows corridor, member count, and a Join/Joined state.
- **Priority:** P0 · **Wireframe:** W13 · **Systems:** Discourse

**4.3** As a **Member**, I want profile search to expose pseudonyms only, so that search can never deanonymize anyone.
- Given I search an email address or phone number, When Profiles results return, Then zero matches occur even if that email/phone belongs to a member.
- Given a profile result, When it renders, Then it shows pseudonym, badge, corridor — never email, real name, or E.164 number.
- **Priority:** P0 · **Wireframe:** W13 · **Systems:** Discourse

**4.4** As a **Visitor**, I want search to be inaccessible while signed out, so that the gate holds (#7-A). **(AMENDED · v3: #7→#7-A normalization; leak-sweep binding added)**
- Given signed-out state, When I request the search UI or `/search.json?q=…`, Then I'm redirected to W1 / receive 403 with no result payload.
- Given the leak-sweep (12.5), When it runs, Then the anonymous `/search.json` 403 is asserted on every run — a regression fails the deploy.
- **Priority:** P1 · **Wireframe:** W1, W13 · **Systems:** Discourse

**4.5** As a **Member**, I want recent-search and trending suggestions in the empty search state, so that discovery starts before I type. **(AMENDED · v3: trending now includes the Market Pulse ticker strip)**
- Given W13 with an empty query, When it opens, Then my recent searches (local), a few trending topics, **and the top trending ticker chips (20.2)** render as tappable chips.
- Given I clear recent searches, When I reopen search, Then they're gone.
- **Priority:** P2 · **Wireframe:** W13 · **Systems:** Discourse

**4.6** As a **Member**, I want to search by **stock ticker** — `NVDA` or `$NVDA` — and get ticker-focused results, so that I can follow everything the community says about a security (R1/F4). **(AMENDED · v3: ticker chip links to the 20.1 hub)**
- Given I search `NVDA` or `$NVDA`, When results return, Then conversations **labelled** with the `nvda` ticker label (Epic 14) rank first, followed by full-text mentions in post bodies/titles, in every tab.
- Given ticker results, When the results header renders, Then a **ticker chip** ("$NVDA · 14 discussions · label") appears; tapping it pins the label filter (`tags:nvda`) so I can then add free text within that scope, **and links to the $NVDA ticker hub (20.1)**.
- Given a ticker with zero labelled content but text mentions, When results return, Then text matches still appear (search never comes back empty just because labelling lags).
- Given cashtag input with lowercase/mixed case (`$nvda`), When parsed, Then it normalizes to the canonical ticker label.
- **Priority:** P0 · **Wireframe:** W13 (F4) · **Systems:** Discourse (tags + `tags:` search filter)

**4.7** As a **Member**, I want to search and filter by **label**, so that I can pull up every conversation on a theme (FEMA, FCNR, 401k…) regardless of wording (R1/F4).
- Given W13, When I type a query matching a label name (e.g., "fema"), Then a **label suggestion chip** renders above results ("Label: fema · view all"); tapping it opens the label's browse page (14.6) / applies `tags:fema`.
- Given an active label filter, When I switch tabs (Posts/Comments), Then the filter persists and the URL reflects it (`…&label=fema`) so filtered searches are shareable.
- Given multiple labels selected, When results render, Then AND/OR behavior is explicit in the UI (default: AND), matching Discourse `tags:a+b` vs `tags:a,b` semantics.
- **Priority:** P0 · **Wireframe:** W13 (F4) · **Systems:** Discourse (native tag search)

**4.8** As a **Member**, I want to combine free text, ticker, label, space, and author in one query, so that precise questions get precise answers (R1/F4).
- Given the query `FCNR tags:fema #taxes-fema @priya_ea`, When executed, Then results satisfy **all** constraints (text + label + space + author), using Discourse's advanced-search operators surfaced as removable filter chips.
- Given I build the same query via UI chips (no syntax), When executed, Then results are identical to the typed-operator form.
- Given an invalid operator, When submitted, Then it degrades to plain text search with a gentle hint, never an error page.
- **Priority:** P1 · **Wireframe:** W13 (F4) · **Systems:** Discourse (advanced search operators)

---

## Epic 5 — Communities & Corridors

**5.1** As a **Member**, I want to browse the six corridor communities and their spaces, so that I can find my people.
- Given W8, When it loads, Then all corridors (US/CA/UK/AE/AU/SG) list with description, member count, and my membership state.
- Given I open a corridor, When W15 renders, Then its spaces (Stocks & ETFs, Taxes & FEMA, 401k & Retirement, Real Estate, Ask the community, Insurance & Visas, Watercooler) list with post counts.
- **Priority:** P0 · **Wireframe:** W8, W15 · **Systems:** Discourse

**5.2** As a **Member**, I want to join an open community in one click, so that its posts enter my feed.
- Given an open corridor on W8, When I tap Join, Then the button flips to Joined and its posts appear in my W3 feed immediately.
- Given I leave a community, When I confirm, Then its posts drop from my feed and my membership count updates.
- **Priority:** P0 · **Wireframe:** W8, W3 · **Systems:** Discourse

**5.3** As a **Member**, I want to request access to a restricted community, so that gated groups stay curated.
- Given a request-to-join community, When I tap Request, Then the state shows Pending and the Community Admin gets an approval item.
- Given the admin approves/denies, When I'm notified, Then approved grants immediate access; denied shows a neutral message with no reason leakage.
- **Priority:** P1 · **Wireframe:** W8 · **Systems:** Discourse

**5.4** As a **Member**, I want each community page to surface its own Popular posts (F3), so that I can skim a corridor's best content.
- Given W15 for a corridor, When it loads, Then a Popular list (Hot, scoped to that community) renders by default with a New toggle.
- Given the same post in the global feed, When I compare rank, Then community-scoped Popular ranks against community peers only.
- **Priority:** P0 · **Wireframe:** W8, W15 (F3) · **Systems:** Discourse

**5.5** As a **Community Admin**, I want to manage my corridor's spaces (create, rename, order, archive), so that structure evolves with the community.
- Given admin tools on W8, When I rename a space, Then existing posts keep their URLs and appear under the new name.
- Given I archive a space, When members browse, Then it's read-only (no new posts) but history stays searchable.
- Given a non-admin, When they attempt space management, Then access is denied.
- **Priority:** P1 · **Wireframe:** W8, W15 · **Systems:** Discourse

---

## Epic 6 — Portfolio & Privacy

**6.1** As a **Member**, I want a 1-click SSO link from my Discourse profile into Ghostfolio, so that I never manage a second login.
- Given W5, When I click "Open my portfolio", Then gf-provisioner mints a short-lived signed SSO link and I land authenticated in my Ghostfolio account on app.example.com.
- Given the SSO link is reused after expiry (≤5 min) or by another user, When it's presented, Then it's rejected and W5 offers a fresh link.
- Given my session, When I inspect the link, Then it contains no email or phone number in the URL.
- **Priority:** P0 · **Wireframe:** W5 · **Systems:** gf-provisioner, Ghostfolio, Discourse

**6.2** As a **Member**, I want to see my own portfolio in full currency detail, so that the tracker is actually useful to me (#4).
- Given I'm the owner in Ghostfolio, When W5 renders, Then I see dollar values, P/L, and transactions — full fidelity.
- Given I'm the owner, When I view my own public preview, Then a "This is what others see" mode shows the %-only view of W6.
- **Priority:** P0 · **Wireframe:** W5 · **Systems:** Ghostfolio

**6.3** As a **Member**, I want other members to see only my allocation percentages — never currency amounts, so that my net worth stays private (#4).
- Given member B opens member A's public profile (W6), When the allocation module renders, Then only asset-class/holding percentages summing to ~100% appear; no currency symbol, amount, or share count anywhere in HTML or API payloads.
- Given gf-stats serves the public endpoint, When the response is inspected, Then currency fields are stripped server-side (not hidden client-side).
- Given member A has visibility off (default), When B opens W6, Then no portfolio module renders at all.
- **Priority:** P0 · **Wireframe:** W6 · **Systems:** gf-stats, Ghostfolio, Discourse

**6.4** As a **Member**, I want portfolio public-visibility off by default with an explicit opt-in toggle, so that sharing is a deliberate choice.
- Given a fresh account, When I check W7, Then "Show my allocation % publicly" is OFF.
- Given I toggle it on, When I confirm the explainer ("percentages only, never amounts"), Then W6 shows the module within 60 seconds; toggling off removes it within 60 seconds.
- Given the toggle changes, When it's recorded, Then a timestamped consent entry appears in my consent history (see 10.1).
- **Priority:** P0 · **Wireframe:** W7, W6 · **Systems:** Discourse, gf-stats, Ghostfolio

**6.5** As a **Member**, I want to record holdings and transactions in the reskinned Ghostfolio, so that my allocation and performance data are real. **(AMENDED · v3: acceptance made observable)**
- Given the bounded reskin, When I use Ghostfolio, Then each core flow has an observable pass: an added activity appears in the holdings view within 60 seconds, the performance chart renders for the seeded account, and the reskin assertions hold (DesiSquare logo asset served; Porcelain Slate palette variables applied) — all without forked upstream internals.
- Given I add a transaction, When gf-stats next computes, Then my allocation % (and maven % series if applicable) reflect it.
- **Priority:** P1 · **Wireframe:** W5 · **Systems:** Ghostfolio

**6.6** As a **Compliance Officer**, I want an automated check proving public portfolio surfaces contain no currency values, so that #4 is continuously enforced.
- Given the leak-sweep suite (see 12.5), When it crawls W6 pages and gf-stats public endpoints as a non-owner, Then any currency symbol, formatted amount, or numeric field tagged as monetary fails the build.
- Given a regression that exposes an amount, When CI runs, Then the deploy is blocked and Ops is alerted.
- **Priority:** P0 · **Wireframe:** W6 · **Systems:** gf-stats, Ghostfolio

**6.7** *(NEW · v3 · client decision 20 Jul 2026 — resolves open question #4)* As a **Member**, I want to make my portfolio **gains** visible or private — percent only, monthly / yearly / overall — so that any member (not only mavens) can build trust with a track record, on their own terms.
- Given W7, When I open portfolio settings, Then a **"Share my gains — % only"** toggle exists, **OFF by default** and independent of the allocation-% toggle (6.4); the explainer states exactly what publishes: **Monthly, Yearly, and Overall percentage returns — never dollar amounts, never holdings values**.
- Given I turn it ON, When my public profile (W6) renders for another member, Then a gains module shows my **This Month %, This Year %, and Overall % (cumulative + annualized)** plus a small monthly-returns strip — computed server-side by gf-stats, with currency stripped server-side (#4/#8), and labelled **"self-reported track record — not independently verified"** to distinguish it from a maven's Ghostfolio-verified proof (7.2).
- Given the toggle is OFF, When anyone opens my W6, Then no gains module renders at all; and given it changes, Then a timestamped consent entry lands in my consent history (10.1).
- Given the gains module and its API payload, When inspected, Then there is **zero currency, zero share count, zero absolute value** — percentages only (leak-sweep 12.5 asserts this on member profiles too, exactly as it does for mavens).
- **Priority:** P0 · **Wireframe:** W6, W7, W14 · **Systems:** gf-stats, Discourse, Ghostfolio

---

## Epic 7 — Maven Trust & Performance Proof

**7.1** As a **Maven**, I want to explicitly opt in before any performance data is published, so that public proof is always consensual (#8). **(AMENDED · v3: maven proof is now the *verified* superset of the member gains toggle 6.7)**
- Given maven status, When I visit W7, Then a "Publish my performance (percent only) — **verified via linked Ghostfolio**" toggle exists, OFF by default, with an explainer of exactly what will be shown.
- Given I opt in, When I confirm, Then consent is timestamped and my W14 module goes live on the next gf-stats cycle.
- Given a non-maven member, When they view W7, Then they see the **6.7 member gains toggle** instead (self-reported, unverified) — the *verified* maven toggle here is what the maven badge and credential (7.5) add on top.
- **Priority:** P0 · **Wireframe:** W7, W14 · **Systems:** gf-stats, Discourse, Ghostfolio

**7.2** As a **Member**, I want to see an opted-in maven's performance as percentages over standard periods (F2), so that credibility is evidence-based (#8). **(AMENDED · v3: Monthly / Yearly / Overall made explicit per client)**
- Given `nikhil_cfa` opted in, When I open their W14 module, Then I see **Monthly, Yearly, and Overall** percentage returns — a headline **This Month % · This Year % · Overall % (cumulative + annualized)**, a **monthly-returns strip** (last ~12 months, eToro-style, % only) and **calendar-year bars** — plus allocation %, all computed by gf-stats from their Ghostfolio data. (Finer periods like 3M/6M/YTD may also render; Monthly/Yearly/Overall are required.)
- Given the rendered module and its API response, When inspected, Then no currency value, portfolio size, share count, or absolute amount appears anywhere in the HTML or JSON — **only his asset value must never be visible** (client feedback); currency is stripped server-side in gf-stats (the models-service equity series is a percent index by construction).
- Given the module, When it renders, Then a "past performance ≠ future results; educational only" disclaimer is adjacent, not hidden behind a click.
- **Priority:** P0 · **Wireframe:** W14 (F2) · **Systems:** gf-stats, Ghostfolio

**7.3** As a **Member**, I want honest states when performance data is thin or stale, so that the proof never overstates.
- Given a maven with under the minimum history for a period, When W14 renders, Then that period shows "Not enough history" instead of a number.
- Given gf-stats hasn't refreshed within its SLA (e.g., 24h), When W14 renders, Then a "Data as of <timestamp>" label shows, and beyond a hard staleness threshold the module shows a "temporarily unavailable" state rather than old numbers without context.
- Given a computation error, When it occurs, Then the module fails closed (nothing shown) rather than showing partial figures.
- **Priority:** P0 · **Wireframe:** W14 · **Systems:** gf-stats

**7.4** As a **Maven**, I want to revoke my performance opt-in at any time, so that consent is reversible.
- Given my toggle is ON, When I turn it OFF in W7, Then W14 stops rendering my module within 60 seconds and gf-stats stops serving my data on its next request.
- Given revocation, When historical caches are checked, Then cached public responses are purged within the same window.
- **Priority:** P0 · **Wireframe:** W7, W14 · **Systems:** gf-stats, Discourse

**7.5** As a **Member**, I want maven credentials displayed with how they were verified, so that badges mean something.
- Given `nikhil_cfa`'s profile, When W5/W14 renders, Then the credential (CFA) shows with "verified by community admins on <date>".
- Given a revoked credential (1.6), When pages render, Then the badge and verification line are gone everywhere.
- **Priority:** P1 · **Wireframe:** W5, W14 · **Systems:** Discourse

**7.6** As a **Compliance Officer**, I want the performance module framed strictly as track record, never as advice or solicitation, so that finfluencer-regulation risk (incl. SEBI-style regimes) is minimized.
- Given W14, When reviewed, Then copy contains no forward-looking claims, no "follow my trades," no subscription/solicitation CTA, and the standing disclaimer set.
- Given a maven bio or module description containing prohibited phrases (from a maintained denylist, e.g., "guaranteed returns"), When saved, Then it's blocked or routed to the W9 queue for review.
- **Priority:** P0 · **Wireframe:** W14 · **Systems:** Discourse, gf-stats

**7.7** *(NEW · v3 · R5)* As a **Member**, I want a five-signal credibility strip on every maven profile, so that trust rests on more than one number.
- Given `nikhil_cfa`'s W14 profile, When it renders between the header and the privacy ribbon, Then five signals show: **Credential** (verified, with date — 7.5), **Karma tier** (Epic 21), **Accepted answers** (count), **Tenure** (member since), and **Track-record proof** (shared / not shared — 7.1).
- Given the maven flips the performance toggle OFF (7.4), When the strip re-renders (≤60s), Then **only** the proof signal changes to "not shared" — the other four stand untouched (consent removes proof, never reputation).
- Given the strip's payload, When inspected, Then it contains no currency and no % returns — the proof signal is a shared/not-shared state, not a number (#8; numbers live only inside the W14 module itself).
- **Priority:** P1 · **Wireframe:** W14 · **Systems:** Discourse (theme component), gf-stats (proof state only)

---

## Epic 8 — WhatsApp Integration

**8.1** As a **Member**, I want to opt in to WhatsApp notifications with explicit consent, so that messaging follows opt-in rules (#5).
- Given W7, When I enable WhatsApp notifications, Then I must enter my number, receive a verification message, and confirm — only then is consent recorded with timestamp and scope.
- Given no verified opt-in, When any notification event occurs for me, Then zero WhatsApp messages are sent to my number.
- Given the first message after opt-in, When it arrives, Then it states what I'll receive and how to stop (STOP).
- **Priority:** P0 · **Wireframe:** W7 · **Systems:** WhatsApp, Discourse

**8.2** As a **Member**, I want replying STOP to immediately end all WhatsApp messages, so that opting out is one word.
- Given I'm opted in, When I reply STOP, Then all WhatsApp sends to me cease immediately, my W7 toggle flips off, and a final confirmation message is sent.
- Given I later re-enable in W7, When I re-verify, Then messages resume only after fresh consent.
- Given a STOP is received, When the consent log is checked, Then the revocation is timestamped.
- **Priority:** P0 · **Wireframe:** W7 · **Systems:** WhatsApp, Discourse

**8.3** As a **Member**, I want messages from the linked WhatsApp group mirrored into the forum within 60 seconds, so that group knowledge is preserved and searchable. **(AMENDED · v3: mirrored posts enter the auto-labelling pipeline)**
- Given a consented group participant sends a message, When wa-bridge processes it, Then a forum post/reply appears in the designated space in <60s, attributed to the participant's linked pseudonym.
- Given media or unsupported message types, When mirrored, Then either supported content renders or a clean "[unsupported message type]" placeholder appears — never a broken post.
- Given the mirrored post, When it renders, Then it's labeled as mirrored from WhatsApp **and auto-labelled by the 14.3 automation like any other post**.
- **Priority:** P0 · **Wireframe:** W3, W4 · **Systems:** wa-bridge, WhatsApp, Discourse

**8.4** As a **Member**, I want mirroring to apply only to participants who have consented, so that nobody's words are republished without permission (#5). **(AMENDED · v3: revocation cache semantics tightened)**
- Given a group participant who has NOT granted mirroring consent, When they send messages, Then wa-bridge drops them — nothing is posted, stored, or queued.
- Given I revoke mirroring consent in W7, When I next message the group, Then mirroring has stopped for me (no grace-period leakage).
- Given consent state changes, When wa-bridge evaluates a message, Then grants may be served from a short cache (≤60s) but **revocations invalidate the cache immediately** (push or lookup-on-revoke), so the no-grace-period guarantee above holds unconditionally.
- **Priority:** P0 · **Wireframe:** W7 · **Systems:** wa-bridge, Discourse

**8.5** As a **Member**, I want my phone number never to appear on the platform, so that mirroring can't deanonymize me (#5). **(AMENDED · v3: VPS→VM wording per the GCP move)**
- Given any mirrored post, When its content, metadata, and raw HTML are inspected, Then no E.164 number (mine or a quoted participant's) appears; attribution is pseudonym-only.
- Given a message body that itself contains a phone number typed by a user, When mirrored, Then the number pattern is redacted (e.g., `[number removed]`).
- Given wa-bridge logs on the VM, When reviewed, Then numbers are masked in application logs.
- **Priority:** P0 · **Wireframe:** W3, W4 · **Systems:** wa-bridge, WhatsApp

**8.6** As a **Member**, I want WhatsApp notifications for replies and mentions, so that I can stay engaged without checking the site.
- Given verified opt-in with "replies & mentions" scope, When someone replies to my post, Then I receive one templated WhatsApp message with a deep link to the W4 thread.
- Given rapid activity, When notifications queue, Then they are batched/rate-limited (e.g., max 1 per thread per 15 min) to avoid spam.
- Given my notification scope excludes a category in W7, When such events occur, Then no message is sent for them.
- **Priority:** P1 · **Wireframe:** W7, W4 · **Systems:** WhatsApp, Discourse

**8.7** As a **Platform Operator**, I want wa-bridge to be crash-safe and duplicate-safe, so that outages don't corrupt the forum.
- Given wa-bridge restarts mid-stream, When it resumes, Then missed messages within the retention window are mirrored once — no duplicates (dedup on WhatsApp message id) and no re-posting of already-mirrored content.
- Given Discourse is temporarily down, When wa-bridge retries with backoff, Then messages post on recovery in original order.
- Given the bridge is down >5 minutes, When monitoring evaluates, Then Ops receives an alert (see 12.3).
- **Priority:** P1 · **Wireframe:** — (backend) · **Systems:** wa-bridge, WhatsApp, Discourse

---

## Epic 9 — Moderation

**9.1** As a **Moderator**, I want a private review queue listing all flagged items with full context, so that I can triage efficiently. **(AMENDED · v3: chat messages flow into the same queue)**
- Given W9, When it loads, Then items show content excerpt, author pseudonym, community/space **or chat channel**, flag reason(s), notes, flag count, and age — sorted oldest-first by default.
- Given filters, When I filter by reason (e.g., Misleading), community, **or surface (posts / chat)**, Then the list narrows accordingly.
- **Priority:** P0 · **Wireframe:** W9 · **Systems:** Discourse

**9.2** As a **Moderator**, I want to remove a flagged post or comment, so that violating content leaves the community.
- Given a queue item, When I click Remove and confirm, Then the content is hidden platform-wide within 60 seconds (feed, search, community pages) and the URL shows a neutral removed state.
- Given removal, When the author is notified, Then the notice cites the community guideline category but never the flagger's identity (#3).
- Given the action completes, When the queue refreshes, Then the item leaves the pending list.
- **Priority:** P0 · **Wireframe:** W9 · **Systems:** Discourse

**9.3** As a **Moderator**, I want to dismiss unfounded flags, so that good content is cleared quickly.
- Given a queue item, When I click Dismiss, Then the content remains untouched and public, and the item leaves the queue.
- Given a dismissal, When the author checks anything, Then they never learn they were flagged (#3).
- Given the same content is re-flagged later, When it enters the queue, Then the prior dismissal is visible to moderators as context.
- **Priority:** P0 · **Wireframe:** W9 · **Systems:** Discourse

**9.4** As a **Moderator**, I want the queue itself locked to moderator/admin roles, so that flag data never leaks (#3).
- Given a member or maven, When they request the W9 route or its JSON endpoints, Then access is denied.
- Given universal search (W13), When any user searches, Then queue items, flag reasons, and flagger identities are never indexed or returned.
- **Priority:** P0 · **Wireframe:** W9, W13 · **Systems:** Discourse

**9.5** As a **Community Admin**, I want an audit log of moderation actions, so that decisions are reviewable.
- Given any remove/dismiss, When it's executed, Then the log records actor, action, target, reason, and timestamp.
- Given the log, When a moderator (non-admin) views it, Then they see actions but the log is read-only; only admins can export it.
- **Priority:** P1 · **Wireframe:** W9 · **Systems:** Discourse

---

## Epic 10 — Settings & Consent

**10.1** As a **Member**, I want a single consent center showing every consent with status and history, so that I always know what I've agreed to.
- Given W7, When it loads, Then I see current state + last-changed timestamp for: WhatsApp notifications, WhatsApp mirroring, public allocation %, and (mavens) performance publishing.
- Given any consent change from any surface (W7 toggle, STOP reply), When it occurs, Then the consent history updates within 60 seconds.
- **Priority:** P0 · **Wireframe:** W7 · **Systems:** Discourse, wa-bridge, gf-stats

**10.2** As a **Member**, I want to edit my profile basics (avatar, bio, corridor), so that my pseudonymous identity is mine to shape.
- Given W7 profile settings, When I save changes, Then W5/W6 reflect them; bio content passes the same prohibited-claims checks as posts (see 7.6 denylist).
- Given a username change (if enabled), When saved, Then old profile URLs redirect and post attributions update.
- **Priority:** P1 · **Wireframe:** W7, W5, W6 · **Systems:** Discourse

**10.3** As a **Member**, I want per-channel notification preferences (in-app, email, WhatsApp), so that I control volume by channel. **(AMENDED · v3: chat notification scope added)**
- Given W7, When I set replies=in-app-only, Then a reply produces an in-app notification and no email/WhatsApp message.
- Given email digests enabled, When the digest sends via SMTP, Then it contains only content from my joined communities.
- **Given chat (17.5), When I set chat=mentions-only (the default), Then channel chatter never notifies me — only @mentions and DMs do.**
- **Priority:** P1 · **Wireframe:** W7 · **Systems:** Discourse, WhatsApp

**10.4** As a **Member**, I want to export my data and delete my account, so that I keep ownership of my information. **(AMENDED · v3: chat messages included)**
- Given W7, When I request export, Then I receive (via email link) my posts, reactions, consents, **chat messages,** and Ghostfolio activities; the export contains no other members' private data.
- Given account deletion, When confirmed, Then my Discourse account is anonymized **(posts and chat re-attributed to an anonymous handle)**, my Ghostfolio account is deleted by gf-provisioner, my WhatsApp consents are revoked, and my public profile/W6 return 404 within 24 hours.
- **Priority:** P2 · **Wireframe:** W7 · **Systems:** Discourse, gf-provisioner, Ghostfolio, wa-bridge

**10.5** *(NEW · v3 · R4)* As a **Member**, I want liveliness controls — appear-offline and gamification opt-out — so that the lively layer is never surveillance.
- Given W7, When I enable "Appear offline", Then my presence never renders anywhere (no typing indicator, no online dot, no "reading now" inclusion) while my own view of others is unchanged.
- Given W7, When I opt out of gamification (18.1), Then I leave all leaderboards immediately and earn no further public points; my public streak chip and cakeday mark stop rendering too (18.3) — opt-out removes every public activity-pattern signal; badges already earned remain on my profile unless I hide them.
- Given either toggle changes, When recorded, Then the change is timestamped in my settings history and takes effect within 60 seconds.
- **Priority:** P1 · **Wireframe:** W7 · **Systems:** Discourse

---

## Epic 11 — Compliance & Disclaimers

**11.1** As a **Compliance Officer**, I want "educational only — not investment advice" disclaimers on every content surface, so that positioning is unambiguous. **(AMENDED · v3: chat and event surfaces included)**
- Given W1, W3, W4, W6, W14, **W16 (chat), W17 (events), W18 (recognition), and W19 (ticker hubs — the most finance-adjacent v3 surface)**, When each renders (desktop and W12 mobile), Then the disclaimer is visibly present (footer or module-adjacent) without user interaction.
- Given the composer, When a member posts in an investing space, Then a one-line reminder ("share education, not advice") appears above the editor; **chat channels pin the same line in the channel header/about**.
- Given a themed page update, When the leak-sweep/UI test suite runs, Then a missing disclaimer fails the check.
- **Priority:** P0 · **Wireframe:** W1, W3, W4, W6, W14, W16, W17, W18, W19 · **Systems:** Discourse, gf-stats

**11.2** As a **Compliance Officer**, I want the signed-out landing to position DesiSquare strictly as an educational community, so that acquisition copy creates no advisory expectation.
- Given W1, When reviewed, Then copy contains no promises of returns, no "beat the market" language, and describes mavens as educators sharing track records, not advisors.
- Given W1's footer, When rendered, Then terms, privacy policy, and the full disclaimer are linked and reachable while signed out.
- **Priority:** P0 · **Wireframe:** W1 · **Systems:** Discourse

**11.3** As a **Compliance Officer**, I want automated screening of maven-authored content for advisory/solicitation language, so that finfluencer risk is caught early. **(AMENDED · v3: screening extends to chat, events, and poll text)**
- Given the denylist (e.g., "guaranteed", "sure-shot", "DM me to invest", fee/telegram-channel solicitations), When a maven post, bio, **chat message, event description, or poll** matches, Then it is auto-routed to the W9 queue with reason "Misleading/Marketing" before or immediately after publishing.
- Given a moderator reviews such an item, When they act, Then remove/dismiss works as in Epic 9 and the denylist hit is shown as context.
- **Priority:** P1 · **Wireframe:** W9 · **Systems:** Discourse (automation, AI triage)

**11.4** As a **Member**, I want to acknowledge the community's educational-only terms at signup, so that expectations are set contractually.
- Given account creation (W2), When I proceed, Then I must check an explicit acknowledgment ("content here is education, not investment advice") — unchecked blocks signup.
- Given my acceptance, When recorded, Then it's timestamped and versioned (terms v-number) in my account record.
- **Priority:** P1 · **Wireframe:** W2 · **Systems:** Discourse

---

## Epic 12 — Ops & Admin

**12.1** As a **Platform Operator**, I want the full stack deployed on GCP behind TLS, so that the product runs on supported, budgeted infrastructure. **(AMENDED · v3: target moves from single VPS to the 2-VM GCP topology of `deploy/gcp/`)**
- Given a billing-enabled GCP project, When `deploy/gcp/scripts/01–03` and the runbook are executed, Then discourse-1 serves community.<domain> (official Docker install) and apps-1 serves app./folio./wa.<domain> via Caddy with Let's Encrypt TLS, and the three scripts (wa-bridge, gf-provisioner, gf-stats) run as supervised services.
- Given demo mode, When no domain exists, Then sslip.io hostnames with real HTTPS serve the same topology (per `deploy/gcp/CLAUDE.md`), and teardown is one script (`99-teardown.sh`).
- Given certificate renewal, When certs near expiry, Then renewal is automatic and verified by a scheduled check.
- Given the demo dataset load, When monitored, Then steady-state memory fits the VM budget (4 GB discourse-1 / 8 GB apps-1) with swap as a safety net.
- **Priority:** P0 · **Wireframe:** — · **Systems:** All

**12.2** As a **Platform Operator**, I want nightly automated backups with a tested restore path, so that data survives mistakes. **(AMENDED · v3: GCS offsite destination per deploy/gcp)**
- Given the schedule, When the nightly job runs, Then Discourse (DB + uploads), Ghostfolio DB, and script state/consent stores are backed up off-box to GCS with retention lifecycle (per `deploy/gcp/scripts/04-backups.sh`).
- Given the restore drill runbook, When executed against a scratch target, Then the platform restores to a working state and the drill result is logged.
- Given a failed backup, When detected, Then Ops is alerted within the same day.
- **Priority:** P0 · **Wireframe:** — · **Systems:** All

**12.3** As a **Platform Operator**, I want health checks and alerting for every service, so that failures are noticed before members do. **(AMENDED · v3: scheduled-job staleness alerts added)**
- Given health endpoints/heartbeats for Discourse, Ghostfolio, wa-bridge, gf-provisioner, gf-stats, and SMTP, When any is down >5 minutes, Then an alert (email/WhatsApp to Ops) fires.
- Given wa-bridge, When its mirror latency exceeds the 60s SLO over a 15-min window, Then a warning alert fires.
- **Given the v3 scheduled jobs — digest build (15.1), ritual creation (19.2), recap generation (19.5), trending refresh (20.2) — When any fails or the cached public digest is older than 2 hours, Then Ops is alerted; the free landing never serves a stale teaser silently.**
- Given disk >85% or memory pressure, When thresholds trip, Then Ops is alerted.
- **Priority:** P1 · **Wireframe:** — · **Systems:** All

**12.4** As a **Platform Operator**, I want pinned, documented versions with a rehearsed upgrade path, so that upgrades don't silently break the theme, the reskin, or the plugin set. **(AMENDED · v3: the pinned set now includes the liveliness plugins)**
- Given pinned Discourse/Ghostfolio versions **and the pinned plugin list (chat, reactions, gamification, calendar/post-event, automation, AI, data-explorer, topic-voting, follow)**, When I run the upgrade runbook on a staging copy, Then post-upgrade smoke tests (login, post, react, flag, SSO, W6 %-only view, mirror, **chat send, live-pill update, event RSVP, leaderboard render**) pass before production upgrade.
- Given an upgrade breaks the Porcelain Slate theme, the bounded reskin, or a pinned plugin, When smoke tests fail, Then rollback to the previous snapshot completes from backup.
- **Priority:** P1 · **Wireframe:** — · **Systems:** Discourse, Ghostfolio

**12.5** As a **Platform Operator**, I want a leak-sweep CI job that scans public surfaces for privacy violations, so that constraints #3/#4/#5/#7-A/#8/#9 are machine-enforced. **(AMENDED · v3: chat, presence, leaderboard, and event surfaces added to the sweep)**
- Given the sweep, When it runs on every deploy and nightly, Then it crawls signed-out pages (expecting the #7-A boundary: the curated digest may render, but member endpoints 403, teaser cards contain no private-community content, no currency values, no E.164 numbers, and thread deep-links gate), non-owner W6/W14 pages and gf-stats endpoints (expecting zero currency values, #4/#8), recent mirrored posts (expecting zero E.164 patterns, #5), and checks that flag indicators are absent for non-mods (#3).
- **Given the v3 surfaces, When the sweep runs, Then chat endpoints 403 anonymously (17.6), presence/online data never appears in signed-out payloads (16.6), event/calendar endpoints — upcoming-events lists, RSVP/attendee payloads, category calendars — 403 anonymously and no personal ICS-feed URL (which embeds a user API key, Epic 19) appears in any shared surface, leaderboard pages and gamification JSON 403 anonymously (18.1), label/ticker hub pages (`/label/*`) 403 anonymously (20.1), the teaser's `noindex` is present (15.1), and leaderboard/badge/karma payloads (incl. byline chips and the 7.7 credibility strip) contain no % returns or currency (#9, 18.6, 21.3).**
- Given any violation, When detected, Then the pipeline fails/alerts with the offending URL and matched pattern.
- Given a clean run, When it completes, Then a dated pass record is stored for compliance review.
- **Priority:** P0 · **Wireframe:** W1, W6, W14, W16, W17, W18 · **Systems:** gf-stats, wa-bridge, Discourse, Ghostfolio

**12.6** As a **Platform Operator**, I want transactional email to reliably deliver, so that signup verification and digests work.
- Given SMTP configuration with SPF/DKIM/DMARC set for the sending domain, When a verification email sends, Then it arrives to major providers (Gmail/Outlook) in inbox, not spam, in test runs.
- Given SMTP failure, When sends bounce or the queue backs up, Then Ops is alerted and Discourse retries.
- **Priority:** P1 · **Wireframe:** W2 · **Systems:** Discourse

**12.7** As a **Platform Operator**, I want a demo drawer with seeded personas and one-click role switching, so that stakeholder walkthroughs are smooth. **(AMENDED · v3: liveliness showcases added)**
- Given the demo drawer (W11) on the demo instance only, When I pick a persona (visitor, `quiet_lotus`, `nikhil_cfa`, moderator, admin), Then I'm switched into that session and landed on that persona's home surface.
- Given seeded data, When any demo persona browses, Then all constraint showcases work: W6 shows %-only, W9 has queue items, W14 shows a live maven module and an "insufficient history" example.
- **Given the v3 showcases, When I use the drawer, Then I can inject a live chat message (typing indicator → message), trigger a "new posts" live pill, simulate an RSVP, and fire a milestone celebration — each demonstrating an R4 story end-to-end.**
- Given a production-mode flag, When set, Then the demo drawer is fully disabled and unreachable.
- **Priority:** P1 · **Wireframe:** W11 · **Systems:** Discourse, Ghostfolio, gf-stats

---

## Epic 13 — Experiments (A/B Lab)

**13.1** As a **Community Admin**, I want to define an A/B experiment (name, hypothesis, variants, metric, audience %), so that product changes are tested, not guessed.
- Given W10, When I create an experiment (e.g., default sort Popular vs New), Then it saves in Draft with variants, a primary metric, and traffic split, and starts only on explicit launch.
- Given a launched experiment, When members are assigned, Then assignment is sticky per member for the experiment's duration.
- **Priority:** P2 · **Wireframe:** W10 · **Systems:** Discourse

**13.2** As a **Community Admin**, I want guardrails on what can be experimented on, so that compliance and privacy surfaces are never in a test cell. **(AMENDED · v3: liveliness-privacy surfaces added to the blocklist)**
- Given experiment targeting, When I attempt to vary disclaimers, the signed-out gate, flag privacy, consent flows, %-only rendering, **presence visibility, leaderboard scoring inputs, or the teaser's `noindex`/indexability**, Then W10 blocks the configuration with an explanation.
- Given allowed surfaces (sort defaults, copy on non-compliance elements, layout variants, **celebration styles, digest card layouts**), When configured, Then launch proceeds.
- **Priority:** P2 · **Wireframe:** W10 · **Systems:** Discourse

**13.3** As a **Community Admin**, I want per-variant results with sample sizes, so that I can conclude experiments honestly.
- Given a running experiment, When I open its W10 detail, Then I see per-variant exposure counts and the primary metric with dates.
- Given I stop an experiment, When I pick a winner, Then that variant becomes the default for everyone and the experiment archives with its data intact.
- Given tiny samples, When results render, Then a low-sample warning shows rather than implied significance.
- **Priority:** P2 · **Wireframe:** W10 · **Systems:** Discourse

---

## Epic 14 — Labels & Taxonomy *(R2 · carried from v2/F5, deepened)*

> **Discourse mapping:** labels = Discourse **tags**; label sets = **tag groups** (per-category required tag groups, min 1 from a set); automated labelling = **watched-words `tag` action** (core; literal keyword/regex → tag) + **Discourse AI `llm_tagger`/`llm_triage` automations** (semantic proposals from curated sets — needs an LLM key); governance = tag admin (rename, merge, synonyms, staff-only tag groups). *Note (verified Jul 2026): tag creation/tagging rights are gated by `*_allowed_groups` settings (the old min-trust settings were migrated to groups in 3.2); "keyword → tag" is not a stock automation script — watched-words is the native literal path.*

**14.1** As a **Member**, I want to label my conversation when I post, so that it's findable by theme and ticker (R1/R2).
- Given the composer (2.3), When I write, Then a label picker suggests from the space's curated label sets (tag groups) with type-ahead; I can apply up to 5 labels; investing spaces **require at least one** label before Post enables.
- Given my trust level is below the label-creation threshold, When I type an unknown label, Then I can request it (it applies as pending-review) but cannot mint arbitrary new labels — keeping the taxonomy clean.
- Given a labelled post, When it renders anywhere (W3/W4/W13/W15), Then its label chips render and each chip links to the label browse page (14.6).
- **Priority:** P0 · **Wireframe:** W3, W4 (F5) · **Systems:** Discourse (tags, tag groups)

**14.2** As a **Community Admin**, I want curated label sets per space, so that labelling stays consistent and useful. **(AMENDED · v3: `ama` added to the Format set for 19.1)**
- Given tag-group admin, When I define sets (e.g., **Tickers** `nvda, vti, …`; **Themes** `fema, fcnr, 401k, roth, real-estate, insurance`; **Format** `question, guide, discussion, poll, ama`), Then each space declares which sets apply and which are required.
- Given a label rename or merge (e.g., `fcnr-b` → `fcnr`), When executed, Then all existing conversations re-point automatically and old label URLs redirect — no dead links.
- Given synonyms (e.g., `retirement` → `401k`), When a member applies the synonym, Then the canonical label is stored.
- **Priority:** P0 · **Wireframe:** W8, W15 (F5) · **Systems:** Discourse (tag groups, synonyms)

**14.3** As a **Community Admin**, I want **automated labelling** of new conversations, so that coverage doesn't depend on member diligence (R2: "if the tool allows automated labelling — use it").
- Given watched-words `tag` rules (keyword/regex → label: "FCNR" → `fcnr`, "$NVDA"/cashtags → ticker labels), When a matching post is created or mirrored via wa-bridge, Then the label is applied within 60 seconds and marked **auto** in the label metadata (watched-words auto-tag is not retroactive — a backfill job covers historical posts once at rollout).
- Given Discourse AI is configured (LLM key present), When a new conversation has no label, Then the `llm_tagger` automation proposes up to 3 labels from the curated sets **only** (never inventing new ones); proposals auto-apply and are flagged **auto** for review.
- Given the author edits labels afterwards, When they remove an auto label, Then it stays removed (member intent beats automation; the removal is logged for tuning).
- **Priority:** P1 · **Wireframe:** W3, W4 (F5) · **Systems:** Discourse (discourse-automation, Discourse AI triage, watched words), wa-bridge

**14.4** As a **Moderator**, I want to curate labels for effectiveness, so that the taxonomy stays trustworthy (R2: "moderated by the moderator"). **(AMENDED · v3: mislabel signals sourced from 14.3/14.6; label-health reporting made testable)**
- Given any conversation, When I open its label editor, Then I can add/remove labels regardless of author settings, and my change is logged in the moderation audit trail (9.5).
- Given the label-quality view, When I review, Then I see: auto-labels awaiting confirmation, most-used labels, orphaned/near-duplicate labels, and mislabel signals — auto-label removals logged by 14.3 plus label-issue reports filed from the label page (14.6) — with one-click confirm/fix/merge actions.
- Given a junk or abusive label, When I delete it, Then it's removed from all conversations and (optionally) added to a blocked-label list.
- Given label effectiveness metrics, When the monthly cycle runs, Then a label-health report generates (Data Explorer: usage and search click-through per label) and every merge/rename action in the audit log (9.5) links the report entry that motivated it.
- **Priority:** P1 · **Wireframe:** W9 (F5) · **Systems:** Discourse (tag admin, Data Explorer)

**14.5** As a **Member**, I want tickers mentioned as cashtags to become ticker labels automatically, so that ticker search (4.6) is reliable without manual effort. **(AMENDED · v3: cashtag chips link to the 20.1 hub)**
- Given a post containing `$NVDA` (or a configured symbol list match), When published or mirrored, Then the `nvda` ticker label auto-applies (via the 14.3 automation) and the cashtag renders as a tappable chip **linking to the ticker hub (20.1)**.
- Given a false positive (e.g., `$100`), When the pattern is not in the symbol list, Then no label applies — the automation matches known symbols only.
- **Priority:** P1 · **Wireframe:** W3, W4, W13 (F4+F5) · **Systems:** Discourse (automation), wa-bridge

**14.6** As a **Member**, I want a label browse page, so that each label works like a topic hub. **(AMENDED · v3: label-issue reporting closes the 14.4 loop)**
- Given `/label/fema` (Discourse tag page), When it loads, Then all conversations carrying the label list with the standard Popular/New sort (F3) and the space filter.
- Given the page header, When it renders, Then it shows the label description (admin-editable), conversation count, and a Follow-label action that adds label activity to my notifications.
- Given the page's overflow menu, When I choose "Report a label issue" (wrong, missing, or duplicate label — with a short note), Then the report lands in the 14.4 label-quality view — not the flag queue: the five private flag reasons (3.3) stay content-only (#3). Reports are moderator-only and the reporter's identity is never disclosed outside the mod view (#3-equivalent privacy; the leak-sweep 12.5 asserts no reporter data leaks).
- **Priority:** P2 · **Wireframe:** W13, W15 · **Systems:** Discourse (tag pages, tag tracking)

---

## Epic 15 — Public Landing & Summaries *(R3 · carried from v2/F6, deepened)*

> **References:** Reddit's summary-card interface; Discord community "best of" digests. **Discourse mapping:** Hot/Top lists (global + per-category) + **Discourse AI topic summaries** (excerpt fallback). Under login-required, even `/top.json`/`/hot.json` 403 anonymously — which is exactly why the signed-out teaser is served from a **cached digest payload** built by a scheduled job with an admin-scoped API key (API-key JSON requests bypass the login wall by design; everything the job republishes is whitelisted field-by-field). Member-facing weekly digests (15.6) ride the core Activity Summary — scoped to joined communities *because* corridor categories are group-private (core has no "joined categories only" digest toggle; category security is the hard guarantee). Member endpoints stay gated (#7-A).

**15.1** As a **Visitor**, I want the free landing page to show today's popular discussions as Reddit-style summary cards, so that I can see the community's value before joining (R3). **(AMENDED · v3: chat channels added to the structural exclusions)**
- Given the signed-out W1, When it loads, Then below the join module a **"Popular this week"** digest renders: 5–10 cards, each with title, 2–3-sentence summary, space + label chips, engagement counts (reactions/comments), pseudonymous author (+ MAVEN ✓ badge where applicable), and relative age.
- Given the digest source, When it's built, Then only content from **public corridors** is eligible; private/request-gated communities, the review queue, chat channels, **chat-origin promoted transcripts (17.3)**, and anything removed by moderation are structurally excluded (#7-A).
- Given the cards, When rendered signed-out, Then no currency values, no E.164 numbers, and no member emails appear (the leak-sweep of 12.5 crawls this surface), and the page carries `noindex` **unconditionally — asserted by 12.5 on every run; any future SEO opening is a separate story requiring explicit #7-A re-review** (see the open-questions register).
- Given the digest job fails, When the landing renders, Then it falls back to the last good cached digest (with its date) or hides the section — never an error.
- **Priority:** P0 · **Wireframe:** W1 (F6) · **Systems:** Discourse (Top/Hot lists via API, digest job)

**15.2** As a **Member**, I want each popular discussion to carry a short summary, so that skimming works like Reddit's preview + Discord's best-of digest (R3).
- Given a discussion crossing the popularity threshold, When the digest job runs, Then a summary generates via **Discourse AI topic summarization** (whole-thread aware); if AI is unconfigured, the fallback is the first-post excerpt — the card renders either way.
- Given a generated summary, When it's stored, Then it's marked **auto** and a moderator can edit or regenerate it (15.3); edited summaries never regress to auto on the next run.
- Given a summary, When it renders, Then it is ≤280 characters on cards, attributes nothing beyond pseudonyms, and inherits the educational disclaimer of its surface.
- **Priority:** P0 · **Wireframe:** W1, W3, W15 (F6) · **Systems:** Discourse (AI summarization), digest job

**15.3** As a **Moderator**, I want editorial control over what the public teaser shows, so that the free surface is always safe and on-brand.
- Given the digest candidate list, When I review it (a lightweight queue view), Then I can pin, exclude, edit-summary, or reorder items; exclusions persist across regenerations.
- Given a summary containing advisory/solicitation language (7.6 denylist match — "guaranteed returns", ticker pumping), When the job screens it, Then the item is auto-held for moderator review instead of publishing to the public page.
- Given a discussion is removed or its community goes private, When the next digest builds (≤hourly), Then the card disappears from the public landing.
- **Priority:** P0 · **Wireframe:** W1, W9 (F6) · **Systems:** Discourse, digest job

**15.4** As a **Member**, I want the community I choose to show its own popular discussions **with summaries**, so that each group has a skimmable "best of" (R3, extends F3).
- Given W15 for a joined community, When it loads, Then the "Popular in ‹community›" list (5.4) upgrades to summary cards — same card anatomy as 15.1, scoped to that community (per-category Hot/Top).
- Given a community with fewer than 3 popular items, When the section renders, Then it degrades gracefully to plain popular rows (no fabricated "best of").
- Given I'm signed in, When I tap a card, Then I land on the full W4 thread (unlike the signed-out teaser, which routes to the join gate).
- **Priority:** P1 · **Wireframe:** W15 (F6+F3) · **Systems:** Discourse

**15.5** As a **Visitor**, I want teaser cards to route me into joining, so that curiosity converts (the Reddit tease-then-gate pattern).
- Given a signed-out teaser card, When I tap it, Then I get the join/invite modal ("Join DesiSquare to read the full discussion") — never the thread content (#7-A).
- Given I complete signup from that modal, When I land signed-in, Then I'm deep-linked to the discussion that brought me in.
- **Priority:** P1 · **Wireframe:** W1, W2 (F6) · **Systems:** Discourse

**15.6** As a **Member**, I want a weekly "Best of DesiSquare" digest compiled from the top labelled discussions, so that the community's highlights reach me even when I don't visit (the Discord-digest pattern).
- Given the weekly job, When it compiles, Then it selects top discussions per corridor (by engagement), includes their summaries and labels, and delivers via my chosen channels (email digest; WhatsApp **utility only if my consent scope includes digests** — and never marketing-category to US +1 numbers).
- Given digest content, When assembled, Then it reuses the moderator-curated summaries (15.3) — nothing unreviewed ships to external channels.
- **Priority:** P2 · **Wireframe:** W1, W7 (F6) · **Systems:** Discourse, WhatsApp, SMTP

---

## Epic 16 — The Living Feed: Real-Time Presence & Updates *(NEW · v3 · R4)*

> **Discourse mapping:** MessageBus (core) pushes topic-list and post-stream updates live; **presence** (core) powers typing/replying indicators — reply-presence is hard-scoped to logged-in members in core, so #7-A holds by construction; **user status** (core, enable `enable_user_status`) puts an emoji+text status on avatars; online-now signals come from **discourse-whos-online** (official plugin, count-only mode, sized for <100 concurrent — right for the demo scale); the 16.2 "reading now" count is a small theme component on a presence MessageBus channel (count only, no names); **discourse-follow** (official plugin) adds a followed-activity profile feed. Everything here is a **member-only** surface: none of it renders signed-out (#7-A), and 10.5's "appear offline" maps to core's `hide_presence` preference (split from hide-profile in 3.3) and suppresses all of it per member.

**16.1** As a **Member**, I want new discussions to surface in my open feed without a refresh, so that the Square feels alive while I'm in it.
- Given W3 is open, When posts are created in my joined scope, Then a live pill appears at the top ("3 new discussions — tap to see") within 10 seconds, and tapping it prepends the new cards without a full page reload.
- Given the "New" sort is active (2.2), When the pill is tapped, Then the new posts appear at the exact top; given "Popular", Then they slot by rank (the pill never force-reorders what I'm reading).
- Given I'm mid-scroll, When updates arrive, Then my scroll position never jumps — liveliness never yanks the page.
- **Priority:** P0 · **Wireframe:** W3 · **Systems:** Discourse (MessageBus)

**16.2** As a **Member**, I want an open thread to stream new comments in real time, so that busy discussions read like a live room.
- Given W4 is open, When another member posts a comment, Then it appears in-thread within 10 seconds with a subtle entrance highlight, without reload.
- Given a comment I'm reading is edited or removed by moderation, When the change lands, Then the thread updates in place (edit marker / neutral removed state).
- Given at least 20 members (admin-configurable threshold) have the thread open, When the header renders, Then a count-only "n reading now" indicator shows (no names, no avatars; #7-A keeps this member-only).
- **Priority:** P1 · **Wireframe:** W4 · **Systems:** Discourse (MessageBus, presence)

**16.3** As a **Member**, I want to see when someone is composing a reply, so that I wait for an answer instead of leaving.
- Given W4 with an active composer elsewhere, When another member is typing a reply, Then "quiet_lotus is replying…" renders under the last comment (pseudonym only), disappearing when they stop.
- Given multiple writers, When more than 2 are typing, Then the indicator collapses to "3 people are replying…".
- Given a member with "appear offline" (10.5), When they type, Then no indicator renders for them — ever.
- **Priority:** P1 · **Wireframe:** W4 · **Systems:** Discourse (presence)

**16.4** As a **Member**, I want to set a lightweight status — emoji + short text — so that context travels with my pseudonym.
- Given W7 or my avatar menu, When I set status (e.g., 🪔 "earnings week — heads down"), Then it renders beside my pseudonym in feed, thread, chat, and profile surfaces, with an optional auto-clear time.
- Given status text, When saved, Then it passes the same denylist screening as bios (7.6) and length-caps at 60 characters.
- Given signed-out surfaces, When the teaser renders, Then statuses never appear there (#7-A).
- **Priority:** P2 · **Wireframe:** W3, W4, W5, W6, W7, W16 · **Systems:** Discourse (user status)

**16.5** As a **Member**, I want engagement counts to tick live on what I'm looking at, so that momentum is visible as it happens.
- Given a W3/W4 card in view, When engagement lands — reactions, comments, poll votes (18.4), RSVP counts (19.1) — Then the counts update in place within 10 seconds with a subtle tick animation (no layout shift).
- Given a count updates, When I have already reacted, Then my own highlighted state is preserved through the update.
- Given heavy activity, When updates exceed 1/second, Then updates batch (≤1 render/2s per card) so the UI never flickers.
- **Priority:** P1 · **Wireframe:** W3, W4 · **Systems:** Discourse (MessageBus)

**16.6** As a **Compliance Officer**, I want every presence surface gated to members and suppressible per member, so that liveliness never becomes surveillance or a gate leak (#7-A).
- Given any signed-out request (pages or JSON), When inspected by the leak-sweep (12.5), Then zero presence, typing, online-count, or "reading now" data appears in any payload.
- Given a member enables "appear offline" (10.5), When any presence surface is checked, Then they are absent from all of them within 60 seconds.
- Given presence data in member-visible payloads, When inspected, Then it contains pseudonyms only — never emails, real names, or device/location hints.
- **Priority:** P0 · **Wireframe:** W3, W4, W16 · **Systems:** Discourse, leak-sweep CI

**16.7** As a **Member**, I want to follow specific members and mavens, so that their new discussions reach me without hunting.
- Given a profile (W6/W14), When I tap Follow, Then their new posts appear in a "Following" feed filter on W3 and (per my 10.3 scopes) notify me.
- Given a maven I follow schedules an AMA (19.1), When it's published, Then I'm notified with the event card.
- Given follows, When anyone views my profile, Then my follower/following lists are private by default (pseudonymous culture — no social-graph mining).
- **Priority:** P2 · **Wireframe:** W3, W6, W14 · **Systems:** Discourse (discourse-follow)

---

## Epic 17 — Squares Chat *(NEW · v3 · R4)*

> **Discourse mapping:** **Discourse Chat** (core since 3.0): public channels are category-backed (one Square per corridor category — channel visibility inherits category security), threads (per-channel opt-in), DMs/group DMs, quote-to-topic **transcripts** (`Chat::TranscriptService` renders selected messages as a styled transcript in a topic — the native mechanic behind 17.3's "Continue as discussion"). Access is group-gated via `chat_allowed_groups`. Retention is set deliberately: channel messages default to 90-day auto-delete (right for "chat is ephemeral, the forum is durable"); DM retention documented in the privacy policy. Chat is the "Discord energy" surface; the forum stays the durable knowledge base — and 17.3 is the bridge between the two. **Scope decision (R1/R2):** chat is deliberately outside universal search (W13) and tag labelling — Discourse tags don't apply to chat messages; native in-channel chat search covers the ephemeral layer (17.1), and anything worth finding forever gets promoted into a labelled topic (17.3). Chat never renders signed-out (#7-A) and chat *surfaces* are excluded from the public digest and WhatsApp mirroring (#5 scope stays forum-only); promoted transcripts are forum content but stay off the signed-out teaser (15.1, 17.3).

**17.1** As a **Member**, I want a live chat Square per corridor community, so that quick back-and-forth has a home that isn't the feed.
- Given my joined corridor (e.g., US), When I open W16 (chat dock or full-page), Then its Square channel renders with live messages, member count, and the pinned "education, not advice" line (11.1).
- Given I join/leave a community (5.2), When membership changes, Then the corresponding Square appears/disappears from my channel list within 60 seconds.
- Given a private/request-gated community, When its Square exists, Then only approved members see the channel — it never appears in any non-member's channel list (#3-adjacent privacy).
- Given native in-channel chat search, When I search a channel, Then results are member-only and scoped to channels I can access; chat messages carry no labels and stay out of W13 universal search — the labelled, searchable, durable path is promotion (17.3).
- **Priority:** P0 · **Wireframe:** W16 · **Systems:** Discourse Chat

**17.2** As a **Member**, I want threads inside busy channels, so that a fast Square stays followable.
- Given a channel message, When I reply in-thread, Then the side thread collects the sub-conversation and the channel shows a compact "n replies" affordance.
- Given a thread I participated in, When new replies land, Then I'm notified per my chat scope (17.5), not for the whole channel.
- **Priority:** P1 · **Wireframe:** W16 · **Systems:** Discourse Chat (threads)

**17.3** As a **Member**, I want to promote a good chat exchange into a labelled discussion, so that chat sparkle becomes durable, searchable knowledge (the anti-Discord-amnesia move).
- Given a run of chat messages, When I (or a moderator) select them and tap "Continue as discussion", Then a new W4 topic is created in a chosen space with a quoted transcript (pseudonym-attributed), a back-link in the channel, and the composer's required label picker (14.1).
- Given the created topic, When it publishes, Then it enters search (R1), the feed, and — if it earns engagement — the **member-facing** digests (15.4, 15.6); it is structurally excluded from the signed-out public teaser (15.1), because chat participants spoke on a members-only surface.
- Given any participant whose messages are quoted, When the topic publishes, Then each quoted participant is notified ("your chat messages were quoted into a discussion") with a remove-my-messages request affordance (moderator-reviewed), attribution is pseudonym-only, and E.164/emails never appear (#5-grade hygiene applies to transcripts).
- **Priority:** P0 · **Wireframe:** W16 → W4 · **Systems:** Discourse Chat (quote/transcript), Discourse

**17.4** As a **Moderator**, I want chat-native moderation tools, so that fast surfaces stay safe at speed.
- Given a problem channel moment, When I freeze the channel (read-only/closed status) or tighten the per-trust-level chat rate limits, Then posting pauses or slows with a visible notice, without deleting history. *(Core chat has no per-channel slow mode as of mid-2026 — pacing = channel status + `chat_allowed_messages_for_*` rate limits.)*
- Given a flagged chat message (same 5 private reasons, #3), When it's flagged, Then it enters the W9 queue (9.1) with channel context, and removal hides it in-channel within 60 seconds leaving a neutral tombstone.
- Given the denylist (11.3), When a chat message matches, Then it auto-routes to W9 exactly like a post.
- **Priority:** P1 · **Wireframe:** W16, W9 · **Systems:** Discourse Chat, Discourse (automation)

**17.5** As a **Member**, I want chat notifications scoped to mentions and DMs by default, so that a lively Square never becomes notification spam.
- Given default settings, When channel chatter flows, Then I get zero notifications; only @mentions, thread replies I follow, and DMs notify (in-app; other channels per 10.3).
- Given W7 chat preferences, When I mute a channel or set quiet hours, Then those are honored across devices.
- Given WhatsApp (Epic 8), When chat events occur, Then **no chat content is ever sent to WhatsApp** — chat stays on-platform (consent scope of #5 covers the forum mirror only).
- **Priority:** P1 · **Wireframe:** W7, W16 · **Systems:** Discourse Chat, Discourse

**17.6** As a **Compliance Officer**, I want chat fully inside the privacy envelope, so that the fastest surface is as safe as the slowest.
- Given signed-out state, When any chat page or `/chat/…` endpoint is requested, Then 403/redirect with zero payload (#7-A); the leak-sweep (12.5) asserts this on every run.
- Given chat exports or transcripts (17.3), When generated, Then they contain pseudonyms only.
- Given DMs, When any non-participant (including moderators, absent a formal escalation with audit trail) requests them, Then access is denied — DMs are not a moderation browse surface.
- **Priority:** P0 · **Wireframe:** W16 · **Systems:** Discourse Chat, leak-sweep CI

---

## Epic 18 — Recognition & Playfulness *(NEW · v3 · R4)*

> **Discourse mapping:** **Gamification** (core-bundled mid-2025; leaderboards over engagement scoring — every scorable event is an engagement action; no financial field exists in the scoring model, so #9 holds structurally), core **badge system** (custom desi-themed ladder via badge SQL — `enable_badge_sql`, a self-hosted freedom), native **poll builder** (`poll_default_public` flipped to false so polls are anonymous-by-default for pseudonymity; note: editing a poll after the 5-min grace window clears votes — moderators know this), **topic-voting** (core-bundled Jul 2025, per-category). Per-user leaderboard opt-out (10.5) is implemented the native way: a self-joinable "hide me from leaderboards" group wired into every leaderboard's excluded-groups list (gamification has no per-user toggle). Bounded hard by **#9**: recognition ranks engagement, never money — no surface may rank members by returns, and gamification signals never borrow gf-stats data.

**18.1** As a **Member**, I want an engagement leaderboard for my corridor, so that showing up for the community is visible and fun (#9). **(AMENDED · v3+R5: ranks by karma)**
- Given W18, When it loads, Then Weekly / Monthly / All-time leaderboards rank members by **karma** (Epic 21 scoring: pill-weighted reactions, accepted answers — engagement only), with tier chips and the scoring legend — never by portfolio data (#9).
- Given the scoring config, When an admin edits weights, Then gf-stats fields are structurally unavailable as inputs (the scoring source list simply doesn't include them).
- Given my row, When I view the board, Then I see my rank, points breakdown, and trend; given 10.5 opt-out, Then I'm absent and see a quiet "you're opted out" note where my row would be.
- Given the board renders, When inspected, Then no % returns, no currency, no E.164 (leak-sweep 12.5 covers the payload; #9).
- Given a signed-out request, When any W18 page or gamification JSON endpoint is fetched, Then 403/redirect (#7-A) — asserted by the leak-sweep (12.5).
- **Priority:** P1 · **Wireframe:** W18 · **Systems:** Discourse (discourse-gamification)

**18.2** As a **Member**, I want a desi-themed badge ladder, so that milestones feel like ours, not generic forum trophies.
- Given the badge set (e.g., **First Diya** first post · **Neighbourly** 10 Helpfuls given · **Straight Answer** first accepted answer · **Square Pillar** 52 active weeks · **Bridge Builder** first promoted chat discussion (17.3)), When I earn one, Then a non-blocking toast celebrates it and the badge lands on my W5/W6 profile.
- Given badge criteria, When defined, Then they derive from participation events only — no badge references portfolio performance (#9), and none can be bought.
- Given my profile, When badges render, Then each shows its earn-date and criteria on tap; I can feature up to 3.
- **Priority:** P1 · **Wireframe:** W5, W6, W18 · **Systems:** Discourse (badges)

**18.3** As a **Member**, I want small celebration moments — first post confetti, streaks, cakeday — so that participation feels rewarded in the moment.
- Given my first-ever post publishes, When the success state renders, Then a one-time confetti micro-moment plays (≤2s, respects `prefers-reduced-motion`, never blocks the UI).
- Given a posting/answering streak (e.g., 7 active days), When it advances, Then a subtle streak chip updates on my profile; a missed day resets quietly — no guilt messaging, no push nagging.
- Given my join anniversary, When I post that day, Then a small cakeday mark renders by my pseudonym for the day.
- **Priority:** P2 · **Wireframe:** W3, W5, W18 · **Systems:** Discourse (gamification, cakeday)

**18.4** As a **Member**, I want to attach a poll to a discussion, so that the community's pulse is one tap away.
- Given the composer, When I insert a poll (single/multiple choice, optional close time, results on-vote/on-close), Then members vote in place and the bar chart updates live (16.5) without reload.
- Given an investing-space poll (e.g., "Which corridor topic should the next AMA cover?"), When it's created, Then poll text passes the denylist screen (11.3) and the card carries the educational disclaimer; **polls asking for buy/sell calls on a security are blocked with an explanatory message** (poll templates steer to educational framings).
- Given poll results, When rendered, Then voter identity follows the poll's declared visibility (public list of pseudonyms or anonymous count) — declared before voting, never changed after.
- **Priority:** P0 · **Wireframe:** W3, W4 · **Systems:** Discourse (native polls)

**18.5** As a **Member**, I want to vote on community-roadmap ideas, so that the Square's evolution is community-steered.
- Given the "Ideas for the Square" space, When I open a proposal topic, Then a Vote button shows the running count; my limited vote pool (topic-voting mechanics) makes votes meaningful.
- Given an admin marks a proposal Planned/Done, When the status changes, Then voters are notified and completed items release votes back to their pool.
- **Priority:** P2 · **Wireframe:** W15 · **Systems:** Discourse (discourse-topic-voting)

**18.6** As a **Compliance Officer**, I want gamification hard-bounded away from money signals, so that playfulness never becomes a performance claim (#9).
- Given all recognition surfaces (leaderboards, badges, streaks, celebration copy), When audited, Then none rank, score, or celebrate portfolio returns, and none use gf-stats data as input — engagement signals only.
- Given the leaderboard/badge JSON payloads, When the leak-sweep (12.5) runs, Then zero currency values and zero % return figures appear.
- Given celebration/leaderboard copy, When reviewed, Then it celebrates participation ("most helpful this week"), never money ("top performer" is banned phrasing — it's on the denylist).
- **Priority:** P0 · **Wireframe:** W18 · **Systems:** Discourse, leak-sweep CI

---

## Epic 19 — Live Events & AMAs *(NEW · v3 · R4)*

> **Discourse mapping:** **Discourse Calendar & Events** (core-bundled since 3.5; enable `calendar_enabled` + `discourse_post_event_enabled`): events live inside topics (event block in the first post; RSVP going/interested; up to 5 reminders; ICS; timezone-aware rendering), with an upcoming-events list and category calendars — plus **RSVP-driven event chat channels** (May 2025): members who RSVP are auto-added to a private chat channel for the event. Ritual topics (19.2) are created on schedule via Automation's recurring trigger where the stock scripts fit, else by the digest-job's API-key pattern (the stock topic-posting script posts into an *existing* topic). Privacy notes: personal ICS feed URLs embed a user API key — treated as secrets, regenerable; `bumpTopic` reminders bump publicly within category visibility, so member-only reminder types are the default. Events are member-only surfaces; event titles may appear in the public digest only if their topic independently qualifies (15.1 rules).

**19.1** As a **Maven**, I want to schedule an AMA as an event topic, so that the community gets appointment-to-gather moments.
- Given event creation in an investing space, When I publish "AMA: 401k rollovers for H-1B holders — Thu 8pm ET", Then the topic carries an event card (date/time in each viewer's timezone, RSVP going/interested, add-to-calendar ICS) and the `ama` label (14.2's Format set).
- Given RSVPs, When members respond, Then the going/interested counts update live (16.5) and I can see the pseudonymous attendee list.
- Given event chat integration is enabled, When a member RSVPs Going/Interested, Then they're auto-added to the AMA's private chat channel (17.1 mechanics) — the live room for the hour, quoted into the recap afterwards (19.5).
- Given the AMA goes live, When start time hits, Then the topic pins to the top of its community feed for the duration and RSVPed members get an in-app "starting now" nudge.
- Given AMA copy, When published, Then the denylist screen (11.3) has passed and the event card carries the educational disclaimer (11.1) — an AMA is education, never a pitch.
- **Priority:** P0 · **Wireframe:** W17 · **Systems:** Discourse (post-event, calendar)

**19.2** As a **Community Admin**, I want recurring community rituals created automatically, so that the Square has a heartbeat without manual posting.
- Given automation schedules (discourse-automation), When Monday 9:00 corridor time arrives, Then "📈 US Market Week — what are you watching?" auto-creates in the right space, labelled (`weekly-watch`), with a fresh sentiment poll (18.4) attached.
- Given a ritual topic, When the next one auto-creates, Then the previous auto-closes with a link forward (no zombie threads).
- Given ritual cadence, When an admin edits or pauses a ritual, Then changes apply from the next occurrence — no retroactive edits to live threads.
- **Priority:** P1 · **Wireframe:** W3, W17 · **Systems:** Discourse (automation)

**19.3** As a **Member**, I want to discover upcoming events in one place, so that I never miss my corridor's moments.
- Given W17 (events view) or the W3 right rail, When rendered, Then upcoming events for my joined communities list chronologically with RSVP states; a community calendar view shows the month.
- Given an event I RSVPed to, When it's <24h away, Then I get one reminder through my chosen channels (10.3) — never more than one per event per channel.
- Given a cancelled/rescheduled event, When it changes, Then RSVPed members are notified and the ICS updates (no stale calendar entries).
- **Priority:** P1 · **Wireframe:** W17, W3 · **Systems:** Discourse (calendar)

**19.4** As a **Member**, I want event reminders on WhatsApp if — and only if — my consent scope includes them, so that reminders help without violating #5.
- Given my W7 WhatsApp scope includes "event reminders", When my RSVP'd event is <24h away, Then one utility-template message sends with the event title and deep link — never marketing-category, never to US +1 numbers in a paused category (Epic 8 rules).
- Given my scope excludes events (default), When reminders fire, Then WhatsApp stays silent for me (in-app/email only per 10.3).
- **Priority:** P2 · **Wireframe:** W7, W17 · **Systems:** WhatsApp, Discourse

**19.5** As a **Member**, I want an after-event recap on the AMA thread, so that the event's value outlives the hour.
- Given an AMA ends, When the recap job runs, Then a Discourse-AI summary of the thread posts as a pinned recap comment (marked **auto**, moderator-editable per 15.3 rules), and the topic's labels make it findable (R1).
- Given the recap qualifies for digests, When the weekly best-of (15.6) compiles, Then the AMA recap is eligible content with its summary reused (nothing re-generated unreviewed).
- **Priority:** P1 · **Wireframe:** W17, W4 · **Systems:** Discourse (AI summarization), digest job

---

## Epic 20 — Market Pulse: Ticker Hubs & Trending *(NEW · v3 · R1+R4)*

> **Discourse mapping:** ticker labels (14.5) make tag pages into **ticker hubs**; Data Explorer + a small scheduled job compute **trending tickers by discussion velocity** (tag-usage deltas); cashtag chips (14.5) deep-link everywhere. Hubs are member-only; the landing strip (20.4) exposes **counts only** — no prices, no member data. This epic is discussion-liveliness about markets, never market advice: no buy/sell signals, no price targets, and member portfolio data stays out entirely (#4/#8).

**20.1** As a **Member**, I want a ticker hub per labelled security, so that `$NVDA` is a place, not just a search query (R1).
- Given `/label/nvda` (the tag page, upgraded), When it loads, Then I see: the ticker header ("$NVDA · NVIDIA"), discussion count + this-week velocity, Popular/New sorted labelled discussions (F3 pattern), and a Follow-ticker action (14.6 mechanics).
- Given the hub of a ticker with recent AMA/event content, When it renders, Then those appear in a "moments" strip (events, promoted chat discussions) above the list.
- Given any hub, When inspected, Then it contains zero member portfolio data — no "members holding this", no allocation aggregates (#4/#8: gf-stats never feeds hub surfaces).
- Given a signed-out request for any hub or label page (`/label/*`), When fetched, Then 403/redirect to W1 (#7-A) — tag pages are member-only even though vanilla Discourse serves them publicly; the leak-sweep (12.5) crawls them anonymously.
- **Priority:** P0 · **Wireframe:** W19 · **Systems:** Discourse (tag pages), automation

**20.2** As a **Member**, I want a trending-tickers rail, so that I can see where the community's attention is moving right now.
- Given W3's right rail (and W13's empty state, 4.5), When rendered, Then the top 5 tickers by labelled-discussion velocity (this week vs trailing average, via Data Explorer job) list with discussion counts and sparkline of weekly discussion volume — **counts of conversations, never prices or returns**.
- Given a trending ticker chip, When tapped, Then I land on its hub (20.1).
- Given thin data (fewer than 3 tickers with meaningful velocity), When the rail renders, Then it degrades to "most-discussed all-time" with honest labelling — no fabricated trends.
- **Priority:** P1 · **Wireframe:** W3, W13, W19 · **Systems:** Discourse (Data Explorer, automation)

**20.3** As a **Member**, I want cashtags rendered as live chips everywhere text appears, so that every mention is a doorway (extends 14.5).
- Given `$NVDA` in a post, comment, chat message (W16), or summary card, When it renders, Then it's a tappable chip linking to the hub (20.1) — same behavior on mobile (W12).
- Given a cashtag in chat that matches no known symbol, When rendered, Then it stays plain text (no dead-link chips).
- **Priority:** P1 · **Wireframe:** W3, W4, W16, W19 · **Systems:** Discourse (automation, chat)

**20.4** As a **Visitor**, I want the free landing to show which tickers the community is discussing most, so that the Square's pulse is visible from outside (amends 15.1's digest).
- Given the signed-out W1 digest, When it renders, Then a "Talked about this week" strip shows the top ticker labels with **discussion counts only** — no prices, no member data, no thread content beyond what 15.1 cards already allow (#7-A).
- Given the strip's chips, When tapped signed-out, Then they route to the join gate (15.5 pattern), never to hub content.
- Given the leak-sweep (12.5), When it crawls the strip, Then the payload contains only label names + counts.
- **Priority:** P1 · **Wireframe:** W1 (F6) · **Systems:** digest job, Discourse

**20.5** As a **Member**, I want optional delayed market context on a ticker hub, so that discussion sits next to basic facts (honest-states rules apply).
- Given the hub (20.1) with market data configured (Ghostfolio's public market-data provider, delayed), When it renders, Then a small context line shows last close and day % change with "delayed data" labelling — public market facts, not member data.
- Given the provider errors or staleness exceeds threshold, When the hub renders, Then the context line hides entirely (fail closed, 7.3 pattern) — discussions render regardless.
- Given compliance review, When the context line ships, Then it links no trading venue and carries no buy/sell affordance (educational positioning, 11.2).
- **Priority:** P2 · **Wireframe:** W19 · **Systems:** Ghostfolio (market data), Discourse

---

## Epic 21 — Karma & Tiers *(NEW · v3 · R5 — carried from the parallel karma build)*

> **Origin:** built and browser-verified in the parallel session (its "Epic 16 / W17 / Stage 8C / F7"); carried into v3 as **R5** with numbering remapped (their W17 karma page ≡ **W18** here; their runbook Stage 8C is ported to `docs/runbooks/demo-install-01-discourse.md`). **Discourse mapping:** karma = Gamification scoring (core-bundled): uniform like-points natively, with per-pill differential weights applied by a small scheduled scoring query; per-space **accepted answers** via the Solved plugin (core-bundled, enabled per investing space); **tier badges via scheduled badge queries** (badge SQL); byline karma chips and the credibility strip are theme components. Bounded by **#9** — karma is engagement-only, structurally blind to gf-stats.
>
> **Weights (v1, confirmed pending client sign-off):** Actionable **+3** · Helpful **+3** · Insightful **+2** · Like **+1** · Accepted answer **+5** · Flag upheld against your content **−5**. Rationale: practically useful answers outrank merely interesting ones. Weights live in one config table; every change must be dated on the transparency page (21.7) — never silent.

**21.1** As a **Member**, I want to earn karma from the community's structured feedback on my contributions, so that sustained helpfulness becomes visible reputation.
- Given the weights table above, When my post/comment receives a pill reaction or an accepted answer, Then my karma increases by the configured weight within one scoring cycle (≤15 min), and removals/undos reverse it symmetrically.
- Given my content is removed by moderation (9.2), When the removal lands, Then all karma that content earned is reversed (21.6).
- Given the weights change, When the new table takes effect, Then historical karma is recomputed only if the change explicitly says so, and the transparency page (21.7) records the dated change either way.
- **Priority:** P0 · **Wireframe:** W3, W4, W18 · **Systems:** Discourse (gamification, Solved, scheduled scoring query)

**21.2** As a **Compliance Officer**, I want anti-gaming rules enforced on karma earning, so that reputation can't be manufactured.
- Given my own content, When I attempt to react to it, Then no reaction is possible (native) and no karma accrues from self-actions.
- Given a day cap (e.g., 50 reaction-karma/day per earner), When the cap is reached, Then further same-day reactions still render socially but accrue no karma, with no public indication of the cap state.
- Given a reciprocal-reaction ring (A⇄B high-frequency mutual reactions) or sockpuppet pattern, When the scheduled detection query flags it, Then a W9-adjacent mod report is created and confirmed rings forfeit the gamed karma (logged in 9.5).
- **Priority:** P0 · **Wireframe:** W9, W18 · **Systems:** Discourse (rate limits, Data Explorer detection query)

**21.3** As a **Member**, I want karma visible wherever people appear — a byline chip with an explainer, so that reputation context travels with every contribution.
- Given any byline (W3 feed cards, W4 threads, W13 results, W16 chat), When it renders, Then a karma chip ("▲ 2.8k") appears with a tooltip explaining what karma is and linking to the transparency page (21.7).
- Given a profile result in W13 Profiles, When it renders, Then the member's **tier chip** (21.4) renders beside the pseudonym.
- Given any karma surface, When inspected, Then it shows engagement-derived numbers only — never % returns, never currency (#9; leak-sweep 12.5 covers karma payloads).
- **Priority:** P1 · **Wireframe:** W3, W4, W13, W18 · **Systems:** Discourse (theme component)

**21.4** As a **Member**, I want karma tiers with small unlocks, so that reputation opens doors instead of just counting up.
- Given the tier ladder (New Arrival 0 · Regular 100 · Trusted 500 · Anchor 2,000 · Luminary 10,000), When I cross a threshold, Then the tier badge is granted by the scheduled badge query within a day and a quiet toast celebrates it (18.3 style).
- Given tier-gated abilities (e.g., Regular: request new labels 14.1; Trusted: propose events 19.1-adjacent; Anchor: label-curation suggestions), When my tier changes, Then the unlock applies via the corresponding group membership within the same cycle.
- Given tiers, When any surface renders them, Then tier names never imply financial standing or advice quality (#9; 7.6 denylist applies to tier copy).
- **Priority:** P2 · **Wireframe:** W18, W5, W6 · **Systems:** Discourse (badge SQL, groups)

**21.5** As a **Member**, I want a "Top contributors" rail on the feed — by karma, never by returns, so that the community's helpers are celebrated in plain sight (#9).
- Given the W3 right rail, When it renders, Then "Top contributors — by karma, never by returns" lists the top 5 with tier chips and karma deltas for the week, plus a one-line scoring legend linking to 21.7.
- Given the full W18 leaderboard (18.1), When it renders, Then it ranks by karma using the same scoring source, with the same #9 banner.
- Given a member who opted out (10.5), When either surface renders, Then they are absent from both.
- **Priority:** P1 · **Wireframe:** W3, W18 · **Systems:** Discourse (gamification)

**21.6** As a **Moderator**, I want moderation outcomes to feed karma — the "karma effects" hook W9 parked in Phase 2, so that reputation reflects conduct, not just popularity.
- Given a flag I uphold (content removed, 9.2), When the action completes, Then the author's karma reverses that content's earnings and applies the −5 upheld-flag weight, and the effect is logged in the audit trail (9.5) — the flagger's identity stays private (#3).
- Given a flag I dismiss (9.3), When the action completes, Then the author's karma is untouched (dismissals are karma-neutral by design).
- Given repeated upheld violations (e.g., 3 in 30 days), When the threshold trips, Then a temporary karma freeze applies (earning paused, chip unchanged) and the case is queued for admin review — no public shaming surface exists.
- **Priority:** P1 · **Wireframe:** W9, W18 · **Systems:** Discourse (gamification, review queue)

**21.7** As a **Member**, I want a "How karma works" transparency page, so that reputation rules are public, stable, and changes are accountable.
- Given the page (linked from every karma chip tooltip and the W18 legend), When it renders, Then it shows the full weights table, the tier ladder, the anti-gaming rules in plain language, and the #9 statement ("karma measures engagement, never money").
- Given any weight or rule change, When it ships, Then the page's **changelog appends a dated entry** (what changed, why, effective date) — silent changes are a spec violation and the leak-sweep-adjacent config test fails the deploy.
- Given a signed-out visitor, When the landing links "how karma works", Then a static copy renders with zero member data (#7-A: no names, no scores — rules only).
- **Priority:** P1 · **Wireframe:** W18, W1 · **Systems:** Discourse, digest job (static copy)

---

## Story-Count Summary

| # | Epic | P0 | P1 | P2 | Total |
|---|---|---|---|---|---|
| 1 | Onboarding & Access | 5 | 2 | 0 | 7 |
| 2 | Feed & Posting | 4 | 2 | 0 | 6 |
| 3 | Reactions & Flagging | 4 | 1 | 0 | 5 |
| 4 | Search & Discovery *(R1 ticker/label)* | 5 | 2 | 1 | 8 |
| 5 | Communities & Corridors | 3 | 2 | 0 | 5 |
| 6 | Portfolio & Privacy *(+6.7 NEW — member gains toggle)* | 6 | 1 | 0 | 7 |
| 7 | Maven Trust & Performance Proof *(+7.7 NEW · R5)* | 5 | 2 | 0 | 7 |
| 8 | WhatsApp Integration | 5 | 2 | 0 | 7 |
| 9 | Moderation | 4 | 1 | 0 | 5 |
| 10 | Settings & Consent *(+10.5 NEW)* | 1 | 3 | 1 | 5 |
| 11 | Compliance & Disclaimers | 2 | 2 | 0 | 4 |
| 12 | Ops & Admin | 3 | 4 | 0 | 7 |
| 13 | Experiments (A/B Lab) | 0 | 0 | 3 | 3 |
| 14 | Labels & Taxonomy *(R2)* | 2 | 3 | 1 | 6 |
| 15 | Public Landing & Summaries *(R3)* | 3 | 2 | 1 | 6 |
| 16 | **The Living Feed (NEW · R4)** | 2 | 3 | 2 | 7 |
| 17 | **Squares Chat (NEW · R4)** | 3 | 3 | 0 | 6 |
| 18 | **Recognition & Playfulness (NEW · R4)** | 2 | 2 | 2 | 6 |
| 19 | **Live Events & AMAs (NEW · R4)** | 1 | 3 | 1 | 5 |
| 20 | **Market Pulse (NEW · R1+R4)** | 1 | 3 | 1 | 5 |
| 21 | **Karma & Tiers (NEW · R5)** | 2 | 4 | 1 | 7 |
| | **Total** | **63** | **47** | **14** | **124** |

**Reading guide:** P0 = the v3 demo cannot ship without it (every story whose *primary purpose* is enforcing a constraint — #3, #4, #5, #7-A, #8, #9 — is P0; stories that merely operate within a constraint may be P1/P2; plus the marquee moment of each new epic). P1 = strongly expected for a credible "Living Square" demo. P2 = stretch. Every story is testable as written; the leak-sweep CI (12.5) is the automated backstop for all six privacy/compliance constraints, and the demo drawer (12.7) is how stakeholders exercise the corpus end-to-end — now including the liveliness showcases.

**v3 karma increment (20 Jul 2026, later same day):** +8 stories (115 → 123). **R5** carries the parallel session's karma build into v3: **Epic 21 — Karma & Tiers** (weighted earning Actionable/Helpful +3 > Insightful +2 > Like +1 · accepted answer +5 · upheld flag −5, pending client confirmation; anti-gaming: no self-reactions, day caps, ring detection; byline chips; tier ladder with unlocks; "Top contributors — by karma, never by returns" rail; moderator karma effects — the hook W9 parked in Phase 2; dated-changelog transparency page), **7.7** five-signal maven credibility strip (only the proof signal reacts to the 7.4 consent toggle), and **18.1 amended** to rank by karma. Numbering remap from the parallel session: their Epic 16 → our Epic 21; their W17 karma page → our W18; their Stage 8C → ported into runbook 01. Karma is #9-bounded end-to-end and its payloads join the 12.5 leak-sweep.

**v3 Phase-1-integration increment (20 Jul 2026):** +1 story (123 → 124). Grounded in the actual v1/v2 codebases (`kalilurrahman/DesiSquare`, `DesiSquareV2` — the runnable `phase1-mvp` and the v2 `desisquare-app` + `services/models-service` percent-only engine, now integrated into this repo under `app/` and `services/`) and the client's Phase-1 feedback + Omkara reference deck. **6.7 (NEW, P0)** lets *any member* make portfolio **gains** visible/private — percent-only, **Monthly/Yearly/Overall**, never dollars — resolving open question #4; **7.1 amended** (maven proof is the Ghostfolio-*verified* superset of 6.7); **7.2 amended** to require the **Monthly/Yearly/Overall** breakdown explicitly and restate "only his asset value must never be visible." The models-service equity series is a percent index by construction (indexed to 100 at inception), so #8's "no currency reaches a non-owner" holds at the engine level, not just the view.

**v3 changelog (20 Jul 2026):** +30 stories over v2 (85 → 115); 30 v2 stories amended in place (1.1, 1.4, 1.7, 2.2, 2.5, 3.1, 4.4, 4.5, 4.6, 6.5, 8.3, 8.4, 8.5, 9.1, 10.3, 10.4, 11.1, 11.3, 12.1, 12.2, 12.3, 12.4, 12.5, 12.7, 13.2, 14.2, 14.4, 14.5, 14.6, 15.1 — amendments marked inline). Additionally, purely mechanical renames touched carried stories without semantic change and are not marked: v2's F4/F5/F6 rationale tags → R1/R2/R3 (4.7, 4.8, 14.1, 14.3, 15.2, 15.4 and others), #7 → #7-A normalization, and VPS → VM wording for the GCP move. New constraint **#9** (recognition ranks engagement, never money). New epics: **16 The Living Feed** (MessageBus live updates, presence, user status, follow), **17 Squares Chat** (Discourse Chat: corridor Squares, threads, chat→discussion promotion, chat moderation), **18 Recognition & Playfulness** (engagement leaderboards, desi badge ladder, celebrations, polls, roadmap voting), **19 Live Events & AMAs** (calendar/post-event AMAs, automated rituals, recaps), **20 Market Pulse** (ticker hubs, trending tickers, cashtag chips, landing ticker strip). R1/R2/R3 (the client's restated search/label/landing-summary requirements) are carried from v2's F4/F5/F6 and deepened via 4.5/4.6 amendments, 14.5→20.1 hub linkage, and 20.4's landing strip. Everything new rides native Discourse machinery — the plugin-set table at the top is the definitive list.
