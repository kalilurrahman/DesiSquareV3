# DesiSquare — Requirements register F0–F5 (F6 scale evolution excluded)

Purpose: feed Claude Code **one increment per session, in order**. Each increment lists requirements with testable acceptance criteria, then a ready-to-paste prompt. Don't start an increment until the previous one's acceptance criteria all pass. Package files referenced are in this folder.

Conventions: `<domain>` = real domain (production) or `<IP>.sslip.io` (demo). "Verify" means Claude Code must actually test, not assume.

---

## F0 — Accounts & prerequisites

| ID | Requirement | Acceptance |
|---|---|---|
| F0.1 | Authenticated gcloud on a billing-enabled project | `gcloud auth list` non-empty; `gcloud beta billing projects describe <project>` shows billingEnabled |
| F0.2 | Region/zone chosen (us-central1 default; asia-south1 if India-first) | Values written into `scripts/01-gcp-provision.sh` config block |
| F0.3 | Mode decided: DEMO (sslip.io) or PROD (real domain) | Recorded; if PROD: registrar access confirmed |
| F0.4 | PROD only: SMTP relay account (Brevo/Mailgun), port 587 creds; SPF+DKIM records added | Test email accepted by relay |
| F0.5 | Meta developer app created; Business Verification started (PROD path) | App ID + App secret captured; verification status = pending/approved |
| F0.6 | GitHub deploy key added to private DesiSquareV2 repo | `git ls-remote` succeeds from apps VM (checked in F3) |

**Prompt F0:**
```
Increment F0 of REQUIREMENTS.md: verify my gcloud auth, billing, and set region in scripts/01-gcp-provision.sh. Ask me: demo or production mode, and collect the F0.3–F0.6 items that apply. Do not provision anything yet. End with an F0 acceptance checklist showing pass/fail.
```

## F1 — GCP foundation

| ID | Requirement | Acceptance |
|---|---|---|
| F1.1 | Two VMs: discourse-1 (e2-medium, 40GB) + apps-1 (e2-standard-2, 40GB), Ubuntu 24.04, static IPs | `gcloud compute instances list` shows both RUNNING with reserved IPs |
| F1.2 | Firewall: only 80/443 ingress to tag `web`; SSH via IAP range only | `gcloud compute firewall-rules list` matches; public port 22 closed |
| F1.3 | Backup bucket with 30-day lifecycle; VM service account can write | `gsutil ls` OK; test object upload from a VM succeeds |
| F1.4 | Hostnames resolve: community/app/folio/wa.`<domain>` to the right IPs | `dig +short` each = expected IP (registrar A records, or sslip.io implicit) |
| F1.5 | IAP SSH works to both VMs | `gcloud compute ssh <vm> --tunnel-through-iap -- true` exits 0 |

**Prompt F1:**
```
Increment F1: run scripts/01-gcp-provision.sh, then satisfy F1.1–F1.5. In demo mode derive sslip.io hostnames from the printed IPs and update apps-stack/.env DOMAIN. In prod mode give me the exact A records and wait for my confirmation before verifying DNS. End with the F1 acceptance table.
```

## F2 — Community (Discourse)

| ID | Requirement | Acceptance |
|---|---|---|
| F2.1 | Official Docker install on discourse-1 with 2GB swap | `/var/discourse` present; container `app` running |
| F2.2 | HTTPS live at `community.<domain>` (Let's Encrypt) | curl -sI returns 200 and valid cert |
| F2.3 | Admin account active (email flow in PROD; `rake admin:create` in DEMO) | Admin can log in |
| F2.4 | PROD: signup/activation email verified end-to-end | Activation mail received in inbox (not spam) |
| F2.5 | Categories created incl. **WhatsApp Intake** (id recorded) | Category id noted in apps-stack/.env `DISCOURSE_WA_CATEGORY_ID` |
| F2.6 | Global API key (user `system`) + webhook (`post_created` → `https://wa.<domain>/webhooks/discourse`, secret set) | Values in apps-stack/.env; webhook shows in Admin → API |
| F2.7 | `force_https` on; nightly built-in backups enabled (7-day retention) | Settings verified in admin |
| F2.8 | Trust & tone: pseudonym-friendly username policy; welcome topic + footer carry "community discussion, not financial advice" | Visible on site |

**Prompt F2:**
```
Increment F2: install Discourse per scripts/02-discourse-install.sh — interactive discourse-setup in prod, non-interactive app.yml route from CLAUDE.md in demo. Then complete F2.3–F2.8, writing the API key, webhook secret, and category id into apps-stack/.env. End with the F2 acceptance table.
```

## F3 — Portfolio (Ghostfolio) + DesiSquare app

| ID | Requirement | Acceptance |
|---|---|---|
| F3.1 | Compose stack up on apps-1: Ghostfolio + Postgres 15 + Redis 7 + Caddy (+ bridge container built) | `docker compose ps` all healthy/running |
| F3.2 | Secrets generated, `.env` complete, mode 600, never committed | `stat -c %a .env` = 600 |
| F3.3 | HTTPS live at `folio.<domain>`; first user created (= admin) | Login works; admin panel reachable |
| F3.4 | Demo seed: 2–3 sample holdings render a portfolio | Dashboard shows non-empty performance |
| F3.5 | DesiSquareV2 app built from repo into the compose app slot; live at `app.<domain>` | 200 over HTTPS; core pages render |
| F3.6 | Railway cutover (PROD): freeze → export data → verify on GCP → then scale Railway down. DEMO: Railway stays primary, env vars link to demo URLs | No data loss; both URLs serve during transition |
| F3.7 | Cross-links: app ↔ community ↔ folio navigation present | Links resolve on all three surfaces |

**Prompt F3:**
```
Increment F3: scp apps-stack + wa-bridge to apps-1, run scripts/03-apps-vm-setup.sh (twice: secrets, then start), satisfy F3.1–F3.4. For F3.5 clone DesiSquareV2 with my deploy key, enable the compose app slot and Caddyfile block, ask me for the app's listen port and required env vars. Follow the F3.6 mode rule. End with the F3 acceptance table.
```

## F4 — WhatsApp channel (Meta Cloud API)

| ID | Requirement | Acceptance |
|---|---|---|
| F4.1 | Official Cloud API only (no WhatsApp-Web automation) | Design unchanged from wa-bridge/ |
| F4.2 | Webhook verified at `https://wa.<domain>/webhooks/whatsapp` (GET handshake) | Meta dashboard shows verified; `messages` field subscribed |
| F4.3 | Signature verification (X-Hub-Signature-256, raw body) and wamid dedupe active | Tampered payload → 401; duplicate wamid → single Discourse post |
| F4.4 | Inbound → Discourse topic in WhatsApp Intake, number pseudonymized (`member-XXXX`) | Test message appears as topic |
| F4.5 | Discourse reply → member's phone; free-form in 24h window, `community_reply` template outside | Both paths demonstrated (template after approval) |
| F4.6 | Opt-out: STOP suppresses outbound until member writes again | Verified with test number |
| F4.7 | Templates from whatsapp/message-templates.json submitted | Status ≥ pending in Manage Templates |
| F4.8 | PROD (Meta-gated): verified business, real number + display name, permanent system-user token in Secret Manager, Advanced Access, wa.me link on site | Production send to a non-test number succeeds |

**Prompt F4:**
```
Increment F4: walk me through whatsapp/WHATSAPP-SETUP.md Parts 1–4 on the free test number (I'll do the Meta console clicks; you prepare .env values, restart wa-bridge, and run the curl proofs). Then demonstrate F4.3–F4.6 with logged evidence and submit F4.7 templates. Mark F4.8 blocked-on-Meta if verification is still pending. End with the F4 acceptance table.
```

## F5 — Operations, hardening & launch readiness

| ID | Requirement | Acceptance |
|---|---|---|
| F5.1 | Nightly offsite backups (scripts/04-backups.sh + cron) on both VMs | Objects for both VMs in bucket after manual run |
| F5.2 | Restore drill passed: Discourse backup restorable; Ghostfolio dump loads into scratch Postgres | Documented restore output |
| F5.3 | Ops Agent on both VMs; uptime checks on all four URLs with email alerting | Checks green in Cloud Monitoring |
| F5.4 | Billing budget alert (~$150/mo) armed | Budget visible in console |
| F5.5 | Secrets in Secret Manager as source of truth (Meta token, Discourse API key, bridge key) | `gcloud secrets list` shows them |
| F5.6 | Unattended-upgrades active; no public SSH; `.env` 600 re-verified | Audit output attached |
| F5.7 | SSO phase-in: launch on Discourse-native auth; DiscourseConnect plan documented with DesiSquareV2 as IdP (pseudonymous handles preserved) | Written plan; toggle steps listed |
| F5.8 | Pilot invite pack: welcome topic, disclaimer footer, wa.me link (when F4.8 done), invite list ready | Dry-run invite completed |

**Prompt F5:**
```
Increment F5: implement F5.1–F5.6 (backups + cron, restore drill, Ops Agent, uptime checks, budget alert, Secret Manager, security audit), then draft the F5.7 DiscourseConnect plan and F5.8 pilot pack. End with the full F0–F5 acceptance summary — anything failing blocks launch.
```

---

Out of scope here (F6, on demand): VM resize triggers, Cloud Run/Cloud SQL/Memorystore migration, GKE Autopilot, CDN — see roadmap Phase 6.
