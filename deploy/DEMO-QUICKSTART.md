# DesiSquare — Demo Quickstart

**The fastest path to the full live stack — no domain, ~1 hour, real HTTPS.** This is the
condensed demo track. For the production runbook see `PRODUCTION-DEPLOYMENT-GUIDE.md`; for the
per-increment acceptance tables see `gcp/REQUIREMENTS.md` (F0–F5); for the demo-vs-prod rules and
the non-interactive Discourse route see `gcp/CLAUDE.md`.

## What you'll have in ~1 hour

Four real HTTPS URLs on **sslip.io** wildcard DNS (Let's Encrypt certs, zero registrar):

| Surface | URL | Behind it |
|---|---|---|
| Community (Discourse) | `https://community.<DISCOURSE_IP>.sslip.io` | Discourse on VM `discourse-1` |
| Branded app (v4) | `https://app.<APPS_IP>.sslip.io` | v4 forum/experience `:8786` |
| Portfolio (Ghostfolio) | `https://folio.<APPS_IP>.sslip.io` | Ghostfolio `:3333` + Postgres 15 + Redis 7 |
| WhatsApp bridge | `https://wa.<APPS_IP>.sslip.io` | wa-bridge `:8788` (+ gf-provisioner `:8789`, models-service `:8791`) |

## What you need

- A **GCP project with billing enabled** — that's it. **No domain, no SMTP account, no Meta
  verification.** (`sslip.io` gives you hostnames; email is stubbed in demo; the WhatsApp loop uses a
  free Meta test number.)
- `gcloud` authenticated on that project (`gcloud auth list` non-empty;
  `gcloud beta billing projects describe <PROJECT_ID>` shows `billingEnabled: true`).
- Node 20+ locally for Option 0 (zero dependencies to install).

**All six product constraints hold in demo exactly as in prod:** #3 flags private · #4 dollars
owner-only / public %-only · #5 WhatsApp consent-gated, E.164 never shown · #7-A anon = teaser only ·
#8 maven percent-only · #9 recognition ranks engagement, not money.

---

## Option 0 — Zero-cloud local run first (5 min, $0)

See the whole product before spending a cent. One command boots the v4 forum plus its three glue
services; Ghostfolio is optional (gf-provisioner runs in **mock** mode without it), and everything
**degrades gracefully** so the site is never blank.

```bash
make dev-v4     # v4 :8786 + gf-provisioner :8789 + wa-bridge :8788 + models-service :8791
```

Open **http://localhost:8786** → register an account, open a member profile → **"Open in Ghostfolio →"**
(1-click SSO), and open a maven → the **percent-only** performance proof (Overview / Stats / Portfolio /
Chart — % only, asset value never shown).

Want a **real** portfolio + real SSO locally (needs Docker)? Bring Ghostfolio up first, then point the
stack at it:

```bash
cd services/ghostfolio && docker compose up -d          # Ghostfolio + Postgres + Redis → :3333 (~1 min)
GHOSTFOLIO_URL=http://localhost:3333 GHOSTFOLIO_LIVE=true make dev-v4
```

`Ctrl-C` tears the whole stack down. When you're ready for real HTTPS URLs to share, go to the GCP demo.

---

## GCP demo — step by step (~1 hour)

Everything below is under `deploy/gcp/`. Placeholders: `<PROJECT_ID>`, `<DISCOURSE_IP>`, `<APPS_IP>`,
`<ZONE>`. **Never print or commit secrets — `.env` stays on the VM at mode 600.**

### 1. Provision the two VMs (~10 min)

Edit the config block at the top of `gcp/scripts/01-gcp-provision.sh` (leave `DOMAIN` as-is for now):

```bash
export PROJECT_ID="<PROJECT_ID>"
export REGION="us-central1"          # asia-south1 (Mumbai) if India-first
export ZONE="us-central1-a"
```

Run it. It enables APIs, reserves two static IPs, creates `discourse-1` (e2-medium) and `apps-1`
(e2-standard-2), the locked-down firewall (only 80/443 public; SSH via IAP range only), and the
backup bucket. **Capture the two printed IPs** → `<DISCOURSE_IP>`, `<APPS_IP>`.

```bash
bash gcp/scripts/01-gcp-provision.sh
```

### 2. Derive the sslip.io hostnames (no registrar)

sslip.io resolves `anything.<IP>.sslip.io` → `<IP>`, and Let's Encrypt issues certs for it. So:

- Discourse: `community.<DISCOURSE_IP>.sslip.io`
- Apps: `app` / `folio` / `wa` `.<APPS_IP>.sslip.io`

Set the apps base domain in `gcp/apps-stack/.env`:

```dotenv
DOMAIN=<APPS_IP>.sslip.io
```

### 3. Install Discourse non-interactively (~10–15 min, mostly the rebuild)

SSH to `discourse-1` and run the install script (adds 2 GB swap, Docker, clones `discourse_docker`).
Then take the **non-interactive route** — skip `discourse-setup`, use `app.yml` directly (per
`gcp/CLAUDE.md`):

```bash
gcloud compute ssh discourse-1 --zone=<ZONE> --tunnel-through-iap
sudo -i && bash 02-discourse-install.sh          # copy the script onto the VM first
cp /var/discourse/containers/samples/standalone.yml /var/discourse/containers/app.yml
```

In `containers/app.yml` set:
- `DISCOURSE_HOSTNAME: community.<DISCOURSE_IP>.sslip.io`
- `DISCOURSE_DEVELOPER_EMAILS: <your email>`
- dummy SMTP (`smtp.invalid`, port `587`) — **email won't send in demo**
- enable the **Let's Encrypt** template **and** `templates/web.ssl.template.yml`

```bash
cd /var/discourse && ./launcher rebuild app      # 5–10 min
./launcher enter app && rake admin:create        # create the admin from console (no email flow)
```

`curl -sI https://community.<DISCOURSE_IP>.sslip.io` → `200` + valid cert.

### 4. Discourse: WhatsApp Intake + API key + webhook

In Admin:
- Create category **WhatsApp Intake** → note its numeric id → `DISCOURSE_WA_CATEGORY_ID`.
- **API → New API Key** → user `system`, scope **global** → `DISCOURSE_API_KEY`.
- **API → Webhooks → New** → payload URL `https://wa.<APPS_IP>.sslip.io/webhooks/discourse`,
  trigger **Post → post_created**, set a **secret** → `DISCOURSE_WEBHOOK_SECRET`.
- Keep **login required = on** so anonymous visitors hit only the teaser (constraint #7-A).

### 5. Bring up the apps stack (~10 min)

Ship the stack to `apps-1` and run `scripts/03-apps-vm-setup.sh` **twice** — first run installs
Docker and generates the random secrets, then you fill `.env`, then the second run starts everything:

```bash
gcloud compute scp --recurse gcp/apps-stack gcp/wa-bridge apps-1:~ --zone=<ZONE> --tunnel-through-iap
gcloud compute ssh apps-1 --zone=<ZONE> --tunnel-through-iap
bash 03-apps-vm-setup.sh          # run 1: installs Docker, auto-generates secrets, then exits
```

Edit `.env` (leave the auto-generated secrets as-is) and set the values from steps 2–4:

```dotenv
DOMAIN=<APPS_IP>.sslip.io
ACME_EMAIL=<your email>
DISCOURSE_URL=https://community.<DISCOURSE_IP>.sslip.io   # also set DISCOURSE_BASE_URL to the same value
DISCOURSE_API_KEY=<from step 4>
DISCOURSE_API_USERNAME=system
DISCOURSE_WA_CATEGORY_ID=<from step 4>
DISCOURSE_WEBHOOK_SECRET=<the exact secret from step 4>
```

```bash
chmod 600 .env && stat -c '%a' .env      # must print 600
bash 03-apps-vm-setup.sh                 # run 2: builds + starts the stack (Caddy TLS on all 3 subdomains)
```

Verify:

```bash
curl -sf https://folio.<APPS_IP>.sslip.io/api/v1/health      # Ghostfolio
curl -sf https://app.<APPS_IP>.sslip.io/api/health           # v4 app
curl -sf https://wa.<APPS_IP>.sslip.io/health                # wa-bridge
```

---

## Seed it (so the demo isn't empty)

1. **Ghostfolio** — open `https://folio.<APPS_IP>.sslip.io`, create the **first user** (becomes admin;
   the first `POST /api/v1/user` is the admin). **Save the security token immediately — it is
   unrecoverable.** Add **2–3 sample holdings** so the dashboard renders a non-empty portfolio.
2. **Discourse** — post **3–4 seed topics** (desi-finance themed; reuse personas `quiet_lotus`,
   `nikhil_cfa`, `desisquare_mod`, corridors US/CA/UK/AE/AU/SG) so the community isn't blank. Keep the
   "community discussion, not financial advice" disclaimer on the welcome topic + footer.
3. **v4 app** — register a member on `https://app.<APPS_IP>.sslip.io`, then open a **maven** → the
   **percent-only proof** (100-at-inception index; currency never enters). This is the money shot:
   %-only performance with **no dollar figure anywhere** on the maven or public surface (#4/#8).

---

## Optional WhatsApp test loop (free, ~30 min)

Uses a **free Meta test number** — **official Cloud API only, never a WhatsApp-Web library** — and the
1:1 intake model. No Business Verification needed for the test number. Full clicks in
`gcp/whatsapp/WHATSAPP-SETUP.md` Parts 1–4; this is the condensed loop.

1. **Meta app + test number** (`developers.facebook.com/apps` → WhatsApp → Set up). Collect into
   `/opt/desisquare/.env`: `PHONE_NUMBER_ID_COMMUNITY`, `WABA_ID`, `META_SYSTEM_USER_TOKEN` (24 h temp),
   `META_APP_ID`, `META_APP_SECRET`. Add your own phone as a test recipient. Restart:
   `docker compose up -d wa-bridge`.
2. **Prove outbound** — send the pre-approved `hello_world` template via a Graph API `curl` to your
   number; you receive it on WhatsApp.
3. **Verify the webhook** (no ngrok — the bridge is already public behind Caddy): App Dashboard →
   WhatsApp → Configuration → Webhook → callback `https://wa.<APPS_IP>.sslip.io/webhooks/whatsapp`,
   verify token = `WEBHOOK_VERIFY_TOKEN`, **Verify and save**, then subscribe the **`messages`** field.
4. **Prove the loop** — reply from your phone → a topic appears in **WhatsApp Intake** with the sender
   as `member-XXXX` (**never the E.164 number**, #5). Reply in Discourse → `post_created` fires → the
   bridge sends it back to your phone. Bidirectional loop proven. `STOP` suppresses outbound (opt-out).

---

## Verify the demo

| Check | How | Expected |
|---|---|---|
| Four URLs live | `curl -sI` each of community / app / folio / wa | `200` + valid TLS on sslip.io |
| Services green | `docker compose ps` on `apps-1` | all healthy/running |
| Engine tests | `make test` (or `node --test` per service) | green |
| Community sim | `make community-test` (set `DISCOURSE_URL`, `DISCOURSE_API_KEY`) — the 50-user sim in `test/community-sim/` | passes against the live Discourse |
| **$-leak spot check** | `node docs/gf-stats-contract/leak-sweep.test.mjs`; eyeball a maven + a public surface | **no currency symbol/code/value** anywhere (#4/#8) |
| Anon = teaser | anonymous `GET /latest.json` on Discourse | 403 / redirect (#7-A) |

---

## Teardown (and the cost reminder)

Demo costs **~$0.10/hour (~$75/mo if left running)**. When you're done, tear it all down:

```bash
bash gcp/scripts/99-teardown.sh          # deletes the VMs, IPs, firewall, bucket
```

Leaving it up overnight is a couple of dollars; leaving it up for a month is ~$75. Tear down or expect
the bill.

---

## Promote to production (when you're ready)

**Same package, no rework.** The demo you just built becomes production by swapping demo shortcuts for
real infrastructure — follow `PRODUCTION-DEPLOYMENT-GUIDE.md`:

1. **Buy a domain** → re-point four A records (`community`/`app`/`folio`/`wa`) from sslip.io to the same
   two IPs; change `DOMAIN`/hostname values.
2. **Real SMTP** (Brevo/Mailgun, port 587) in `app.yml` + `./launcher rebuild app` → real signup emails.
3. **Meta Business Verification** (start Day 0 — it's the 1–3 week critical path) → real WhatsApp number,
   permanent system-user token in Secret Manager, Advanced Access.
4. Add F5 hardening: offsite backups + restore drill, Ops Agent uptime checks, billing budget alert,
   secrets in Secret Manager.

Nothing you built in the demo is throwaway — the VMs, the compose stack, the wiring, and all six
constraints carry straight into production.
