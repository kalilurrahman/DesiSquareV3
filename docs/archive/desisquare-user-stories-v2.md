# DesiSquare — User-Story Corpus v2 (Phase 1 + 1.5)

**Scope:** Demo deployment on a single Ubuntu 24.04 VPS (community.example.com + app.example.com, one reverse proxy, Let's Encrypt, transactional SMTP). Systems: Discourse (Porcelain Slate theme), Ghostfolio (bounded reskin), wa-bridge, gf-provisioner, gf-stats, WhatsApp Business Cloud API.
**Positioning:** Educational community only. No investment advice. Non-negotiable constraints referenced inline: #3 flags private, #4 dollars owner-only / public % only, #5 WhatsApp consent + no E.164 leakage, **#7-A public-teaser gate (amended — see below)**, #8 percent-only maven pipeline.

## What's new in v2 (client requirements, 19 Jul 2026)

| Req | Requirement | Where it lands | Discourse-native mechanism |
|---|---|---|---|
| **F4** | Search by **general text, stock ticker, or label** | Epic 4 (stories 4.6–4.8) | Full-text search + **tags** as labels + `tags:` search filters + cashtag recognition |
| **F5** | Community conversations/interactions are **labelled** — manually, **automated where the tool allows**, moderator-curated for effectiveness | New **Epic 14 — Labels & Taxonomy** | Discourse **tags + tag groups** (manual), **discourse-automation** rules + **Discourse AI triage/helper** (automated), tag admin: rename/merge/synonyms/staff-only (moderation) |
| **F6** | **Popular discussions + summaries on the free (signed-out) landing page**, and popular discussions with summaries inside a chosen group — Reddit-style summary interface; "best of" à la Discord digests | New **Epic 15 — Public Landing & Summaries**; amends Epic 1 | **Hot/Top lists** scoped globally & per category, **Discourse AI topic summaries** (with excerpt fallback), custom-homepage theme + cached digest job |

> **Constraint amendment #7 → #7-A** (client decision via F6): the signed-out landing is no longer content-free. It may show a **curated public teaser**: popular discussion **titles + short summaries + engagement counts + labels** drawn from **public corridors only**. Everything else stays gated exactly as before — full threads, comments, member profiles, search, and all member JSON endpoints still require a session; private/request-gated communities and the review queue **never** surface; the teaser is pseudonym-only and `noindex` until the client decides on SEO. The leak-sweep CI (12.5) is extended to enforce this boundary.

---

## Personas

| Persona | Description |
|---|---|
| **Visitor** | Signed-out person who landed on community.example.com. Sees only the gated landing (W1). Has (or lacks) an invite code. |
| **Member** | Pseudonymous retail investor (e.g., `quiet_lotus`) in a country corridor. Posts, reacts, flags, tracks a private portfolio, may opt into WhatsApp. |
| **Maven** | Credentialed expert member (e.g., `nikhil_cfa`, CFA). May opt into public performance proof — percent-only, never currency. |
| **Moderator** | Trusted member who works the private review queue (W9): removes content, dismisses flags. Never sees who flagged what beyond queue context. |
| **Community Admin** | Owns a corridor community's configuration: spaces, membership approvals, maven credentialing, A/B experiments (W10). |
| **Platform Operator (Ops)** | Runs the VPS: deploy, TLS, backups, upgrades, monitoring, leak-sweep CI, demo drawer (W11). |
| **Compliance Officer** | Guardian of educational-only positioning, disclaimers, SEBI finfluencer risk, WhatsApp opt-in rules, and privacy constraints #3/#4/#5/#8. |

---

## Epic 1 — Onboarding & Access

**1.1** As a **Visitor**, I want the signed-out landing to show only the curated public teaser and nothing else, so that member content stays private until I'm invited (#7-A).
- Given I am signed out, When I open community.example.com, Then I see the W1 landing (value prop, invite field, sign-in link) plus the public digest (Epic 15) — and nothing beyond it: no full threads, no comments, no member lists, no search.
- Given I request any deep URL (post, profile, community, search) while signed out, When the page loads, Then I am redirected to W1 with no content flash — teaser cards link to the join gate, not the thread (15.5).
- Given I query Discourse member JSON endpoints (`/latest.json`, `/u/…`, `/search.json`) anonymously, When the response returns, Then it is 403/redirect, not content; the only anonymous data path is the cached digest payload of 15.1.
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

**1.4** As a **Member**, I want to participate under a pseudonym, so that my financial discussions aren't tied to my legal identity.
- Given signup, When I choose a handle like `quiet_lotus`, Then my real name and email never render on any public surface (posts, profiles, search, mirrored content).
- Given another member views my W6 public profile, When it loads, Then only pseudonym, corridor, join date, badges, and (if opted-in) allocation % appear.
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

**1.7** As a **Member**, I want first-run onboarding to pick my corridor and starter spaces, so that my feed is relevant from day one.
- Given first sign-in, When onboarding runs, Then I pick one corridor (US/CA/UK/AE/AU/SG) and am auto-joined to its default spaces (Stocks & ETFs, Ask the community, Watercooler).
- Given I skip onboarding, When I land on W3, Then a persistent-but-dismissible prompt lets me finish later; the feed still renders with sensible defaults.
- **Priority:** P1 · **Wireframe:** W2, W8 · **Systems:** Discourse

---

## Epic 2 — Feed & Posting

**2.1** As a **Member**, I want my feed to default to Popular, so that I see the community's best current discussions first.
- Given I open W3, When the feed loads, Then the sort is Popular (Discourse Hot) scoped to my joined communities/spaces.
- Given a post gains reactions and replies, When Hot recalculates, Then it rises in Popular without manual curation.
- Given I return in a new session, When W3 loads, Then Popular is still the default (my last toggle may persist per session, but the product default is Popular).
- **Priority:** P0 · **Wireframe:** W3 · **Systems:** Discourse

**2.2** As a **Member**, I want to switch between Popular and New sorts (F3), so that I can catch fresh posts too.
- Given W3, When I tap "New", Then the feed re-orders strictly by created-at descending without a full page reload.
- Given "New" is active, When a post is created elsewhere, Then it appears at the top on next refresh.
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

**2.5** As a **Member**, I want the feed and composer to work well on mobile, so that I can participate from my phone.
- Given a 360px viewport, When I browse W3/W4, Then no horizontal scroll occurs, tap targets are ≥44px, and the sort toggle and reaction pills remain reachable.
- Given the mobile composer, When I post, Then behavior (required space, draft restore) matches desktop.
- **Priority:** P1 · **Wireframe:** W12 · **Systems:** Discourse

**2.6** As a **Maven**, I want my posts visibly badged, so that readers can weigh credentialed perspectives (without implying advice).
- Given `nikhil_cfa` posts, When the card renders in W3/W4, Then the maven badge + credential label appear next to the pseudonym.
- Given any maven-badged post, When it renders, Then the standard "educational, not investment advice" disclaimer is present on the post detail (see 11.1).
- **Priority:** P1 · **Wireframe:** W3, W4 · **Systems:** Discourse

---

## Epic 3 — Reactions & Flagging

**3.1** As a **Member**, I want four public reaction pills — Helpful, Insightful, Actionable, Like — so that I can give structured feedback.
- Given any post/comment, When I tap a pill, Then it increments instantly, highlights as mine, and tapping again removes it.
- Given the pill set, When I inspect the UI, Then exactly these four exist and no dislike/downvote exists.
- Given I react on mobile (W12), When I tap, Then the same behavior holds.
- **Priority:** P0 · **Wireframe:** W3, W4 · **Systems:** Discourse

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

**4.4** As a **Visitor**, I want search to be inaccessible while signed out, so that the gate holds (#7).
- Given signed-out state, When I request the search UI or `/search.json?q=…`, Then I'm redirected to W1 / receive 403 with no result payload.
- **Priority:** P1 · **Wireframe:** W1, W13 · **Systems:** Discourse

**4.5** As a **Member**, I want recent-search and trending suggestions in the empty search state, so that discovery starts before I type.
- Given W13 with an empty query, When it opens, Then my recent searches (local) and a few trending topics render as tappable chips.
- Given I clear recent searches, When I reopen search, Then they're gone.
- **Priority:** P2 · **Wireframe:** W13 · **Systems:** Discourse

**4.6** *(NEW · F4)* As a **Member**, I want to search by **stock ticker** — `NVDA` or `$NVDA` — and get ticker-focused results, so that I can follow everything the community says about a security.
- Given I search `NVDA` or `$NVDA`, When results return, Then conversations **labelled** with the `nvda` ticker label (Epic 14) rank first, followed by full-text mentions in post bodies/titles, in every tab.
- Given ticker results, When the results header renders, Then a **ticker chip** ("$NVDA · 14 discussions · label") appears; tapping it pins the label filter (`tags:nvda`) so I can then add free text within that scope.
- Given a ticker with zero labelled content but text mentions, When results return, Then text matches still appear (search never comes back empty just because labelling lags).
- Given cashtag input with lowercase/mixed case (`$nvda`), When parsed, Then it normalizes to the canonical ticker label.
- **Priority:** P0 · **Wireframe:** W13 (F4) · **Systems:** Discourse (tags + `tags:` search filter)

**4.7** *(NEW · F4)* As a **Member**, I want to search and filter by **label**, so that I can pull up every conversation on a theme (FEMA, FCNR, 401k…) regardless of wording.
- Given W13, When I type a query matching a label name (e.g., "fema"), Then a **label suggestion chip** renders above results ("Label: fema · view all"); tapping it opens the label's browse page (14.6) / applies `tags:fema`.
- Given an active label filter, When I switch tabs (Posts/Comments), Then the filter persists and the URL reflects it (`…&label=fema`) so filtered searches are shareable.
- Given multiple labels selected, When results render, Then AND/OR behavior is explicit in the UI (default: AND), matching Discourse `tags:a+b` vs `tags:a,b` semantics.
- **Priority:** P0 · **Wireframe:** W13 (F4) · **Systems:** Discourse (native tag search)

**4.8** *(NEW · F4)* As a **Member**, I want to combine free text, ticker, label, space, and author in one query, so that precise questions get precise answers.
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

**6.5** As a **Member**, I want to record holdings and transactions in the reskinned Ghostfolio, so that my allocation and performance data are real.
- Given the bounded reskin, When I use Ghostfolio, Then core flows (add activity, holdings view, performance chart) work and visually align with Porcelain Slate (logo, palette) without forked upstream internals.
- Given I add a transaction, When gf-stats next computes, Then my allocation % (and maven % series if applicable) reflect it.
- **Priority:** P1 · **Wireframe:** W5 · **Systems:** Ghostfolio

**6.6** As a **Compliance Officer**, I want an automated check proving public portfolio surfaces contain no currency values, so that #4 is continuously enforced.
- Given the leak-sweep suite (see 12.5), When it crawls W6 pages and gf-stats public endpoints as a non-owner, Then any currency symbol, formatted amount, or numeric field tagged as monetary fails the build.
- Given a regression that exposes an amount, When CI runs, Then the deploy is blocked and Ops is alerted.
- **Priority:** P0 · **Wireframe:** W6 · **Systems:** gf-stats, Ghostfolio

---

## Epic 7 — Maven Trust & Performance Proof

**7.1** As a **Maven**, I want to explicitly opt in before any performance data is published, so that public proof is always consensual (#8).
- Given maven status, When I visit W7, Then a "Publish my performance (percent only)" toggle exists, OFF by default, with an explainer of exactly what will be shown.
- Given I opt in, When I confirm, Then consent is timestamped and my W14 module goes live on the next gf-stats cycle.
- Given a non-maven member, When they view W7, Then this toggle does not exist for them.
- **Priority:** P0 · **Wireframe:** W7, W14 · **Systems:** gf-stats, Discourse, Ghostfolio

**7.2** As a **Member**, I want to see an opted-in maven's performance as percentages over standard periods (F2), so that credibility is evidence-based (#8).
- Given `nikhil_cfa` opted in, When I open their W14 module, Then I see % returns for defined periods (e.g., 1M/3M/6M/YTD/1Y) plus allocation %, computed by gf-stats from their Ghostfolio data.
- Given the rendered module and its API response, When inspected, Then no currency value, portfolio size, or share count appears — currency is stripped server-side in gf-stats.
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

**8.3** As a **Member**, I want messages from the linked WhatsApp group mirrored into the forum within 60 seconds, so that group knowledge is preserved and searchable.
- Given a consented group participant sends a message, When wa-bridge processes it, Then a forum post/reply appears in the designated space in <60s, attributed to the participant's linked pseudonym.
- Given media or unsupported message types, When mirrored, Then either supported content renders or a clean "[unsupported message type]" placeholder appears — never a broken post.
- Given the mirrored post, When it renders, Then it's labeled as mirrored from WhatsApp.
- **Priority:** P0 · **Wireframe:** W3, W4 · **Systems:** wa-bridge, WhatsApp, Discourse

**8.4** As a **Member**, I want mirroring to apply only to participants who have consented, so that nobody's words are republished without permission (#5).
- Given a group participant who has NOT granted mirroring consent, When they send messages, Then wa-bridge drops them — nothing is posted, stored, or queued.
- Given I revoke mirroring consent in W7, When I next message the group, Then mirroring has stopped for me (no grace-period leakage).
- Given consent state changes, When wa-bridge evaluates a message, Then it checks current consent at processing time, not a cached value older than 60 seconds.
- **Priority:** P0 · **Wireframe:** W7 · **Systems:** wa-bridge, Discourse

**8.5** As a **Member**, I want my phone number never to appear on the platform, so that mirroring can't deanonymize me (#5).
- Given any mirrored post, When its content, metadata, and raw HTML are inspected, Then no E.164 number (mine or a quoted participant's) appears; attribution is pseudonym-only.
- Given a message body that itself contains a phone number typed by a user, When mirrored, Then the number pattern is redacted (e.g., `[number removed]`).
- Given wa-bridge logs on the VPS, When reviewed, Then numbers are masked in application logs.
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

**9.1** As a **Moderator**, I want a private review queue listing all flagged items with full context, so that I can triage efficiently.
- Given W9, When it loads, Then items show content excerpt, author pseudonym, community/space, flag reason(s), notes, flag count, and age — sorted oldest-first by default.
- Given filters, When I filter by reason (e.g., Misleading) or community, Then the list narrows accordingly.
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

**10.3** As a **Member**, I want per-channel notification preferences (in-app, email, WhatsApp), so that I control volume by channel.
- Given W7, When I set replies=in-app-only, Then a reply produces an in-app notification and no email/WhatsApp message.
- Given email digests enabled, When the digest sends via SMTP, Then it contains only content from my joined communities.
- **Priority:** P1 · **Wireframe:** W7 · **Systems:** Discourse, WhatsApp

**10.4** As a **Member**, I want to export my data and delete my account, so that I keep ownership of my information.
- Given W7, When I request export, Then I receive (via email link) my posts, reactions, consents, and Ghostfolio activities; the export contains no other members' private data.
- Given account deletion, When confirmed, Then my Discourse account is anonymized, my Ghostfolio account is deleted by gf-provisioner, my WhatsApp consents are revoked, and my public profile/W6 return 404 within 24 hours.
- **Priority:** P2 · **Wireframe:** W7 · **Systems:** Discourse, gf-provisioner, Ghostfolio, wa-bridge

---

## Epic 11 — Compliance & Disclaimers

**11.1** As a **Compliance Officer**, I want "educational only — not investment advice" disclaimers on every content surface, so that positioning is unambiguous.
- Given W1, W3, W4, W6, and W14, When each renders (desktop and W12 mobile), Then the disclaimer is visibly present (footer or module-adjacent) without user interaction.
- Given the composer, When a member posts in an investing space, Then a one-line reminder ("share education, not advice") appears above the editor.
- Given a themed page update, When the leak-sweep/UI test suite runs, Then a missing disclaimer fails the check.
- **Priority:** P0 · **Wireframe:** W1, W3, W4, W6, W14 · **Systems:** Discourse, gf-stats

**11.2** As a **Compliance Officer**, I want the signed-out landing to position DesiSquare strictly as an educational community, so that acquisition copy creates no advisory expectation.
- Given W1, When reviewed, Then copy contains no promises of returns, no "beat the market" language, and describes mavens as educators sharing track records, not advisors.
- Given W1's footer, When rendered, Then terms, privacy policy, and the full disclaimer are linked and reachable while signed out.
- **Priority:** P0 · **Wireframe:** W1 · **Systems:** Discourse

**11.3** As a **Compliance Officer**, I want automated screening of maven-authored content for advisory/solicitation language, so that finfluencer risk is caught early.
- Given the denylist (e.g., "guaranteed", "sure-shot", "DM me to invest", fee/telegram-channel solicitations), When a maven post or bio matches, Then it is auto-routed to the W9 queue with reason "Misleading/Marketing" before or immediately after publishing.
- Given a moderator reviews such an item, When they act, Then remove/dismiss works as in Epic 9 and the denylist hit is shown as context.
- **Priority:** P1 · **Wireframe:** W9 · **Systems:** Discourse

**11.4** As a **Member**, I want to acknowledge the community's educational-only terms at signup, so that expectations are set contractually.
- Given account creation (W2), When I proceed, Then I must check an explicit acknowledgment ("content here is education, not investment advice") — unchecked blocks signup.
- Given my acceptance, When recorded, Then it's timestamped and versioned (terms v-number) in my account record.
- **Priority:** P1 · **Wireframe:** W2 · **Systems:** Discourse

---

## Epic 12 — Ops & Admin

**12.1** As a **Platform Operator**, I want the full stack deployed on one VPS behind a single reverse proxy with TLS, so that the demo runs on modest hardware.
- Given a fresh Ubuntu 24.04 VPS (4-8GB), When the deploy runbook/compose is executed, Then community.example.com (Discourse) and app.example.com (Ghostfolio) serve over Let's Encrypt TLS with HTTP→HTTPS redirect, and the three scripts (wa-bridge, gf-provisioner, gf-stats) run as supervised services.
- Given certificate renewal, When certs near expiry, Then renewal is automatic and verified by a scheduled check.
- Given total load of the demo dataset, When monitored, Then steady-state memory fits within the VPS budget with swap as a safety net.
- **Priority:** P0 · **Wireframe:** — · **Systems:** All

**12.2** As a **Platform Operator**, I want nightly automated backups with a tested restore path, so that demo data survives mistakes.
- Given the schedule, When the nightly job runs, Then Discourse (DB + uploads), Ghostfolio DB, and script state/consent stores are backed up off-box with 7-day retention.
- Given the restore drill runbook, When executed against a scratch target, Then the platform restores to a working state and the drill result is logged.
- Given a failed backup, When detected, Then Ops is alerted within the same day.
- **Priority:** P0 · **Wireframe:** — · **Systems:** All

**12.3** As a **Platform Operator**, I want health checks and alerting for every service, so that failures are noticed before members do.
- Given health endpoints/heartbeats for Discourse, Ghostfolio, wa-bridge, gf-provisioner, gf-stats, and SMTP, When any is down >5 minutes, Then an alert (email/WhatsApp to Ops) fires.
- Given wa-bridge, When its mirror latency exceeds the 60s SLO over a 15-min window, Then a warning alert fires.
- Given disk >85% or memory pressure, When thresholds trip, Then Ops is alerted.
- **Priority:** P1 · **Wireframe:** — · **Systems:** All

**12.4** As a **Platform Operator**, I want pinned, documented versions with a rehearsed upgrade path, so that upgrades don't silently break the theme or the reskin.
- Given pinned Discourse/Ghostfolio versions, When I run the upgrade runbook on a staging copy, Then post-upgrade smoke tests (login, post, react, flag, SSO, W6 %-only view, mirror) pass before production upgrade.
- Given an upgrade breaks the Porcelain Slate theme or bounded reskin, When smoke tests fail, Then rollback to the previous snapshot completes from backup.
- **Priority:** P1 · **Wireframe:** — · **Systems:** Discourse, Ghostfolio

**12.5** As a **Platform Operator**, I want a leak-sweep CI job that scans public surfaces for privacy violations, so that constraints #3/#4/#5/#7 are machine-enforced.
- Given the sweep, When it runs on every deploy and nightly, Then it crawls signed-out pages (expecting the **#7-A boundary**: the curated digest may render, but member endpoints 403, teaser cards contain no private-community content, no currency values, no E.164 numbers, and thread deep-links gate), non-owner W6/W14 pages and gf-stats endpoints (expecting zero currency values, #4/#8), and recent mirrored posts (expecting zero E.164 patterns, #5), and checks that flag indicators are absent for non-mods (#3).
- Given any violation, When detected, Then the pipeline fails/alerts with the offending URL and matched pattern.
- Given a clean run, When it completes, Then a dated pass record is stored for compliance review.
- **Priority:** P0 · **Wireframe:** W1, W6, W14 · **Systems:** gf-stats, wa-bridge, Discourse, Ghostfolio

**12.6** As a **Platform Operator**, I want transactional email to reliably deliver, so that signup verification and digests work.
- Given SMTP configuration with SPF/DKIM/DMARC set for the sending domain, When a verification email sends, Then it arrives to major providers (Gmail/Outlook) in inbox, not spam, in test runs.
- Given SMTP failure, When sends bounce or the queue backs up, Then Ops is alerted and Discourse retries.
- **Priority:** P1 · **Wireframe:** W2 · **Systems:** Discourse

**12.7** As a **Platform Operator**, I want a demo drawer with seeded personas and one-click role switching, so that stakeholder walkthroughs are smooth.
- Given the demo drawer (W11) on the demo instance only, When I pick a persona (visitor, `quiet_lotus`, `nikhil_cfa`, moderator, admin), Then I'm switched into that session and landed on that persona's home surface.
- Given seeded data, When any demo persona browses, Then all constraint showcases work: W6 shows %-only, W9 has queue items, W14 shows a live maven module and an "insufficient history" example.
- Given a production-mode flag, When set, Then the demo drawer is fully disabled and unreachable.
- **Priority:** P1 · **Wireframe:** W11 · **Systems:** Discourse, Ghostfolio, gf-stats

---

## Epic 13 — Experiments (A/B Lab)

**13.1** As a **Community Admin**, I want to define an A/B experiment (name, hypothesis, variants, metric, audience %), so that product changes are tested, not guessed.
- Given W10, When I create an experiment (e.g., default sort Popular vs New), Then it saves in Draft with variants, a primary metric, and traffic split, and starts only on explicit launch.
- Given a launched experiment, When members are assigned, Then assignment is sticky per member for the experiment's duration.
- **Priority:** P2 · **Wireframe:** W10 · **Systems:** Discourse

**13.2** As a **Community Admin**, I want guardrails on what can be experimented on, so that compliance and privacy surfaces are never in a test cell.
- Given experiment targeting, When I attempt to vary disclaimers, the signed-out gate, flag privacy, consent flows, or %-only rendering, Then W10 blocks the configuration with an explanation.
- Given allowed surfaces (sort defaults, copy on non-compliance elements, layout variants), When configured, Then launch proceeds.
- **Priority:** P2 · **Wireframe:** W10 · **Systems:** Discourse

**13.3** As a **Community Admin**, I want per-variant results with sample sizes, so that I can conclude experiments honestly.
- Given a running experiment, When I open its W10 detail, Then I see per-variant exposure counts and the primary metric with dates.
- Given I stop an experiment, When I pick a winner, Then that variant becomes the default for everyone and the experiment archives with its data intact.
- Given tiny samples, When results render, Then a low-sample warning shows rather than implied significance.
- **Priority:** P2 · **Wireframe:** W10 · **Systems:** Discourse

---

## Epic 14 — Labels & Taxonomy *(NEW · F5)*

> **Discourse mapping:** labels = Discourse **tags**; label sets = **tag groups** (optionally required per space); automated labelling = **discourse-automation** rules + **Discourse AI** (triage / helper tag suggestions — needs an LLM key) + watched-words auto-tag; governance = tag admin (rename, merge, synonyms, staff-only tags, min-trust-to-create).

**14.1** As a **Member**, I want to label my conversation when I post, so that it's findable by theme and ticker (F4/F5).
- Given the composer (2.3), When I write, Then a label picker suggests from the space's curated label sets (tag groups) with type-ahead; I can apply up to 5 labels; investing spaces **require at least one** label before Post enables.
- Given my trust level is below the label-creation threshold, When I type an unknown label, Then I can request it (it applies as pending-review) but cannot mint arbitrary new labels — keeping the taxonomy clean.
- Given a labelled post, When it renders anywhere (W3/W4/W13/W15), Then its label chips render and each chip links to the label browse page (14.6).
- **Priority:** P0 · **Wireframe:** W3, W4 (F5) · **Systems:** Discourse (tags, tag groups)

**14.2** As a **Community Admin**, I want curated label sets per space, so that labelling stays consistent and useful.
- Given tag-group admin, When I define sets (e.g., **Tickers** `nvda, vti, …`; **Themes** `fema, fcnr, 401k, roth, real-estate, insurance`; **Format** `question, guide, discussion, poll`), Then each space declares which sets apply and which are required.
- Given a label rename or merge (e.g., `fcnr-b` → `fcnr`), When executed, Then all existing conversations re-point automatically and old label URLs redirect — no dead links.
- Given synonyms (e.g., `retirement` → `401k`), When a member applies the synonym, Then the canonical label is stored.
- **Priority:** P0 · **Wireframe:** W8, W15 (F5) · **Systems:** Discourse (tag groups, synonyms)

**14.3** As a **Community Admin**, I want **automated labelling** of new conversations, so that coverage doesn't depend on member diligence (F5: "if the tool allows automated labelling — use it").
- Given discourse-automation rules (keyword/regex → label: "FCNR" → `fcnr`, "$NVDA"/cashtags → ticker labels), When a matching post is created or mirrored via wa-bridge, Then the label is applied within 60 seconds and marked **auto** in the label metadata.
- Given Discourse AI is configured (LLM key present), When a new conversation has no label, Then AI triage proposes up to 3 labels from the curated sets **only** (never inventing new ones); proposals auto-apply and are flagged **auto** for review.
- Given the author edits labels afterwards, When they remove an auto label, Then it stays removed (member intent beats automation; the removal is logged for tuning).
- **Priority:** P1 · **Wireframe:** W3, W4 (F5) · **Systems:** Discourse (discourse-automation, Discourse AI triage, watched words), wa-bridge

**14.4** As a **Moderator**, I want to curate labels for effectiveness, so that the taxonomy stays trustworthy (F5: "moderated by the moderator").
- Given any conversation, When I open its label editor, Then I can add/remove labels regardless of author settings, and my change is logged in the moderation audit trail (9.5).
- Given the label-quality view, When I review, Then I see: auto-labels awaiting confirmation, most-used labels, orphaned/near-duplicate labels, and mislabel reports — with one-click confirm/fix/merge actions.
- Given a junk or abusive label, When I delete it, Then it's removed from all conversations and (optionally) added to a blocked-label list.
- Given label effectiveness metrics (via Data Explorer: label usage, search-click-through by label), When reviewed monthly, Then merge/rename decisions are data-driven.
- **Priority:** P1 · **Wireframe:** W9 (F5) · **Systems:** Discourse (tag admin, Data Explorer)

**14.5** As a **Member**, I want tickers mentioned as cashtags to become ticker labels automatically, so that ticker search (4.6) is reliable without manual effort.
- Given a post containing `$NVDA` (or a configured symbol list match), When published or mirrored, Then the `nvda` ticker label auto-applies (via the 14.3 automation) and the cashtag renders as a tappable chip.
- Given a false positive (e.g., `$100`), When the pattern is not in the symbol list, Then no label applies — the automation matches known symbols only.
- **Priority:** P1 · **Wireframe:** W3, W4, W13 (F4+F5) · **Systems:** Discourse (automation), wa-bridge

**14.6** As a **Member**, I want a label browse page, so that each label works like a topic hub.
- Given `/label/fema` (Discourse tag page), When it loads, Then all conversations carrying the label list with the standard Popular/New sort (F3) and the space filter.
- Given the page header, When it renders, Then it shows the label description (admin-editable), conversation count, and a Follow-label action that adds label activity to my notifications.
- **Priority:** P2 · **Wireframe:** W13, W15 · **Systems:** Discourse (tag pages, tag tracking)

---

## Epic 15 — Public Landing & Summaries *(NEW · F6 — amends #7 → #7-A)*

> **References:** Reddit's summary-card interface; Discord community "best of" digests. **Discourse mapping:** Hot/Top lists (global + per-category) + **Discourse AI topic summaries** (excerpt fallback) + custom-homepage theme; the signed-out teaser is served from a **cached digest payload** built by a scheduled job with an admin-scoped API key — member endpoints stay gated.

**15.1** As a **Visitor**, I want the free landing page to show today's popular discussions as Reddit-style summary cards, so that I can see the community's value before joining (F6).
- Given the signed-out W1, When it loads, Then below the join module a **"Popular this week"** digest renders: 5–10 cards, each with title, 2–3-sentence summary, space + label chips, engagement counts (reactions/comments), pseudonymous author (+ MAVEN ✓ badge where applicable), and relative age.
- Given the digest source, When it's built, Then only content from **public corridors** is eligible; private/request-gated communities, the review queue, and anything removed by moderation are structurally excluded (#7-A).
- Given the cards, When rendered signed-out, Then no currency values, no E.164 numbers, and no member emails appear (the leak-sweep of 12.5 crawls this surface), and the page carries `noindex` until the client's SEO decision.
- Given the digest job fails, When the landing renders, Then it falls back to the last good cached digest (with its date) or hides the section — never an error.
- **Priority:** P0 · **Wireframe:** W1 (F6) · **Systems:** Discourse (Top/Hot lists via API, digest job)

**15.2** As a **Member**, I want each popular discussion to carry a short summary, so that skimming works like Reddit's preview + Discord's best-of digest (F6).
- Given a discussion crossing the popularity threshold, When the digest job runs, Then a summary generates via **Discourse AI topic summarization** (whole-thread aware); if AI is unconfigured, the fallback is the first-post excerpt — the card renders either way.
- Given a generated summary, When it's stored, Then it's marked **auto** and a moderator can edit or regenerate it (15.3); edited summaries never regress to auto on the next run.
- Given a summary, When it renders, Then it is ≤280 characters on cards, attributes nothing beyond pseudonyms, and inherits the educational disclaimer of its surface.
- **Priority:** P0 · **Wireframe:** W1, W3, W15 (F6) · **Systems:** Discourse (AI summarization), digest job

**15.3** As a **Moderator**, I want editorial control over what the public teaser shows, so that the free surface is always safe and on-brand.
- Given the digest candidate list, When I review it (a lightweight queue view), Then I can pin, exclude, edit-summary, or reorder items; exclusions persist across regenerations.
- Given a summary containing advisory/solicitation language (7.6 denylist match — "guaranteed returns", ticker pumping), When the job screens it, Then the item is auto-held for moderator review instead of publishing to the public page.
- Given a discussion is removed or its community goes private, When the next digest builds (≤hourly), Then the card disappears from the public landing.
- **Priority:** P0 · **Wireframe:** W1, W9 (F6) · **Systems:** Discourse, digest job

**15.4** As a **Member**, I want the community I choose to show its own popular discussions **with summaries**, so that each group has a skimmable "best of" (F6, extends F3).
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

## Story-Count Summary

| # | Epic | P0 | P1 | P2 | Total |
|---|---|---|---|---|---|
| 1 | Onboarding & Access | 5 | 2 | 0 | 7 |
| 2 | Feed & Posting | 4 | 2 | 0 | 6 |
| 3 | Reactions & Flagging | 4 | 1 | 0 | 5 |
| 4 | Search & Discovery *(+F4 ticker/label)* | 5 | 2 | 1 | 8 |
| 5 | Communities & Corridors | 3 | 2 | 0 | 5 |
| 6 | Portfolio & Privacy | 5 | 1 | 0 | 6 |
| 7 | Maven Trust & Performance Proof | 5 | 1 | 0 | 6 |
| 8 | WhatsApp Integration | 5 | 2 | 0 | 7 |
| 9 | Moderation | 4 | 1 | 0 | 5 |
| 10 | Settings & Consent | 1 | 2 | 1 | 4 |
| 11 | Compliance & Disclaimers | 2 | 2 | 0 | 4 |
| 12 | Ops & Admin | 3 | 4 | 0 | 7 |
| 13 | Experiments (A/B Lab) | 0 | 0 | 3 | 3 |
| 14 | **Labels & Taxonomy (NEW · F5)** | 2 | 3 | 1 | 6 |
| 15 | **Public Landing & Summaries (NEW · F6)** | 3 | 2 | 1 | 6 |
| | **Total** | **51** | **27** | **7** | **85** |

**Reading guide:** P0 = demo cannot ship without it (includes every constraint-bearing story: #3, #4, #5, #7-A, #8). P1 = strongly expected for a credible Phase 1.5 demo. P2 = stretch. Every story is testable as written; the leak-sweep CI (12.5) is the automated backstop for the privacy constraints **including the new #7-A public-teaser boundary**, and the demo drawer (12.7) is how stakeholders exercise the corpus end-to-end.

**v2 changelog (19 Jul 2026):** +15 stories. F4 ticker/label search → 4.6–4.8. F5 labelling (manual + automated via discourse-automation/Discourse AI + moderator curation) → Epic 14. F6 public landing with popular-discussion summaries (Reddit-style cards, Discord-style best-of) + per-community summary cards → Epic 15, amending constraint #7 → **#7-A** and story 1.1. All new stories leverage native Discourse machinery: tags, tag groups, synonyms, automation rules, AI triage & topic summarization, Hot/Top lists, Data Explorer.