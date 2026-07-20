# DesiSquare — Seamless Delivery Playbook

### How to build Discourse + Ghostfolio + WhatsApp so it feels like *one* product and runs smoothly for years

> **Companion to:** `discourse-ghostfolio-whatsapp-community-forum-feasibility.md`
> **Prepared by:** BiGMo Consulting · **Date:** 18 July 2026

---

## The organizing idea: "seamless" = remove the seams

You are assembling three systems that were never designed to know about each other. To a member it must feel like **one login, one brand, one place**. To your ops team it must **upgrade without drama**. Everything that follows is about making the **five seams** between these systems invisible:

| # | Seam | "Smooth" looks like | The friction if ignored |
|---|---|---|---|
| 1 | **Identity** | One login works everywhere; accounts appear automatically | Members maintain two passwords; support tickets; drop-off |
| 2 | **Look & navigation** | Forum and portfolio are visually indistinguishable; one nav | Two apps that obviously aren't the same product |
| 3 | **Data & notifications** | The right alert reaches the right phone, once | Missed/duplicate alerts; WhatsApp cost blowout |
| 4 | **Upgrades & maintenance** | Monthly upgrades are boring and safe | Stale, insecure fork; upgrades become scary events |
| 5 | **Onboarding & compliance** | Members join in minutes, consent captured cleanly | Meta verification blocks launch; regulatory exposure |

Get these five right and the whole thing feels seamless. The rest of this document is a concrete, opinionated recipe for each — plus the delivery sequence that de-risks them in the right order.

---

## Seam 1 — Identity: one login, provisioned automatically

**Goal:** a member signs up once and is silently known to the forum *and* the portfolio.

**Do this:**
- Stand up **one external OIDC identity provider** (Keycloak recommended; Authentik acceptable) as the *single source of truth*. Configure **Discourse** via its bundled OpenID Connect plugin and **Ghostfolio** via `ENABLE_FEATURE_AUTH_OIDC=true` (+ `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `ROOT_URL`) — both as *consumers* of the same issuer.
- Turn on **Just-In-Time provisioning** so an account is created in each app on first login — no manual user setup, no "please also register on the portfolio" step.
- Make the IdP the **authoritative store for each member's phone number and notification opt-ins** — this is what makes Seam 3 reliable later. Capture the phone at signup, verified by a one-time code.
- Keep Ghostfolio's native **security-token login enabled as a break-glass fallback** (`ENABLE_FEATURE_AUTH_TOKEN`) but hide it from the member UI — it has no account recovery and is unacceptable as the primary path.

**Smoothness guardrails:**
- Ghostfolio's OIDC is **experimental (since v2.222, Dec 2025)** and does **not** propagate roles/groups. Treat **Discourse groups + trust levels** as the authority for community roles/moderation, and don't rely on Ghostfolio for authorization tiers.
- **Do not** try to make Discourse the master identity provider for Ghostfolio — DiscourseConnect is a proprietary protocol and Ghostfolio only speaks OIDC; that path is brittle custom glue. The external IdP is the smooth path.
- Scope one parent domain and **cookie/session to `*.desisquare.com`** so sessions survive moving between subdomains.

---

## Seam 2 — Look & navigation: one brand across two codebases

This is the seam most people get wrong, and the one that most makes or breaks "seamless." Discourse and Ghostfolio style themselves completely differently — the trick is a **single brand contract** that both consume.

**Do this:**
1. **Author one design-token source of truth** from your wireframes — a small file of brand primitives (colour palette, type scale, radius, logo SVG, spacing). This is the *contract*.
2. **Project the same tokens into both apps:**
   - **Discourse:** encode the tokens as the theme's colour scheme + SCSS variables (using CSS custom properties like `var(--primary)` so dark mode stays intact). This is native and upgrade-safe.
   - **Ghostfolio:** apply the *same* hex values into `apps/client/src/styles.scss` (the Angular Material Sass theme) and swap the logo SVG + app name. Because the values are identical, the two apps read as one product.
3. **Build a shared top-nav/header once** and inject it into both — a Discourse theme component and a small Ghostfolio Angular shell/CSS override that render the identical header markup + links (Forum · Portfolio · Community · Profile). The header is what stitches the experience together in the member's eye.
4. **One domain, subdomains behind one reverse proxy** (Caddy is the low-friction choice; Traefik/Nginx fine): `community.desisquare.com` (Discourse) and `app.desisquare.com` (Ghostfolio), one TLS setup, consistent favicon and transactional-email branding.

**Smoothness guardrails:**
- **Do not iframe-embed** one app inside the other for the "unified" feel — Discourse sends `X-Frame-Options: SAMEORIGIN` and Ghostfolio's SPA auth cookies break in cross-origin frames. Unification comes from the **shared header + identical tokens**, not embedding.
- Put the **Discourse bespoke UI first**; keep Ghostfolio a **bounded reskin** (palette + logo + name + favicon + feature-hiding), *not* a wireframe layout rebuild. That single decision keeps Seam 4 (upgrades) cheap.
- Sweep every residual "Ghostfolio" string (page title, PWA manifest, OG tags, transactional emails) so no upstream trademark leaks through.

---

## Seam 3 — Data & notifications: one nervous system

**Goal:** a forum reply or a portfolio event turns into exactly one correctly-routed message, cheaply.

**Do this:**
- Run **n8n as the central automation hub.** Subscribe to **Discourse per-event webhooks** (new topic, reply, mention, etc.) and **poll Ghostfolio's REST API** on a schedule for portfolio events (Ghostfolio has no outbound webhooks, so polling + state-diffing is required).
- Give every event an **idempotency key** and a small dedupe/log store so a webhook retry or a polling overlap never sends a duplicate — the #1 cause of "spammy" notifications.
- Maintain a **small library of pre-approved WhatsApp templates**, categorized deliberately:
  - **Utility** templates for user-triggered/transactional alerts ("reply to your post", "watchlist price crossed X") — *free* inside an open 24-hour window and cheap outside it.
  - **Marketing** templates only for genuine consent-based digests/promotions — always billed, no volume discount, and **blocked to US (+1) numbers**.
- Resolve the destination phone number from the **IdP** (Seam 1), and always carry a **fallback channel** (email, or Telegram) so a template rejection or quality-rating throttle never means a silent miss.

**Smoothness guardrails:**
- **Classify correctly:** mis-labelling a utility alert as marketing multiplies its cost ~8× and needs extra consent. Design flows that encourage a user reply (which opens the free 24-hour window) so follow-ups are free.
- Treat **template approval lead time as a scheduling dependency** — new notification formats need Meta review (minutes to ~48h) and can be rejected for tone or URL placement. Build the template library early, iterate rarely.
- Log delivery outcomes and watch the **WhatsApp quality rating**; poor opt-in hygiene on financial content can throttle or suspend the number.

---

## Seam 4 — Upgrades & maintenance: keep it smooth *over time*

This is where "seamless at launch" quietly rots into "scary to touch" six months later. The fix is architectural discipline, decided up front.

**Do this — the thin-fork strategy for Ghostfolio (the load-bearing tactic):**
- Treat your Ghostfolio changes as a **thin branding overlay on top of the official upstream image**, not a deep fork. Concentrate *all* customization into the **smallest possible set of files** — ideally one theme/override SCSS file, the logo asset, the app-name/i18n string, and the favicon/manifest. The fewer files you touch, the fewer merge conflicts every upgrade.
- **Pin the Ghostfolio image to a specific version tag.** Adopt a **monthly (or on-CVE) upgrade cadence**: bump the tag in staging, rebuild your branded image, run smoke tests, promote to prod. Ghostfolio runs **Prisma migrations automatically on boot**, so **snapshot PostgreSQL before every upgrade**.
- Keep the **Discourse theme in a git repo** installed by URL so you get **one-click "Update"**; build only against **Glimmer-era APIs and documented plugin outlets** (never the deprecated widget system or `.hbs` template overrides) so core upgrades don't break your theme.
- Stand up a **staging environment that mirrors production** and a simple CI pipeline that rebuilds the branded Ghostfolio image and validates the Discourse theme on every change.

**Smoothness guardrails:**
- **Budget the fork-maintenance retainer visibly** (1–3 engineer-days/month) — it is the largest and most under-estimated ongoing cost; never fold it into a flat build fee.
- **Backups + observability from day one:** scheduled `pg_dump` with off-site retention for both databases; uptime and error monitoring; a one-page **runbook** for the upgrade and restore procedures so it's boring, not heroic.
- Redis is a rebuildable cache (no backup needed); set `TRUST_PROXY=1` behind the proxy so per-IP rate limiting uses the real client IP.

---

## Seam 5 — Onboarding & compliance: smooth for members, clean for regulators

**Do this — and start the slow parts on day one:**
- **Kick off WhatsApp Business onboarding immediately, as a parallel track.** Meta **Business verification, display-name approval, and phone-number setup have unpredictable lead times** and must *not* sit on the build critical path. Complete verification early to lift messaging limits (250 → 1,000+/24h) and warm up volume gradually.
- Build an **explicit, logged double opt-in at signup** — named business, no pre-checked boxes, **separate** consent for transactional vs promotional, STOP opt-out on every template. Store the consent state in the IdP.
- **Bake disclaimers into the product, not a buried Terms page:** *"Educational only — not investment advice; no guaranteed returns; past performance is not indicative of future results"* on every page, portfolio view, and WhatsApp broadcast. Position the product as **educational discussion + self-directed tracking**; prohibit personalized buy/sell calls and return guarantees in the moderation policy.
- Handle members' financial data under **India's DPDP Act** (purpose-specific consent, grievance contact, likely Significant Data Fiduciary duties) and add a **GDPR** notice/flow if EU/UK members join. Default Ghostfolio's **public-sharing feature OFF** with explicit opt-in.

**Smoothness guardrails:**
- Get the client's **written acceptance of the Ghostfolio AGPLv3 source-disclosure obligation** *before* customization begins, and a **securities-counsel review** before any paid advisory-adjacent tier — these are cheap to do early and expensive to retrofit.
- For US members, route notifications through **utility/authentication templates or email**, not marketing (paused to +1 numbers).

---

## The smooth delivery sequence — de-risk in the right order

The order of operations is itself a smoothness lever. **Retire the two riskiest unknowns with spikes before you commit**, then build plumbing before paint.

```
Week 0        ── SPIKES (de-risk the fragile seams)
  ▸ Ghostfolio reskin spike: fork → recolour + relogo + rename → build image → deploy
  ▸ OIDC spike: IdP → Discourse + Ghostfolio both log in via one account
  ▸ START in parallel (long lead time): WhatsApp Business verification + display name

Weeks 1–3     ── PHASE 0 · FOUNDATIONS ("plumbing before paint")
  ▸ Stock Discourse + stock Ghostfolio on hardened infra behind the reverse proxy
  ▸ IdP live, both apps wired in, JIT provisioning, phone capture
  ▸ Transactional email deliverability (SPF/DKIM), backups, staging + CI

Weeks 3–7     ── PHASE 1 · BRANDED MVP
  ▸ Design-token contract → Discourse theme (homepage, nav, palette) + Ghostfolio bounded reskin
  ▸ Shared header injected into both
  ▸ n8n hub + utility-only WhatsApp notifications + double opt-in
  ▸ Disclaimers everywhere · launch to a small closed cohort

Weeks 7–12+   ── PHASE 2 · DEPTH (only after demand is validated)
  ▸ Gamification / subscriptions / events plugins as needed
  ▸ Consent-based marketing digests + Telegram broadcast + richer notifications
  ▸ Any deeper Ghostfolio work — only if a screen truly needs it

Ongoing       ── RUN
  ▸ Monthly Ghostfolio upgrade cadence (staging → snapshot → promote)
  ▸ Discourse core-upgrade regression pass · WhatsApp quality-rating watch
  ▸ Fork-maintenance retainer · quarterly compliance review
```

**Why this order is smooth:** the two spikes convert your biggest estimating risks (fork effort, experimental OIDC) into known quantities *before* a fixed-price commitment; the WhatsApp verification runs in parallel so Meta's timeline never blocks you; and shipping stock apps on solid infra first means the brand work in Phase 1 lands on a stable base instead of a moving one.

---

## Team & cadence

- **A small, senior squad** beats a large one here — the work is integration, not headcount: one full-stack lead (proxy/infra/SSO/n8n), one Discourse/theme engineer, one Angular engineer for the Ghostfolio reskin (part-time after Phase 1), and a compliance/PM owner running the WhatsApp + legal track.
- **Weekly working-demo cadence** against the wireframes — show the running product, not slides. The feasibility report's "wireframe = direction, not a pixel contract" rule keeps these reviews smooth.
- **Definition of done for every screen:** works behind SSO, matches the design tokens, survives a Ghostfolio/Discourse upgrade in staging, and (if it notifies) has an approved template + fallback.

---

## Ten rules to keep it seamless

1. **One brand token file** feeds both apps — never hand-tune colours twice.
2. **Discourse owns the bespoke UI; Ghostfolio stays a bounded reskin.**
3. **One external OIDC IdP** is the single source of identity — never Discourse-as-master.
4. **Shared header, never iframes.**
5. **Every notification is a pre-approved template with a fallback channel** and an idempotency key.
6. **Utility-first** WhatsApp classification; exploit the free 24-hour window.
7. **Thin, isolated Ghostfolio overlay** + pinned versions + snapshot-before-upgrade.
8. **Staging mirrors prod; upgrades are monthly and boring.**
9. **Start WhatsApp verification and legal review on day one** — they're the long poles.
10. **Disclaimers and consent are product features, not afterthoughts.**

---

## What to do this week

1. **Book a live DesiSquare walkthrough** with the client to lock the exact scope of "what's in the example" (our automated inspection hit a 403, so bespoke screens beyond stock Ghostfolio are still unconfirmed).
2. **Run the two spikes** (Ghostfolio reskin + one-account OIDC login) to firm the estimate.
3. **Open the WhatsApp Business verification** and start the securities/DPDP counsel review — the two longest-lead items.
4. **Draft the design-token contract** from the client's wireframe so Phase 1 branding can start the moment foundations are up.

---

*Advisory prepared for scoping purposes. Regulatory, tax, and data-protection points are considerations to confirm with qualified counsel in each relevant jurisdiction; they are not legal advice.*
