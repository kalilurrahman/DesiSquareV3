# DesiSquare-style Community Platform — Discourse + Ghostfolio + WhatsApp

### A comprehensive critical feasibility analysis, architecture, cost model, and recommendations

> **Prepared by:** BiGMo Consulting · **Date:** 18 July 2026 · **Status:** Advisory / scoping report
> **Subject:** Building an online community forum (Discourse) + wealth/portfolio tracker (Ghostfolio) + WhatsApp messaging for a South‑Asian ("desi") retail‑investor community, matching the shared demo `desisquare-production.up.railway.app`.

---

## 0. How to read this report

You asked five things:

1. Can the **skins and appearance** of this stack be modified and customized?
2. If you have a **wireframe**, can Discourse's skin be customized to build the site to match it?
3. **Same question for Ghostfolio.**
4. **Analyze the demo** (`desisquare-…up.railway.app`) and recommend **what is possible and what is not**.
5. Deliver a **comprehensive, critical analysis, summary, final report and recommendations** — and give you *what is in the example site*.

The short answers, up front, then the evidence:

| Your question | Short answer |
|---|---|
| Can appearances be customized? | **Yes — both.** But by two very different mechanisms with very different cost profiles. |
| Discourse from a wireframe? | **Yes, to a high degree** for branding + layout via its first‑class theme system; with a clear ceiling where "new functionality" starts. |
| Ghostfolio from a wireframe? | **Yes, but materially harder** — it requires forking and rebuilding the app, and carries an ongoing maintenance + open‑source‑license obligation. |
| The demo (DesiSquare)? | It is a **self‑hosted, rebranded Ghostfolio** instance on Railway. "Give me what's in it" = self‑host Ghostfolio, rebrand it, wire it to the forum + WhatsApp. |
| Is the whole thing buildable? | **Yes.** It is a real, achievable build — with three specific risks you must price in: the Ghostfolio *fork‑maintenance* burden, the *WhatsApp group* limitation, and *investment‑advice compliance*. |

> **Methodology note.** This report was produced by BiGMo's multi‑agent research process: 13 parallel deep‑dive investigations against primary sources (official Discourse/Ghostfolio/Meta developer docs, the project repositories, and licence texts), followed by an adversarial verification pass that fact‑checked the 12 highest‑stakes claims. Where the verification pass **corrected** an initial finding, the corrected version is what appears below (see §11, "What we double‑checked").

---

## 1. Executive summary & headline verdict

**This is a buildable, sensible stack — but it is an *integration* build of three independent open‑source/SaaS systems, not a product with a customization dial.** The three pieces do very different jobs and customize in very different ways:

- **Discourse** (the forum) is the *strong* pillar. It has a mature, runtime, git‑native **theme system** that can reskin and substantially re‑lay‑out the UI from your wireframes **without forking the codebase** — and it is upgrade‑safe because themes live *outside* core.
- **Ghostfolio** (the portfolio tracker, and what the DesiSquare demo actually is) is the *fragile* pillar for customization. It has **no white‑label/theming system at all**. Any real rebrand or wireframe‑driven redesign means editing the Angular source and **maintaining a fork** against a project that ships ~100 releases a year — and, because it is **AGPLv3**, publicly hosting your modified version legally obliges you to share your modified source with your users.
- **WhatsApp** is the *constrained* pillar. It **cannot be the forum.** WhatsApp's official API is a 1:1 / opt‑in‑broadcast notification channel. (Meta did add an official *Groups API* in October 2025 — but it caps groups at **8 members**, so it is a concierge feature, not a community.) The safe, sanctioned role for WhatsApp here is **opt‑in notifications and a support bot**, with Discourse's own chat and/or Telegram carrying community‑scale messaging.

**The single most important architectural decision** that falls out of this: **let Discourse carry the bespoke, wireframe‑driven UI; keep Ghostfolio close to stock and treat it as an embedded/linked portfolio module; use WhatsApp for notifications only.** Fighting that grain (pixel‑matching Ghostfolio to a wireframe, or forcing WhatsApp to be the discussion surface) is where budgets and timelines die.

**Feasibility at a glance:**

| Capability | Verdict | Notes |
|---|---|---|
| Reskin the forum to your brand/wireframe | 🟢 **Fully possible** | Discourse themes: colours, fonts, header/nav, custom homepage, sidebar, cards |
| Custom **forum homepage / landing** | 🟢 **Fully possible** | First‑class `custom-homepage` feature |
| Rebrand the portfolio app (name/logo/colours) | 🟡 **Possible, fork required** | Edit Angular source + rebuild image; ongoing merge burden |
| Pixel‑match the **portfolio app** to an arbitrary wireframe | 🟠 **Costly / discouraged** | Angular Material layout rewrite; high upgrade fragility |
| Single sign‑on across forum + portfolio | 🟢 **Possible** | Shared external OIDC identity provider (Keycloak/Authentik) |
| WhatsApp **opt‑in notifications & support bot** | 🟢 **Possible** | Official Cloud API + approved templates + opt‑in |
| WhatsApp **group/community as the forum** | 🔴 **Not viable** | Official Groups API caps at 8 members; unofficial libraries violate Meta ToS |
| Replicate DesiSquare's **look & features** | 🟢 **Possible** | Self‑host + rebrand Ghostfolio |
| Copy DesiSquare's **data or any bespoke code** | 🔴 **Not possible** | Only the open‑source app can be replicated, not their content |

Legend: 🟢 fully supported · 🟡 possible with real engineering · 🟠 possible but expensive/fragile · 🔴 not feasible / not sanctioned.

---

## 2. What the demo site actually is, and what "give me what's in it" means

**`desisquare-production.up.railway.app` is a self‑hosted, rebranded [Ghostfolio](https://github.com/ghostfolio/ghostfolio) deployment on Railway.** Ghostfolio is an open‑source **wealth‑management / portfolio‑tracking** web app (Angular front end + NestJS back end + Prisma + PostgreSQL + Redis, delivered as a PWA). The `*.up.railway.app` host is Railway's default deployment subdomain, and Railway publishes a one‑click Ghostfolio template — consistent with what you shared.

> **One honest caveat.** Our automated inspection could not load the live DOM (the site returns `403` to non‑browser fetches — normal for a browser‑only SPA behind a proxy), so any *DesiSquare‑specific* customization beyond stock Ghostfolio can't be confirmed from here, and the exact URL‑routing scheme couldn't be verified against the running site. That doesn't change the conclusion — it *is* a rebranded Ghostfolio — but it means a short live walkthrough with you should be step one, to catch any bespoke screens that would add scope.

**What a visitor to a stock Ghostfolio (and therefore DesiSquare) gets** — this is the feature set "replicate the example" scopes to:

- **Home / summary dashboard** — net worth, performance, gainers/losers.
- **Portfolio** — holdings, activities (buy/sell/dividend), **allocations**, **X‑ray analysis**, benchmarks, a **FIRE** (financial‑independence) calculator (marked experimental).
- **Accounts** — multiple accounts/platforms, CSV/JSON import‑export.
- **Watchlist**, **dividends**, **Zen mode** (distraction‑free), **dark mode**, and **public portfolio sharing** via a read‑only link.
- **Settings / membership**, admin area (users, data providers, market data, a system‑message banner).
- A **REST API** (bearer token) and, since v2.222 (Dec 2025), **experimental OIDC login** — the two hooks we'll use for SSO and WhatsApp glue.

**So "I want what is in the example site shared" concretely means:**

1. **Self‑host Ghostfolio** on infrastructure you control (Docker Compose: app + PostgreSQL + Redis).
2. **Rebrand it** DesiSquare‑style — name, logo, colour palette, favicon, domain.
3. **Wire it into** the forum (shared login) and WhatsApp (notifications).

**What cannot be cloned:** DesiSquare's *own member data*, and any *bespoke code they wrote* that isn't in upstream Ghostfolio. You can only replicate the open‑source application, then populate and brand it yourself. (Also: their brand name/logo are theirs — you'd use your own.)

---

## 3. Discourse — can the skin & appearance be customized? (Yes.)

### 3.1 The theme system: how far "pure theming" goes

Discourse ships a **first‑class, git‑native theming system** that reskins almost the entire UI **without a single line of server‑side code**. This is the answer to "can appearance be customized" — emphatically **yes**, and further than most people expect.

- **Themes vs Theme Components.** A *Theme* is a complete selectable skin; a *Theme Component* is a reusable module (e.g. "brand header", "category cards") that attaches to a parent theme. You compose the DesiSquare skin from a base theme plus modular components, each independently versioned and updatable.
- **Colour palettes / design tokens.** Colours are ten semantic keys (`primary`, `secondary`, `tertiary`, `quaternary`, `header_background`, `highlight`, `danger`, `success`, `love`, …), now exposed as **CSS custom properties** (`var(--primary)`, `var(--tertiary)`, tonal shades like `var(--primary-low)`). Each theme can carry a **light *and* dark palette**, user‑selectable, with automatic OS `prefers-color-scheme` switching.
- **SCSS + HTML injection.** `common/ desktop/ mobile/` stylesheets plus injection points (`header.html`, `after_header.html`, `footer.html`, `head_tag.html`, `body_tag.html`); bundled fonts, logos, favicons via `assets/`; admin‑editable knobs via `settings.yml`.
- **Real dev workflow.** The **`discourse_theme` CLI** (`new`/`download`/`watch`/`upload`) gives hot‑reload against a scratch site; **[theme‑creator.io](https://theme-creator.io)** is a free hosted Discourse for authoring themes without your own instance. Themes install **from a git URL** (one‑click "Update" pulls the latest commit) — clean version control for the client's brand.

> ⚠️ **Dark‑mode footgun:** any custom SCSS that hard‑codes hex values or uses legacy `$`‑SCSS colour variables (instead of `var(--primary)` etc.) will render wrong under a dark palette. Author the DesiSquare theme against CSS custom properties from day one.

### 3.2 Building Discourse from *your wireframe* — the honest, tiered answer

This is the crux of your question. Discourse themes also ship **JavaScript** that uses Discourse's client APIs — **plugin outlets / connectors**, value/DOM transformers, and Glimmer/Ember component overrides — so pure theming can re‑*layout*, not just re‑*colour*. But there is a real ceiling. Here is the truthful breakdown:

| Wireframe element | Feasibility | Mechanism |
|---|---|---|
| Brand colours, typography, spacing, buttons, cards | 🟢 Fully | SCSS + palettes |
| Custom **header / top nav / navbar** | 🟢 Fully | Theme components + header injection |
| Bespoke **homepage / landing page** replacing the topic list | 🟢 Fully | Official **`custom-homepage`** feature (`discovery.custom` route + outlet) |
| Custom **sidebar** sections & links | 🟢 Fully | Admin "custom sidebar sections" + JS Plugin API |
| Banner / hero blocks, injected brand sections | 🟢 Fully | Existing plugin outlets |
| Restyling topic lists, cards, category presentation | 🟢 Fully | SCSS scoped by `body.category-<slug>` |
| Moving/replacing a region **that has a plugin outlet** | 🟢 Mostly | Wrapper outlet (`{{yield}}` re‑renders original) |
| Restructuring a region **with no outlet** | 🟠 Costly | `api.modifyClass` / component override — couples to core internals, breaks on upgrade |
| Whole‑template markup rewrites | 🔴 Avoid | `.hbs` template overrides were **deprecated Nov 2024**; the `.hbs` extension itself is slated for removal — mortgages every future upgrade |
| A genuinely **new server‑backed page/route** (custom data) | 🔴 Not a theme | Requires a **Ruby plugin** (`add_route`) → pushes you to self‑hosting/Enterprise |

**Verdict:** *"Can we make Discourse match your wireframe?"* → **Yes for branding, homepage, navigation, sidebar, hero/section blocks and card/list styling — which is 80–90% of what a community landing + forum wireframe usually specifies.** Treat the wireframe as **design direction, not a pixel contract**: a handful of screens may need `modifyClass` (priced as higher‑risk, with an upgrade‑testing retainer), and anything that is *new functionality* crosses into plugin territory. Two 2025–26 realities to design around: (1) the **Glimmer migration** is mid‑flight — build only against Glimmer‑era APIs, never the deprecated legacy "widget" system (`api.decorateWidget`, widget header/post‑menu hacks); (2) a wrapper outlet can have only **one** active claimant, so stacking components that fight over the same region will conflict.

### 3.3 Plugins, hosting, SSO, licensing, mobile

- **Plugins.** A large official ecosystem (**Data Explorer**, **Gamification**/leaderboards, **Solved**, **Events**, **Subscriptions/Patreon**, and the built‑in **Chat**). Custom plugins are real Ruby + Ember engineering, and each Discourse core upgrade can break custom code — an ongoing maintenance line item, not a one‑time build.
- **Built‑in Chat.** Discourse ships a native, GA (since 2022) **real‑time Chat** (public channels, DMs, threads, category‑permission aware, ~90‑day default retention). This can cover *on‑platform* real‑time chat and reduce dependence on WhatsApp — but it is in‑app only, not a substitute for WhatsApp's mobile push reach.
- **Hosting.** The only supported install is **Docker via `launcher`** (needs PostgreSQL, Redis 7, ~2 GB+ RAM, and a transactional SMTP provider for email). **Managed Discourse hosting** tiers roughly: Starter ~$20/mo (themes only, no plugins), Pro ~$100/mo (custom themes + a curated plugin list), Business ~$500/mo, Enterprise custom. **Arbitrary custom plugins generally require Business/Enterprise — so heavy customization means self‑hosting.** ✅ *(verified)*
- **SSO.** **DiscourseConnect** (formerly "Discourse SSO") lets Discourse be a provider *or* consumer, but it's a **proprietary HMAC protocol, not OIDC**. Discourse also **bundles an OpenID Connect plugin** and an OAuth2 plugin (as a *consumer*). → For a multi‑app stack, the clean pattern is an **external OIDC IdP** that both Discourse and Ghostfolio consume (see §5).
- **Licence.** Discourse core is **GPLv2**. Commercial use is fine; but any *distributed* derivative/plugin must be source‑available. Private in‑house plugins you never distribute don't trigger the obligation.
- **Mobile.** Strong **PWA** with reliable web‑push on Android/desktop (iOS historically weaker); an official DiscourseHub app exists, and a white‑label single‑site native app path exists if guaranteed iOS push is a hard requirement.

---

## 4. Ghostfolio — can *its* skin be customized? (Yes, but this is the hard part.)

### 4.1 The blunt truth: no white‑label system, so customization = a fork

Unlike Discourse, **Ghostfolio has no runtime theming/branding/white‑label admin panel.** Its admin area manages users, data providers, market data and a system banner — **not appearance**. Its documented configuration surface is entirely infrastructure/security environment variables (`DATABASE_URL`, `REDIS_*`, `ACCESS_TOKEN_SALT`, `JWT_SECRET_KEY`, data‑provider keys) — **there is no env var for app name, logo, colours, or theme.** ✅ *(verified)*

Concretely:

- **Brand colours** live as CSS custom properties / an Angular Material Sass theme in `apps/client/src/styles.scss`, **compiled at build time** — changing them means editing SCSS and rebuilding.
- **The name "Ghostfolio"** is hard‑coded as the default in the logo component; the **logo is an inline SVG** in that component. Renaming/re‑logoing edits source.
- Therefore **any real rebrand (the DesiSquare skin) = edit the Angular source + rebuild a custom Docker image + maintain a fork.**

**DesiSquare proves the *reskin* is achievable** (name + logo + palette) — that's the good news. The bad news is what comes after.

### 4.2 The fork‑maintenance burden — the #1 hidden cost of the whole project

Ghostfolio releases **very frequently — on the order of ~100 tagged releases per year** (e.g. roughly v2.140 in Feb 2025 → v2.240 in Feb 2026). Because your customizations live *inside the same source files* as upstream (no isolated theme layer), **every upgrade risks merge conflicts** in the SCSS/components you edited. This is a **permanent recurring cost**, realistically **1–3 engineer‑days/month**, which frequently **exceeds the combined infra + email + market‑data bill.** Under‑scope it and you end up with a stale, unpatched, security‑exposed fork.

**Feasibility for a wireframe:**

| Ghostfolio change | Verdict |
|---|---|
| Name, logo, favicon, manifest, OG images | 🟡 Fork, but bounded and cheap |
| Colour palette / typography | 🟡 Fork (`styles.scss` rebuild) |
| Hide/remove features | 🟡 Fork, low risk |
| Pixel‑match an arbitrary wireframe layout | 🟠 High effort — rewriting Angular Material component layouts; fragile on every upgrade; easy to under‑price |

**Recommendation (this is the load‑bearing one):** **Scope Ghostfolio as a *bounded reskin* — palette, logo, name, favicon, feature‑hiding — NOT a wireframe‑driven layout rebuild.** Push all bespoke, wireframe‑specific UI into **Discourse** (which has the upgrade‑safe theme system) and present Ghostfolio as an **embedded/linked portfolio module in its near‑native look**. Validate the reskin effort with a small spike (fork → recolour + relogo + rename → build image → deploy) before any fixed‑price commitment.

### 4.3 Hosting Ghostfolio for a *community* — design cautions

- **Stack:** Docker Compose = app + **PostgreSQL** (the only thing needing backups) + **Redis** (rebuildable cache). Size ~4 GB RAM / 2 vCPU. First user created becomes **admin**. Set `TRUST_PROXY=1` behind a reverse proxy.
- **Secrets:** `ACCESS_TOKEN_SALT` + `JWT_SECRET_KEY` are required; rotating the salt invalidates all existing tokens.
- **Identity:** Ghostfolio's *native* login is an anonymous **security token** (no email/username, **no account recovery** — lost token = lost account) — **unacceptable UX for a large community.** It also supports Google OAuth and, since **v2.222 (Dec 2025), experimental OIDC**. → Don't use native tokens for the community; put an **external OIDC IdP** in front (see §5).
- **Multi‑tenancy caution:** Ghostfolio is built for **personal/household** use. **All users share one database with application‑level (not tenant‑level) isolation.** For a community storing members' **financial data**, a single authorization bug could leak one member's portfolio to another — **a materially higher privacy/liability exposure than a forum.** Require explicit per‑user isolation security testing and a privacy review before opening it up.
- **Market data:** ✅ *(verified/corrected)* Live quotes work **out of the box for free, no API key** via **Yahoo Finance** (equities/ETFs/FX) and **CoinGecko** (crypto). *However*, Yahoo is an **unofficial, rate‑limited, SLA‑free** endpoint (legally grey for commercial use, and often thin on Indian tickers). For a production community — reliability, and **Indian‑equity / mutual‑fund coverage** — budget a paid provider (**EOD Historical Data** or **Financial Modeling Prep**, ~$20–80/mo) via the `API_KEY_*` env vars. The premium aggregated "GHOSTFOLIO" feed is **Cloud‑only** and cannot be used self‑hosted.

### 4.4 The licence you must accept: AGPLv3

Ghostfolio is **AGPLv3**. ✅ *(verified against the repo LICENSE)* Its Section 13 ("Remote Network Interaction") means: **if you run a *modified* version as a network service, you must offer your users the complete corresponding source of your modified version.** A rebranded/customized DesiSquare fork, hosted publicly, **triggers this** — you cannot keep your modifications closed‑source. Practical implications:

- Running *unmodified* upstream as a service does **not** by itself require re‑publishing source. **Rebranding/theming that alters covered source *does* count as modification.**
- The duty is to **your service's users**, satisfiable by a prominent **source link** (e.g. in the app footer).
- **Trademark ≠ copyright:** AGPLv3 grants no rights to the "Ghostfolio" name/logo — a rebrand must fully strip upstream trademarks regardless.
- Keep Ghostfolio (AGPLv3) and Discourse (GPLv2) as **separate services with no code‑combining** — the two copyleft licences are incompatible in one combined work.
- **Action:** get the client's product/legal owner to **accept the source‑disclosure obligation in writing** before any heavy customization, and have OSS counsel review the exact scope.

---

## 5. WhatsApp — the reality check, and why it cannot be the forum

### 5.1 What the official API *can* do

The **WhatsApp Business Cloud API** (the On‑Premises API is fully sunset as of Oct 2025) is the only sanctioned automation path. It is designed for **business ↔ user** messaging:

- **Free‑form (session) messages** only inside a **24‑hour customer‑service window** that opens when the user messages you.
- Outside that window, you may only send **pre‑approved template messages** in one of four categories — **marketing / utility / authentication / service**.
- **Pricing** ✅ *(verified)*: since **1 July 2025**, Meta bills **per delivered message** (per category, per recipient country), replacing the old conversation model. **Service (user‑initiated) messages are free**, and **utility templates inside an open 24‑hour window are free**; **marketing** templates are always billed and get no volume discount. **Marketing templates to US (+1) numbers have been paused since April 2025.**
- **Opt‑in is mandatory** for business‑initiated messages (named business, no pre‑checked boxes, separate consent for promotional vs transactional, STOP opt‑out).
- Messaging limits ramp with verification/quality (250 → 1,000 → 10k → 100k → unlimited recipients/24h).

**So WhatsApp is excellent as:** an **opt‑in notification channel** (new‑reply alerts, watchlist/price alerts, weekly digests) and a **two‑way support/Q&A bot** — via a reputable BSP (360dialog or Gupshup are cost‑efficient for an India‑heavy audience; Twilio/WATI are easier but marked‑up; Meta‑direct has no per‑message markup but you own more integration/compliance work).

### 5.2 What it *cannot* do — the group limitation (the correction that matters most)

You may have read that "WhatsApp has no group API." **That is now out of date, and it's important to state it accurately:** Meta launched an **official Groups API** inside the Cloud API in **October 2025** (beta). It lets a business **create groups, send text/media/template messages into them, and read inbound member messages via webhooks.** ✅ *(verified)*

**But it does not solve a community forum, for four hard reasons:**

1. **8‑member hard cap per group** (admin + up to 7 users). Up to ~10,000 such groups per number — it's a *concierge/small‑support‑thread* tool, **not a community discussion surface.**
2. **Business‑created groups only.** It **cannot** import, join, read, or control a **pre‑existing** consumer WhatsApp group or Community — so an existing DesiSquare WhatsApp group can't be adopted by the API.
3. **Requires an Official Business Account (green tick)** + high‑volume eligibility — a new build likely won't qualify for a while.
4. The consumer **WhatsApp Communities** feature (umbrella of groups + Announcement channel, up to ~5,000 members) has **no public API** to create/post/manage programmatically.

**And the unofficial route is a trap.** Libraries like **Baileys** and **whatsapp‑web.js** (and services built on them) *can* post to arbitrary groups/Communities — by pairing a real number via the WhatsApp‑Web protocol — but this **explicitly violates Meta's Terms of Service and risks permanent, unappealable number bans** that would take the whole community offline overnight. **BiGMo will not warrant a build on these**; if the client insists, it must be flagged as a client‑owned, ToS‑violating, ban‑risk decision.

### 5.3 The right messaging model: hybrid, not WhatsApp‑only

| Need | Best channel |
|---|---|
| The actual **forum / threaded discussion** | **Discourse** (this is what it's for) |
| **On‑platform real‑time chat** | **Discourse Chat** (built‑in) |
| **Opt‑in push notifications & alerts to phones** | **WhatsApp** Cloud API (utility templates, free‑where‑possible) |
| **Cost‑free community broadcast at scale** | **Telegram** (free Bot API; channels unlimited, groups to 200k) ✅ *(verified: far more group‑friendly than WhatsApp; note bots need "privacy mode" disabled to read group messages)* |
| **Two‑way support Q&A** | WhatsApp bot inside the 24‑hour window |

> **Reach reality:** in India (the core desi market) WhatsApp has ~5× Telegram's user base (~535M vs ~104M), so WhatsApp wins on *reach* even though Telegram wins on *programmability*. Use both for what each is good at, and keep **email** as a delivery fallback so notifications don't depend solely on WhatsApp template approval/quality‑rating.

---

## 6. Reference architecture — how the three become one product

```
                         ┌────────────────────────────────────────────┐
                         │        Members (web + mobile PWA)           │
                         └───────────────┬────────────────────────────┘
                                         │  one login, one brand
                         ┌───────────────▼────────────────┐
                         │  Reverse proxy (Caddy/Traefik)  │  *.desisquare.com, TLS
                         └───┬───────────────┬─────────────┘
        community.desisquare │               │ app.desisquare.com
                     ┌───────▼──────┐   ┌─────▼───────────┐
                     │  DISCOURSE   │   │   GHOSTFOLIO    │
                     │ forum+chat   │   │ portfolio (fork)│
                     │ (theme=brand)│   │ (reskin only)   │
                     └───┬──────────┘   └─────┬───────────┘
              webhooks   │  OIDC             OIDC │  REST API (poll)
                     ┌───▼───────────────────────▼───┐
                     │   OIDC IdP  (Keycloak /        │  ← single source of identity
                     │   Authentik) — master login    │     (email/phone mapping lives here)
                     └───┬───────────────────────────┘
                         │ events + identity
                     ┌───▼───────────────┐
                     │  Automation hub    │  n8n: dedupe/log events,
                     │  (n8n)             │  map → template + phone number
                     └───┬───────────┬────┘
             ┌───────────▼──┐   ┌────▼─────────┐   ┌───────────┐
             │ WhatsApp     │   │  Telegram    │   │  Email    │
             │ Cloud API    │   │  Bot API     │   │ (SMTP)    │
             │ (BSP)        │   │              │   │           │
             └──────────────┘   └──────────────┘   └───────────┘
```

**Design decisions that make this work:**

1. **Identity: one external OIDC IdP** (Keycloak recommended; Authentik/Auth0 acceptable). Both Discourse (bundled OIDC plugin) and Ghostfolio (`ENABLE_FEATURE_AUTH_OIDC`) consume the **same issuer**. **Do *not* try to make Discourse the master IdP for Ghostfolio** — DiscourseConnect is proprietary and Ghostfolio only speaks OIDC, so that path is brittle custom glue. The IdP is also the **authoritative store for each member's phone number**, so WhatsApp notifications route correctly.
2. **Navigation: one domain, subdomains behind a reverse proxy** (`community.` + `app.`), cookies scoped to `*.desisquare.com`. Perceived unification comes from a **shared injected top‑nav/header** (a Discourse theme component + a Ghostfolio Angular shell/CSS override), **not iframe embedding** — Discourse's `SAMEORIGIN` framing and Ghostfolio's SPA auth cookies both break in cross‑origin frames.
3. **Events → notifications: n8n as the hub.** Discourse emits **per‑event webhooks** (new topic/reply/etc.); Ghostfolio has **no outbound webhooks**, so portfolio "events" require **polling its REST API** on a schedule and diffing state. n8n dedupes/logs and maps each event to the right **WhatsApp template + IdP‑resolved phone**, with Telegram/email fallbacks.
4. **Keep the services decoupled** (separate DBs, no code‑combining) — good architecture *and* keeps the AGPLv3/GPLv2 licences from entangling.

**Hardest integration seams to budget for:** the experimental Ghostfolio OIDC path (pin the version, keep token login as fallback, QA it hard); the Ghostfolio polling‑for‑events logic (latency + missed/duplicate risk); and the identity↔phone‑number mapping.

---

## 7. Cost, timeline & phased delivery

> Figures are planning estimates (USD unless noted), stated with assumptions; firm numbers follow a live demo walkthrough and a Ghostfolio reskin spike.

### 7.1 One‑time build effort

| Workstream | Effort (eng‑weeks) | Notes |
|---|---|---|
| Discourse theme from wireframes (branding, homepage, nav, sidebar) | 2–4 | Higher if screens need `modifyClass` |
| Ghostfolio **bounded reskin** (name/logo/palette/favicon) + build pipeline | 1–2 | Balloons if a layout rebuild is demanded |
| WhatsApp Business onboarding + notification/bot integration | 1.5–3 | Includes template design + opt‑in flow |
| SSO (external OIDC IdP → both apps) | 1.5–3 | Ghostfolio OIDC is experimental → extra QA |
| Automation/notification hub (n8n) + Ghostfolio polling | 1.5–3 | Event mapping, dedupe, fallbacks |
| Infra, reverse proxy, backups, email deliverability, hardening | 1.5–3 | |
| **Total** | **~9–19 eng‑weeks** | ≈ **$25k–$65k** one‑time, blended rate |

### 7.2 Monthly run cost

| Item | Est. / month |
|---|---|
| Self‑host infra (e.g. 2× Hetzner CPX‑class: Discourse; Ghostfolio+DB+Redis) incl. backups/storage | **$60–110** |
| Transactional email (SMTP provider) | $0–20 |
| Market‑data provider (EOD/FMP) — *only if Indian coverage needs it* | $20–80 |
| WhatsApp messaging (per‑message; scales with members × frequency) | **variable** — see below |
| **Ghostfolio fork maintenance (1–3 eng‑days/mo)** | **$1.5k–5k** ← *usually the biggest line* |

**WhatsApp cost sensitivity (India rates, illustrative):** utility/auth templates ≈ ₹0.115 (~$0.0014) each; marketing ≈ ₹0.86 (~$0.011) each, **+18% GST + ~10–30% BSP markup**; user‑initiated replies within 24h are **free**. A 20,000‑member base with **weekly marketing** blasts can run **$900–1,200/mo**; **mis‑classifying** what should be utility as marketing multiplies cost ~8×. → **Engineer notifications as *utility* templates wherever legitimate, and exploit the free service window.**

**The headline TCO insight:** on this stack the **Ghostfolio fork‑maintenance retainer and the WhatsApp marketing spend are the dominant ongoing costs — not servers.** Budget them **explicitly and visibly** in the contract; never fold fork‑maintenance into a flat build fee.

### 7.3 Recommended phased roadmap

- **Phase 0 — Foundations (weeks 1–3).** Self‑host stock Discourse + stock Ghostfolio on hardened infra behind the reverse proxy; email deliverability; backups; the OIDC IdP with both apps wired in. *Ship the plumbing before the paint.*
- **Phase 1 — MVP (weeks 3–7).** DesiSquare **brand** on Discourse (theme from wireframes: homepage, nav, palette) + **bounded Ghostfolio reskin**; **WhatsApp utility‑only** notifications with a proper opt‑in flow; disclaimers live everywhere.
- **Phase 2 — Depth (weeks 7–12+).** Gamification/subscriptions/events plugins as needed; marketing‑category WhatsApp digests (with consent) + Telegram broadcast; richer notification hub; *only now* consider any deeper Ghostfolio fork work **if demand is validated.**
- **Ongoing.** Fork‑maintenance retainer; Discourse core‑upgrade regression testing; WhatsApp quality‑rating monitoring; compliance review cadence.

---

## 8. Compliance & regulatory guardrails (do not skip this)

This is an **investment community**, which puts it in the most heavily‑scrutinized content zone. These are **considerations to confirm with qualified counsel in each jurisdiction — not settled legal advice.**

- **SEBI / "finfluencer" risk (India) — the single biggest legal exposure.** SEBI's Aug 2024 amendments and Jan 2025 circular **bar regulated entities from associating with unregistered advice‑givers** and restrict finfluencers to lagged market data; a Dec 2025 order against a prominent educator **impounded ₹546+ crore** for disguised unregistered advisory. "Educational" framing is **not** a safe harbour if staff/featured contributors give buy/sell calls, sell "model portfolios" as recommendations, or imply guaranteed returns. **Mitigation:** position the product as **educational discussion + self‑directed portfolio tracking only**; prohibit personalized recommendations and return guarantees in Terms + moderation policy; have **Indian securities counsel** confirm whether any *paid* tier needs SEBI RIA/Research‑Analyst registration.
- **Open‑source licences.** **Ghostfolio = AGPLv3** (publish your modified source to users, or confine changes to config/theming, or seek a commercial licence). **Discourse = GPLv2** (no network‑use trigger; distribution‑only copyleft). **Keep them as separate services** — the licences are incompatible if code‑combined.
- **WhatsApp / Meta Business policy.** Explicit named opt‑in, no pre‑checked boxes, separate promotional consent, STOP opt‑out; **marketing templates to US (+1) numbers are blocked** since April 2025 → use utility/auth or email for US members.
- **Data privacy.** Members' **portfolio data reveals net worth** — practically sensitive even where not a GDPR "special category." Comply with India's **DPDP Act 2023** (Rules notified 13 Nov 2025: standalone purpose‑specific consent, grievance officer, likely **Significant Data Fiduciary** duties for a large financial platform); add **GDPR** notice + data‑subject‑rights flow if EU/UK members join. Encrypt at rest and in transit; minimize retention; govern Ghostfolio's **public‑sharing** feature (default **off**, explicit opt‑in, rotatable access IDs).
- **Pervasive disclaimers.** *"Not investment advice — educational only; no guaranteed returns; past performance is not indicative of future results"* on **every** page, portfolio view, and WhatsApp broadcast; require contributor conflict/holdings disclosure.

---

## 9. Alternatives & build‑vs‑buy (so the recommendation is defensible)

| Layer | Chosen | Why it wins here | Notable alternatives |
|---|---|---|---|
| **Forum** | **Discourse** | Only option combining heavy customization + data ownership + mature REST API + SSO. Bundled Chat cuts a moving part. | Flarum (MIT, lighter fallback), NodeBB, Forem; **all‑in‑one SaaS** Circle.so ($49–399/mo, closed, no embedding), Skool ($99/mo flat), Mighty Networks, Bettermode ($399+/mo) |
| **Portfolio** | **Ghostfolio** | It's literally what the demo is; self‑hostable, feature‑rich. AGPLv3 + fork burden are the costs. | Maybe Finance (**archived Jul 2025**, community "Sure" fork), Firefly III (budgeting, *not* portfolio), Wealthfolio/Portfolio Performance (desktop, not hostable) — **few credible fallbacks**, so accept a single‑vendor dependency |
| **Messaging** | **WhatsApp + Telegram + Discourse Chat** (hybrid) | WhatsApp = reach; Telegram = free programmable broadcast; Chat = on‑platform | Slack/Discord (weaker for a retail‑investor consumer audience) |

**When would an all‑in‑one (Circle/Skool/Mighty) beat this assembly?** Only if the client **relaxes the custom‑wireframe and native‑portfolio requirements** in exchange for far lower engineering cost and zero ops. Given you explicitly want **your wireframe's look** *and* **the Ghostfolio portfolio experience**, the Discourse + Ghostfolio + WhatsApp assembly is the **defensible choice** — but document that trade‑off so it's an informed decision.

---

## 10. Final recommendations

1. **Green‑light the build — as an integration project, phased.** Foundations → branded MVP → depth (§7.3). Don't attempt everything at once.
2. **Discourse carries the bespoke UI.** Deliver the DesiSquare look as a **git‑hosted Discourse theme + components** from your wireframes (homepage, nav, sidebar, palette, hero blocks). This is the upgrade‑safe, high‑leverage surface. Treat the wireframe as **direction, not a pixel contract**; price any `modifyClass`/plugin work separately with an upgrade retainer.
3. **Ghostfolio stays close to stock — reskin only.** Palette + logo + name + favicon; **no wireframe layout rebuild.** Validate with a spike. **Budget the fork‑maintenance retainer visibly.** Get **written client acceptance of AGPLv3** source‑disclosure first.
4. **WhatsApp is a notification/support channel, never the forum.** Official Cloud API, **utility‑first** templates, real opt‑in, cost modelling. Add **Telegram** for free broadcast and **email** as fallback. Exclude unofficial WhatsApp bridges from the proposal.
5. **One external OIDC IdP** (Keycloak/Authentik) as the single login for both apps; **shared injected header**, not iframes; **n8n** as the events‑to‑notifications hub.
6. **Self‑host** (Hetzner/DO‑class) for full plugin/theme control — managed Discourse tiers won't allow the customization you want at a reasonable price.
7. **Bake in compliance from day one:** educational‑only positioning, pervasive "not advice" disclaimers, correct WhatsApp opt‑in, DPDP/GDPR handling, and a securities‑counsel review before any paid advisory‑adjacent tier.
8. **First two concrete steps:** (a) a **live walkthrough of DesiSquare** with you to lock the exact scope of "what's in the example," and (b) a **1‑week Ghostfolio reskin spike** to convert the fork estimate from a range into a firm number.

---

## 11. What we double‑checked (adversarial verification log)

The following high‑stakes claims were independently fact‑checked against primary sources; three produced **corrections** now reflected above.

| # | Claim | Verdict |
|---|---|---|
| 1 | Official WhatsApp API can't touch group chats | 🟡 **Corrected** — an official **Groups API** exists (Oct 2025) but caps at **8 members**, business‑created only, green‑tick gated → still not a forum |
| 2 | Automating groups needs ToS‑violating unofficial libraries | 🟡 **Corrected** — an official (but 8‑member) path now exists; unofficial libs remain ToS‑violating/ban‑risk for community‑scale |
| 3 | WhatsApp moved to per‑message pricing (Jul 2025), templates + opt‑in | 🟢 Confirmed |
| 4 | Ghostfolio is AGPLv3 → network‑use source‑disclosure | 🟢 Confirmed |
| 5 | Discourse GPLv2; deep theming yes, but restructuring beyond outlets needs a plugin | 🟢 Confirmed |
| 6 | Ghostfolio has no runtime white‑label → fork + rebuild + upgrade burden | 🟢 Confirmed (even the app name is hard‑coded) |
| 7 | Discourse supports DiscourseConnect + OIDC/OAuth for SSO | 🟢 Confirmed (DiscourseConnect is proprietary; use external OIDC) |
| 8 | The demo is a rebranded Ghostfolio on Railway | 🟡 **Nuanced** — yes it's rebranded Ghostfolio on Railway; exact routing couldn't be confirmed live (403), and standard Ghostfolio uses path (not hash) routes |
| 9 | Discourse has built‑in real‑time Chat | 🟢 Confirmed (must be enabled by admin; in‑app only) |
| 10 | Telegram Bot API is far more group‑friendly than WhatsApp | 🟢 Confirmed (WhatsApp still wins reach ~5:1 in India; bot needs privacy‑mode off to read groups) |
| 11 | Ghostfolio needs Postgres+Redis; real quotes need paid keys | 🟡 **Corrected** — Postgres+Redis yes; **free Yahoo/CoinGecko give live quotes with no key**; paid keys only for reliability/Indian coverage |
| 12 | Discourse managed hosting gates custom plugins to higher tiers | 🟢 Confirmed (custom plugins → Business/Enterprise or self‑host) |

---

## Appendix A — Wireframe → Discourse feasibility cheat‑sheet

When you share the wireframe, each element maps to one of three effort tiers — use this to triage before quoting:

- **Tier 1 — pure theme (cheap, upgrade‑safe):** colours, fonts, logo, header/nav, custom homepage, sidebar sections, hero/section blocks, card & topic‑list styling, light/dark palettes.
- **Tier 2 — theme JS / `modifyClass` (moderate, upgrade‑sensitive):** moving or replacing a region that has a plugin outlet; component overrides. Price with a regression‑test retainer.
- **Tier 3 — custom Ruby plugin (expensive, forces self‑host):** any **new server‑backed page/route or new data model**.

## Appendix B — Key source references

Discourse: developer docs (themes, theme structure, designers' guide, theme‑creator, plugin outlets), `github.com/discourse/discourse` (LICENSE, `color_definitions.scss`), `meta.discourse.org` (dark‑mode palettes, custom homepage, DiscourseConnect, hosting tiers, Chat). Ghostfolio: `github.com/ghostfolio/ghostfolio` (LICENSE=AGPLv3, `styles.scss`, `.env.example`, OIDC feature flag, release history), project docs (data providers, self‑hosting). WhatsApp: `developers.facebook.com` Business/Cloud API docs (pricing update 1 Jul 2025, template categories, Groups API Oct 2025, opt‑in policy). Telegram: core Bot API docs. Compliance: SEBI circulars (Aug 2024 / Jan 2025) and 2025 enforcement, India DPDP Act 2023 + Rules (Nov 2025), GDPR, US Investment Advisers Act 1940. Full per‑claim source URLs are retained in BiGMo's research record and available on request.

---

*This report is an engineering/feasibility advisory prepared for scoping purposes. Legal, securities‑regulatory, tax, and data‑protection points are flagged as considerations to confirm with qualified counsel in each relevant jurisdiction; they are not legal advice.*
