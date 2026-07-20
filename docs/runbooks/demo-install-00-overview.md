# DesiSquare Demo Servers — Install Overview & Order of Operations

> **BiGMo Consulting · 19 Jul 2026.** The umbrella document for standing up the full DesiSquare demo: Discourse + Ghostfolio + WhatsApp Cloud API + the three integration scripts, on one VPS. Each numbered runbook is self-contained; this page gives the topology, the order, and the end-to-end acceptance checklist.

## The runbook set

| Doc | Covers | Time (approx.) |
|---|---|---|
| **[01 — Discourse](demo-install-01-discourse.md)** | VPS prep, Docker, `discourse-setup`, SMTP (Brevo), admin + DesiSquare settings (invite-only gate #7, groups, corridors/spaces), reactions/OIDC/chat (now bundled in core), Porcelain Slate theme + palette lockdown, Hot-by-default (F3), webhooks + API key, backups/upgrades | 2–3 h (+ DNS/SMTP propagation) |
| **[02 — Ghostfolio](demo-install-02-ghostfolio.md)** | docker-compose (app + Postgres + Redis, pinned tag), `.env` secrets, first-user-is-admin (security token!), market data (free Yahoo/CoinGecko defaults), demo data + CSV import + public link + Zen mode, experimental OIDC, Caddy for **both** subdomains, `pg_dump` backups, pinned upgrades | 1–2 h |
| **[03 — WhatsApp](demo-install-03-whatsapp.md)** | Meta app + WABA, test number (5 recipients, works **unverified**), permanent system-user token, first sends (template + free-form), webhook handshake + signature validation → wa-bridge, DesiSquare templates (utility `reply_alert`, marketing `weekly_digest` — **US +1 marketing is paused by Meta since Apr 2025**), opt-in/consent (#5), the honest group-mirroring reality, demo→production path | 1–2 h (+ template approval wait) |

**Companions:** user stories (`../desisquare-user-stories.md`, 70 stories/13 epics — the acceptance criteria these installs must satisfy), wireframe catalog (`../desisquare-wireframes-v3-catalog.md`), interactive prototype (`../desisquare-wireframes-v3-prototype.html`), gf-stats %-only contract (`../gf-stats-contract/`).

## Topology (one VPS demo)

```
                      DNS: community.example.com ─┐        app.example.com ─┐
                                                  ▼                         ▼
   Hetzner CPX31/41 · Ubuntu 24.04 · 4 vCPU / 8 GB / 2 GB swap · ufw 22,80,443
   ────────────────────────────────────────────────────────────────────────────
   Discourse (discourse_docker, owns :80/:443 for its host        Caddy (or socketed-
   OR socketed behind the shared proxy — see runbook 01 §3)       nginx) for app.* :443
                                                                        │
   Ghostfolio app :3333 ── PostgreSQL 15 ── Redis    ◄──────────────────┘
   wa-bridge :8790  ◄── Meta webhook (via Caddy route /wa/*)
   gf-provisioner :8791 ◄── Discourse user_created webhook
   gf-stats :8792 ◄── Discourse theme component (same-origin proxy)
   ────────────────────────────────────────────────────────────────────────────
   Outbound: Brevo SMTP :587 · Meta Graph API · Yahoo/CoinGecko market data
```

## Order of operations (dependencies encoded)

1. **Day 0, first — the long poles, in parallel:**
   - Register/point **DNS** (both A records) — everything waits on this.
   - Start **runbook 03 §1–2** (Meta Business Portfolio + app + test number): free, instant, and template approvals (03 §6) can queue while you build.
   - Create the **Brevo (SMTP) account** and start domain authentication (01 §4) — DKIM propagation is the usual invite-email blocker.
2. **Runbook 01 (Discourse)** end-to-end → checkpoint: invite-only forum on `community.example.com`, admin in, test email delivered, Porcelain Slate default, Hot as homepage.
3. **Runbook 02 (Ghostfolio)** end-to-end → checkpoint: `app.example.com` healthy, admin user created **and security token stored in the team vault** (no recovery!), demo portfolio imported, allocation visible.
4. **Integration scripts** (wa-bridge, gf-provisioner, gf-stats): deploy as systemd services or a small compose file; wire Discourse `user_created` webhook (01 §9) → gf-provisioner; Meta webhook (03 §5) → wa-bridge; gf-stats reads Ghostfolio with a scoped token and serves `/api/mavens/:pseudonym/stats` (contract in `../gf-stats-contract/`).
5. **Runbook 03 §4–7**: first sends to the 5 test recipients, webhook verified, templates submitted, consent toggles wired to the Discourse custom field.

## End-to-end demo acceptance (the "it works" script)

Run after all three runbooks + scripts. Maps to the P0 user stories:

1. **Gate (#7):** signed-out visit to `community.example.com` shows only the landing; `/latest.json` anonymously returns 403/redirect.
2. **Join:** invite `DSQ-2026` → signup → email arrives (Brevo) → member lands on the **Hot-sorted** feed (F3).
3. **Provisioning:** the signup webhook fired **once**; gf-provisioner log shows `provisioned`; replaying the webhook shows `already_linked` (idempotent). Member's profile "Open in Ghostfolio" signs them in with no Ghostfolio password.
4. **Post + react + flag (#3):** create a post, react with all 4 pills from a second account, flag it as Marketing → flag appears **only** in the mod review queue.
5. **Search (F1):** `/` → query returns the post under Posts, its reply under Comments, the author under Profiles, the corridor under Communities.
6. **Maven proof (F2/#8):** maven links portfolio, flips the W7 performance toggle ON → profile shows the % chart/table; `curl` of gf-stats output **contains no currency symbol, code, or value-shaped number** (run `node docs/gf-stats-contract/leak-sweep.test.mjs` in CI); toggle OFF → 404 + honest empty state.
7. **Portfolio privacy (#4):** owner sees $ in Ghostfolio; their public forum profile shows allocation % only (or nothing if Private).
8. **WhatsApp (#5):** test recipient opts in → utility `reply_alert` template arrives on a reply; member replies "STOP" → consent flag cleared, no further sends; consent-off mirroring produces an unattributed guest post; grep the forum DB/exports for E.164 patterns → none.
9. **Ops:** trigger a Discourse backup + a `pg_dump`; restore drill on the Ghostfolio dump; `./launcher rebuild app` completes with ≥2.5 GB free (swap in place).

## Standing cautions

- **Ghostfolio's first-user token is unrecoverable** — store it before doing anything else (02 §3).
- **US (+1) marketing templates are paused by Meta** (Apr 2025 →): US-corridor digests go via email or the free 24-h service window (03 §6/§10, error 131049).
- **No unofficial WhatsApp bridges** (Baileys/whatsapp-web.js) — ToS violation, permanent ban risk; the demo mirrors via the linked business number / simulated injection only (03 §8).
- **Pin versions everywhere** (Ghostfolio image tag, Discourse rebuilds on your schedule); snapshot Postgres before every Ghostfolio upgrade (auto-migrations on boot).
- Every surface ships the **"educational only — not investment advice"** disclaimer; this is a compliance control, not copy polish.
