# CLAUDE.md — DesiSquare GCP deployment package

You (Claude Code) are deploying DesiSquare: Discourse (community) + Ghostfolio (portfolio) + WhatsApp bridge on GCP. The user's existing app stays on Railway during the demo. Read `README.md` for the file map and `RUNBOOK.md` for full production steps. If the user references an increment (F0–F5), work from `REQUIREMENTS.md`: complete only that increment and finish with its acceptance table.

## Modes — ask the user which one first

1. **DEMO mode (default, no domain needed):** everything live in ~1 hour on sslip.io hostnames. Email features stubbed.
2. **PRODUCTION mode:** follow `RUNBOOK.md` exactly (real domain, SMTP, Meta verification).

## Before anything, verify (and stop to ask if missing)

- `gcloud auth list` shows an authenticated account; `gcloud config get-value project` is set to a billing-enabled project (else `gcloud projects create` + ask user to enable billing in console).
- Ask for region preference (default `us-central1`; `asia-south1` if India-first).

## DEMO mode procedure

1. Edit the config block in `scripts/01-gcp-provision.sh` (PROJECT_ID, REGION, ZONE; leave DOMAIN as-is for now) and run it. Capture the two printed IPs: `DISCOURSE_IP`, `APPS_IP`.
2. **Demo hostnames (no registrar needed):** use sslip.io wildcard DNS:
   - Discourse: `community.<DISCOURSE_IP>.sslip.io`
   - Apps: `app|folio|wa.<APPS_IP>.sslip.io` → set `DOMAIN=<APPS_IP>.sslip.io` in `apps-stack/.env`. Let's Encrypt works with sslip.io.
3. **Discourse non-interactively** (skip `discourse-setup`): on discourse-1 run `scripts/02-discourse-install.sh` but instead of the interactive step:
   - `cp /var/discourse/containers/samples/standalone.yml /var/discourse/containers/app.yml`
   - In `app.yml` set: `DISCOURSE_HOSTNAME: community.<DISCOURSE_IP>.sslip.io`, `DISCOURSE_DEVELOPER_EMAILS: <user email>`, dummy SMTP values (`smtp.invalid`, port 587), and enable the Let's Encrypt template + `templates/web.ssl.template.yml`.
   - `./launcher rebuild app` (5–10 min).
   - Email won't send in demo, so create the admin from console: `./launcher enter app && rake admin:create`.
   - In Admin settings create category **WhatsApp Intake** (note id), create a global API key (user `system`), and a webhook (`post_created` → `https://wa.<APPS_IP>.sslip.io/webhooks/discourse`, choose a secret).
4. **Apps VM:** `gcloud compute scp --recurse apps-stack wa-bridge apps-1:~ --zone=<ZONE> --tunnel-through-iap`, then run `scripts/03-apps-vm-setup.sh` twice (first run generates secrets; then fill `.env`: DOMAIN, ACME_EMAIL, DISCOURSE_* values from step 3; second run starts the stack). Verify `https://folio.<APPS_IP>.sslip.io` and `/health` on `wa.`.
5. **Demo seed:** create the first Ghostfolio user (becomes admin) and add 2–3 sample holdings; post 3–4 seed topics in Discourse (desi-finance themed) so the demo isn't empty.
6. **WhatsApp (optional in demo, free):** needs the user to click through Meta app creation — walk them through `whatsapp/WHATSAPP-SETUP.md` Parts 1–4 using the **test number** (no business verification needed). Webhook URL: `https://wa.<APPS_IP>.sslip.io/webhooks/whatsapp`.
7. **Link the Railway app:** if the Railway CLI is authenticated, set env vars on the Railway service pointing to the demo URLs (e.g. `DISCOURSE_URL`, `GHOSTFOLIO_URL`) so the running app can link out; otherwise print the URLs for the user to set manually.
8. Print a demo summary: all four URLs + admin credentials location + teardown reminder.

## Things only the human can do (ask, don't attempt)

Enable billing; buy a domain (production); create Brevo/Mailgun SMTP account (production); click through Meta app creation and verify their phone as test recipient; Meta Business Verification (production).

## Guardrails

- Never print or commit secrets; `.env` stays on the VM (mode 600). Real tokens go to Secret Manager in production.
- Demo costs ~$0.10/hour (~$75/mo if left running). When the demo is done, offer `scripts/99-teardown.sh`.
- Don't run `./launcher rebuild app` casually — it's 5–10 min of forum downtime.
- WhatsApp: official Meta Cloud API only; never suggest WhatsApp-Web automation libraries.

## Promotion to production

Same package, no rework: buy domain → re-point DNS A records → change `DOMAIN`/hostname values → real SMTP in `app.yml` (+ rebuild) → follow `RUNBOOK.md` Day 4-5 hardening and `whatsapp/WHATSAPP-SETUP.md` Part 5.
