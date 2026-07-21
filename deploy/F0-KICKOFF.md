# DesiSquare — F0 Kickoff Packet ("Start Now")

**Increment F0 — Accounts & prerequisites.** This is the one page you act on **today**. It drives F0 to done and hands back exactly the values we need to begin F1 (provisioning). We provision **nothing** in F0 — we only get accounts, auth, and external verifications *in flight*.

- **Companion docs:** `deploy/CLIENT-INFRA-CHECKLIST.md` (items 1–7), `deploy/gcp/REQUIREMENTS.md` (F0.1–F0.6 + prompt), `deploy/gcp/RUNBOOK.md` (Day 0), `deploy/gcp/whatsapp/WHATSAPP-SETUP.md` (Part 1), `deploy/PRODUCTION-DEPLOYMENT-GUIDE.md` (§4 Phase F0). Progress tracker: `deploy/INFRA-PROGRESS.md`.
- **Placeholders.** Everything in angle brackets is yours to fill: `<PROJECT_ID>`, `<domain>`, `<APP_ID>`, `xsmtpsib-…`. **Never paste real secrets into this file, the repo, or chat** — tokens go to GCP Secret Manager; `.env` stays on the VM at mode `600`.

## What F0 achieves

Authenticated `gcloud` on a billing-enabled project, region/zone chosen, mode decided (PRODUCTION vs start-with-DEMO), and every external account (Meta, domain, SMTP, GitHub deploy key) either ready or verifiably in progress. End state = the F0 acceptance table (below) all green → we start F1.

## THE ONE CRITICAL-PATH ACTION (do this first, today)

**Start Meta Business Verification.** It takes **1–3 weeks** and gates the WhatsApp *production* number — nothing else in the whole build takes that long. Start it Day 0 and it runs in the background while we build everything else. The free Meta **test number** proves the full WhatsApp loop immediately, so no other work waits on Meta.

---

## Do-now sequence

### 1 · Meta — Business Verification (Day 0, longest lead time) → F0.5

Reference: `deploy/gcp/whatsapp/WHATSAPP-SETUP.md` Part 1. Only you can click these (account-owner actions).

1. **Create a Business portfolio** at `business.facebook.com` (if you don't already have one). Note its **Business portfolio ID**.
2. **Security Center → Start Business Verification.** This is the critical path — submit it now. Status will read *pending* until Meta approves (days → weeks).
3. **Create the developer app** at `developers.facebook.com/apps` → **Create app** → use case **"Connect with customers through WhatsApp"** → attach the Business portfolio from step 1.
4. **Capture App ID + App secret** (App settings → Basic). Send us the **App ID** (safe to share); keep the **App secret** private — it goes to Secret Manager later, not into chat.

*Verify:* App ID captured; Business Verification status shows **pending or approved**.

> Scope note: WhatsApp is the **official Meta Cloud API only**, 1:1 intake model (member DMs the number → topic in Discourse → reply routes back). **Group mirroring is out of scope.** We never use WhatsApp-Web automation libraries (ToS-violating).

### 2 · GCP — auth, billing, region, APIs → F0.1 / F0.2

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud auth list                                    # expect a non-empty ACTIVE account
gcloud beta billing projects describe <PROJECT_ID>  # expect billingEnabled: true
```

If the project doesn't exist yet: `gcloud projects create <PROJECT_ID>`, then **you** enable billing in the console (only the account owner can). Grant `Owner`/`Editor` to the deploy account, or run `gcloud auth login` with us on a call.

**Choose region/zone** (written into `deploy/gcp/scripts/01-gcp-provision.sh` config block in F1):
- Default: `us-central1` / `us-central1-a`.
- India-first audience: `asia-south1` (Mumbai) / `asia-south1-a`.

**Enable the core APIs** now so F1 doesn't stall:

```bash
gcloud services enable compute.googleapis.com secretmanager.googleapis.com
# F1 also enables: dns / storage / monitoring / logging .googleapis.com
```

*Verify:* `gcloud auth list` non-empty; `billingEnabled: true`. Budget-alert sign-off: ~$150/mo cap (armed in F5.4).

### 3 · Domain & DNS → F0.3

- **Purchase or confirm the domain** (`<domain>`, e.g. Cloud Domains / Namecheap / your registrar).
- **Confirm registrar / DNS access** — we will need to create **4 A records** (`community.` `app.` `folio.` `wa.<domain>`) plus the email TXT records below. You keep the credentials; just confirm who controls DNS.
- **The A-record *values* come in F1**, once the VMs exist and we have the two static IPs. For now we only need to know DNS is reachable and who edits it.

*Verify:* registrar console reachable; you can add records.

> Starting DEMO instead? Skip the domain — DEMO uses `sslip.io` hostnames derived from the VM IPs with real HTTPS (Let's Encrypt) and no registrar. Email features are stubbed in DEMO. You can promote DEMO → PRODUCTION later with no rework (buy domain → re-point DNS → swap hostnames → add real SMTP).

### 4 · SMTP (Brevo) — required for real signups → F0.4

Discourse will not run without email. (PRODUCTION only; DEMO stubs this.)

1. **Create a Brevo account** — free tier is 300 emails/day (Mailgun/SES/Postmark also fine).
2. Get the **SMTP key** — Brevo calls it the `xsmtpsib-…` key. **This is NOT the API key** — the API key won't authenticate SMTP.
   - Host: `smtp-relay.brevo.com` · **Port: 587** (GCP blocks port 25 — always use 587) · User: your Brevo SMTP login · Pass: `xsmtpsib-…`
3. **Sender address:** `no-reply@<domain>`.
4. **Add these three TXT records** at your registrar (templates — Brevo supplies the exact `<…>` values):

   | Record | Type | Value (template) |
   |---|---|---|
   | `@` | TXT | `v=spf1 include:<relay-spf-include> ~all` |
   | `<selector>._domainkey` | TXT | *(the DKIM record Brevo gives you, verbatim)* |
   | `_dmarc` | TXT | `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>` |

*Verify:* send a test email through the relay (accepted); `dig +short txt <domain>` shows the SPF record.

### 5 · GitHub — read-only deploy key → F0.6

So `apps-1` can pull the DesiSquare app repo without a personal token.

- Repo → **Settings → Deploy keys → Add deploy key** → paste a **read-only** public key (we generate the keypair; the private half lives on the VM only).
- The functional check (`git ls-remote` from `apps-1`) happens in F3 — for F0 we just confirm the key is added.

*Verify:* deploy key listed on the repo; read-only.

---

## What I need back from you

Fill this in and send it back — with these values we go straight to F1. Keep secrets OUT of this block (App secret, SMTP password, private keys go to Secret Manager). Each row is tagged **[now]** (needed to start F1) or **[F1]/[F4]** (needed at that increment, not blocking now).

```text
# ── DesiSquare F0 intake ─────────────────────────────────────────
MODE                 = PRODUCTION | start-with-DEMO        # [now]

# GCP
PROJECT_ID           = <PROJECT_ID>                        # [now]
REGION               = us-central1 | asia-south1           # [now]
ZONE                 = us-central1-a | asia-south1-a       # [now]
BILLING_ENABLED      = yes/no (gcloud describe shows true) # [now]

# Domain & DNS  (values of the 4 A records are returned by us in F1)
DOMAIN               = <domain>                            # [now, PROD]
DNS_CONTROLLED_BY    = who edits DNS (registrar + who has access)  # [now, PROD]

# SMTP (Brevo)  — password is the xsmtpsib-… key; send it via Secret Manager, NOT here
SMTP_HOST            = smtp-relay.brevo.com                # [F1/F2]
SMTP_PORT            = 587                                 # [F1/F2]
SMTP_USER            = <brevo-smtp-login>                  # [F1/F2]
SMTP_SENDER          = no-reply@<domain>                   # [F1/F2]
SPF_DKIM_DMARC_ADDED = yes/no                              # [F1/F2, PROD]

# Meta / WhatsApp
META_APP_ID          = <APP_ID>                            # [now to record; used F4]
META_VERIFY_STATUS   = pending | approved                  # [now]
META_BUSINESS_ID     = <business-portfolio-id>             # [now]
WA_NUMBER            = dedicated number (NOT a live personal WhatsApp)  # [F4]
WA_DISPLAY_NAME      = e.g. "DesiSquare"                   # [F4]

# Access
DEPLOY_KEY_ADDED     = yes/no (read-only key on the app repo)      # [now, confirm; tested F3]
ADMIN_CONTACT        = platform-admin name/email                  # [now]
OPS_MOD_CONTACT      = moderation/ops contact                     # [now]
# ─────────────────────────────────────────────────────────────────
```

**Secrets channel:** App secret, SMTP `xsmtpsib-…` password, and the deploy private key never go in the intake block. We load them straight into **GCP Secret Manager**; `.env` on the VM (mode `600`) is the only on-disk copy.

---

## F0 acceptance table — the gate to F1

Do not start F1 until every row is **PASS**. (DEMO mode: F0.3 records DEMO; F0.4/F0.5 are not blocking — the test number and stubbed email cover the demo loop.)

| ID | Requirement | How to verify | Pass/Fail |
|---|---|---|---|
| F0.1 | Authenticated gcloud on a billing-enabled project | `gcloud auth list` non-empty **and** `gcloud beta billing projects describe <PROJECT_ID>` → `billingEnabled: true` | ☐ |
| F0.2 | Region/zone chosen (us-central1 default; asia-south1 India-first) | Values recorded here → written into `scripts/01-gcp-provision.sh` in F1 | ☐ |
| F0.3 | Mode decided: PRODUCTION (real domain) or DEMO (sslip.io) | Recorded; if PRODUCTION, registrar/DNS access confirmed | ☐ |
| F0.4 | PROD: SMTP relay (Brevo) port 587 creds; SPF+DKIM+DMARC added | Test email accepted by relay; `dig txt <domain>` shows SPF | ☐ |
| F0.5 | Meta app created; Business Verification started (PROD path) | App ID captured; verification status = pending/approved | ☐ |
| F0.6 | GitHub read-only deploy key added to the app repo | Key listed on repo (functional `git ls-remote` check in F3) | ☐ |

**F0 acceptance:** all applicable rows PASS → proceed to F1.

---

## What happens next (F1 preview)

In **F1 — GCP foundation** we run `scripts/01-gcp-provision.sh` to create the two VMs — **discourse-1** (`e2-medium`, 40 GB) and **apps-1** (`e2-standard-2`, 40 GB), Ubuntu 24.04, each with a reserved static IP — plus the locked-down firewall (only 80/443 public, SSH via IAP range only) and the 30-day backup bucket. The script prints the two IPs; **we then hand you the exact 4 A records** — `community.<domain>` → the discourse IP, and `app.` / `folio.` / `wa.<domain>` → the apps IP — you add them at your registrar, and we verify propagation with `dig +short` before anything requests a TLS cert. (In DEMO the sslip.io hostnames are derived from the IPs automatically — no registrar step.) That closes the F1 acceptance table and opens F2 (Discourse).
