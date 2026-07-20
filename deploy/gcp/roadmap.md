---
title: "DesiSquare — GCP Production Deployment Roadmap"
subtitle: "Discourse · Ghostfolio · WhatsApp Cloud API"
author: "Prepared for K (kalilurrahman)"
date: "July 20, 2026"
---

# Executive summary

DesiSquare today is a prototype on Railway ("where desi money questions get trusted answers" — a pseudonymous, trust-driven investment community for the desi diaspora, on the web and on WhatsApp). This roadmap takes it to a final product on Google Cloud built from three proven components: **Discourse** as the community engine, **Ghostfolio** as the self-hosted portfolio tracker, and the **Meta WhatsApp Cloud API** for the WhatsApp channel, bridged into Discourse.

The launch architecture is deliberately simple — two Compute Engine VMs running Docker — because it is the fastest supported path to production and costs about **$100/month** at pilot scale (<1,000 members). The web stack can be live in **~2 days**; WhatsApp production readiness takes **1–3 weeks** because Meta business verification is on the critical path and must be started on Day 0. A defined evolution path moves the stack to Cloud Run + managed services, and ultimately GKE, as the community grows — without re-architecting.

# Current state and target state

| | Current (prototype) | Target (final product) |
|---|---|---|
| Hosting | Railway (single app) | GCP, 2 VMs + GCS + Cloud Ops |
| Community | Custom app only | Discourse at `community.<domain>` (SSO-ready) |
| Portfolio | — | Ghostfolio at `folio.<domain>` |
| WhatsApp | Concept | Meta Cloud API bridge at `wa.<domain>`, two-way with Discourse |
| App | `desisquare-production.up.railway.app` | `app.<domain>`, containerized on the apps VM |
| Email | — | Transactional SMTP (Brevo/Mailgun), SPF+DKIM |
| Backups / monitoring | — | Nightly GCS offsite; Ops Agent, uptime checks, budget alerts |

# Target architecture (launch)

```
                        Internet
                           |
        +------------------+--------------------+
        |                                       |
  discourse-1 (e2-medium, 4 GB)          apps-1 (e2-standard-2, 8 GB)
  community.<domain>                     Caddy (TLS) ->
  Official Discourse Docker install        app.<domain>   DesiSquareV2 app
  (nginx+Rails+Postgres+Redis in           folio.<domain> Ghostfolio
   the launcher-managed container)         wa.<domain>    WhatsApp bridge
        |                                  Postgres 15 + Redis 7 (containers)
        |                                       |
        +---------- GCS backup bucket ----------+
                (nightly, 30-day lifecycle)

  SSH: IAP tunnel only (no public port 22) · Firewall: 80/443 only
  Secrets: Secret Manager (Meta tokens, API keys) · Monitoring: Cloud Ops
```

Design decisions worth noting:

- **Discourse gets its own VM** because the only officially supported install is their Docker launcher, which owns the machine's port 80/443 and rebuilds the container in place (5–10 minutes of downtime per upgrade). Isolating it means forum maintenance never touches the app, Ghostfolio, or the WhatsApp bridge.
- **Everything else shares one VM** behind Caddy, which terminates TLS with automatic Let's Encrypt certificates for the three subdomains.
- **WhatsApp is a thin bridge, not a platform.** A ~200-line Node service verifies Meta webhook signatures, deduplicates messages, maps each member's number to a Discourse topic (pseudonymized as `member-XXXX`), and relays Discourse replies back — free-form inside the 24-hour service window, approved template outside it. The WhatsApp Groups API is not used: its single-digit participant cap makes it unsuitable for communities; the 1:1 intake number with the portal as hub is the correct shape.
- **Region** defaults to `us-central1` (cheapest, US-diaspora-centric). If the audience skews India-resident, use `asia-south1` (Mumbai) — same scripts, one variable.

# Phased roadmap

## Phase 0 — Prerequisites (Day 0, ~3 hours)

Domain purchase; GCP project with billing; Brevo/Mailgun SMTP account with SPF+DKIM records (Discourse refuses to run without working email, and GCP blocks port 25 — port 587 is used); Meta Business portfolio and developer app created and **Business Verification started immediately** — it is the long pole for WhatsApp production; GitHub deploy key for the private DesiSquareV2 repo.

## Phase 1 — Foundation + Discourse (Day 1)

Run `01-gcp-provision.sh` (VMs, static IPs, firewall, backup bucket), create four DNS A records, then the official Discourse install on discourse-1 (`02-discourse-install.sh` + interactive `discourse-setup`). Exit criteria: `https://community.<domain>` live with TLS, admin activated by email, categories created including **WhatsApp Intake**, nightly backups enabled.

## Phase 2 — Ghostfolio + app migration (Day 2)

Bring up the compose stack on apps-1 (`03-apps-vm-setup.sh`): Ghostfolio + Postgres 15 + Redis 7 + bridge + Caddy. Build the DesiSquareV2 image from the repo into the stack's app slot; freeze Railway writes, export data, cut DNS over, keep Railway warm until verified. Exit criteria: all three subdomains serve production TLS; first Ghostfolio admin user created.

## Phase 3 — WhatsApp bridge (Day 3 test; Week 2–3 production)

Day 3 on the free test number: outbound template proof, webhook verification against `https://wa.<domain>`, inbound message → Discourse topic, Discourse reply → phone. Submit message templates the same day. Production (gated on Meta verification): real number + display-name review, permanent system-user token in Secret Manager, template approvals, Advanced Access, production webhook, `wa.me` link published on the site.

## Phase 4 — Hardening + pilot launch (Day 4–5)

Offsite backup cron on both VMs with a tested restore; Ops Agent, four uptime checks, billing budget alert; IAP-only SSH confirmed; secrets in Secret Manager; Discourse branding, pseudonym policy, and a visible "community discussion, not financial advice" disclaimer. Invite the pilot cohort.

## Phase 5 — Integration deepening (Weeks 2–6, parallel)

**Single sign-on:** launch uses Discourse-native auth (fastest). Then wire **DiscourseConnect** with the DesiSquareV2 app as the identity provider so pseudonymous handles carry across app and forum. Ghostfolio keeps separate accounts initially (its token-based auth model); evaluate OIDC when the app becomes the IdP.
**Product glue:** shared navigation across the three surfaces; weekly digest template (approved at Meta) for re-engagement; Discourse API feeds top threads onto the app homepage.

## Phase 6 — Scale evolution (when signals appear)

| Signal | Move |
|---|---|
| apps-1 CPU/RAM sustained >70% | Resize VM (minutes of downtime) — first, cheapest lever |
| >5–10k members, ops burden rising | App + Ghostfolio + bridge → **Cloud Run**, DB → **Cloud SQL**, Redis → **Memorystore**; images already exist, so this is a lift, not a rewrite |
| Multi-service scale, team growth | **GKE Autopilot** for the app tier; Discourse stays on its VM (officially supported shape) and simply gets a bigger machine + CDN |
| Discourse >20k DAU | e2-standard-4, separate data disk, Cloudflare/Cloud CDN in front |

# Timeline summary

| When | Milestone |
|---|---|
| Day 0 | Accounts, domain, SMTP, **Meta verification started** |
| Day 1 | Infra provisioned; **Discourse live** |
| Day 2 | **Ghostfolio live; app migrated off Railway** |
| Day 3 | WhatsApp two-way loop proven on test number; templates submitted |
| Day 4–5 | Backups, monitoring, hardening; **pilot invites** |
| Week 2–3 | **WhatsApp production number live** (Meta-gated) |
| Week 2–6 | SSO (DiscourseConnect), digests, product glue |

# Cost model (pilot, us-central1, on-demand)

| Item | Monthly |
|---|---|
| discourse-1 · e2-medium (2 vCPU / 4 GB) | $24.46 |
| apps-1 · e2-standard-2 (2 vCPU / 8 GB) | $48.92 |
| 2 × 40 GB pd-balanced disks | ~$8.00 |
| 2 static external IPs | ~$7.30 |
| GCS backups + Cloud DNS + logs | ~$3 |
| Egress (~50 GB) | ~$6 |
| SMTP (Brevo free tier, 300/day) | $0 |
| WhatsApp (in-window service replies free; utility templates $0.004–$0.04/msg by country) | ~$0 pilot |
| **Total** | **≈ $98/mo** (+ domain ~$12/yr) |

A 1-year committed-use discount cuts VM cost ~37% once the shape is stable. The equivalent Cloud Run + Cloud SQL + Memorystore build runs $200+/mo — the reason it is Phase 6, not Phase 1.

# Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Meta business verification delays (days–weeks) | WhatsApp production slips | Start Day 0; test number unblocks all engineering meanwhile |
| Email deliverability (activation mails in spam) | Discourse signups stall | Reputable SMTP relay + SPF/DKIM on Day 0; test before invites |
| Discourse rebuild downtime (5–10 min) | Forum-only outage | Own VM; announce windows; app/Ghostfolio unaffected |
| Railway cutover data loss | App data loss | Freeze-export-verify sequence; keep Railway warm until DNS verified |
| Single-zone pilot (no HA) | Hours of downtime on zone incident | Accepted for pilot; nightly offsite backups + documented restore; HA arrives with Phase 6 |
| Finance-content compliance | Trust/regulatory exposure | Pseudonymity preserved end-to-end; "not financial advice" disclaimer enforced in the bridge layer and site footer; opt-out (STOP) honored automatically |
| WhatsApp cost creep at scale | Budget surprise | Bridge prefers free in-window replies; per-template costs modeled before enabling digests |

# Acceptance criteria (go-live)

1. Four HTTPS endpoints healthy behind uptime checks: community, app, folio, wa.
2. New-user email flow verified end-to-end on Discourse.
3. WhatsApp loop: member message → Discourse topic → reply → member's phone, with signature verification, dedupe, window logic, and STOP handling demonstrated.
4. Backup objects present in GCS for both VMs **and one successful restore drill**.
5. Budget alert armed; secrets held in Secret Manager; SSH reachable only via IAP.

# Appendix — package contents

Scripts and configuration shipped alongside this document: `RUNBOOK.md` (execution steps), `scripts/01–04` (provision, Discourse, apps stack, backups), `apps-stack/` (compose + Caddy + env), `wa-bridge/` (bridge service), `whatsapp/` (Meta setup guide + templates). Sources consulted: Discourse official install docs (github.com/discourse/discourse INSTALL-cloud), Ghostfolio docker documentation, Meta WhatsApp Business Platform pricing/onboarding docs, GCP Compute pricing.
