# DesiSquare — Production Deployment Guide

**One runbook, nothing to nothing-left-out.** Follow this end-to-end to stand up the *real* production
DesiSquare stack: a live **Discourse** community, a live **Ghostfolio** portfolio engine, the
**WhatsApp** channel on the official **Meta Cloud API**, and the **DesiSquare v4 app + services**
(wa-bridge, gf-provisioner, models-service) — all wired together on GCP behind automatic TLS.

- **Who this is for:** a technical operator (you) with shell access, `gcloud` installed, and admin
  rights on the client's GCP project, domain registrar, SMTP relay, and Meta Business account.
- **End state you will have:**
  - `https://community.<domain>` — Discourse, HTTPS, SMTP signups working, mod queue, backups.
  - `https://folio.<domain>` — Ghostfolio, admin claimed, Postgres 15 + Redis 7 behind it.
  - `https://app.<domain>` — the DesiSquare v4 forum/experience, wired to all three services.
  - `https://wa.<domain>/webhooks/whatsapp` — the WhatsApp bridge, bidirectional loop live.
  - Nightly offsite backups, uptime alerting, a billing budget alarm, secrets in Secret Manager.
- **Timeline:** web live in **~2 days**; WhatsApp *production* in **1–3 weeks** — Meta Business
  Verification is the critical path, so **start it on Day 0** (Phase F0). The free Meta **test
  number** proves the whole loop immediately, so nothing else waits on Meta.

This guide is the single source of truth and it stands on its own. It synthesizes and supersedes the
day-by-day narrative in the source docs; consult them for extra depth by path:
`deploy/gcp/RUNBOOK.md` (topology + go-live), `deploy/gcp/CLAUDE.md` (demo vs prod, non-interactive
Discourse), `deploy/gcp/REQUIREMENTS.md` (F0–F5 acceptance), `deploy/gcp/whatsapp/WHATSAPP-SETUP.md`
(WhatsApp Parts 1–5), `deploy/CLIENT-INFRA-CHECKLIST.md` (what the client provides),
`docs/runbooks/demo-install-00-overview.md` (+ 01/02/03), and `v4/DEPLOY.md` (app↔Discourse↔Ghostfolio wiring).

> **Placeholders.** Everything in angle brackets is yours to fill: `<domain>`, `<PROJECT_ID>`,
> `<REGION>`, `<ZONE>`, `<DISCOURSE_IP>`, `<APPS_IP>`, `<TOKEN>`, `<SECRET>`, `<PHONE_NUMBER_ID>`.
> **Never commit or print real secrets.** `.env` files stay on the VM at mode `600`; tokens live in
> GCP Secret Manager as the source of truth.

---

## 1. Six product constraints that MUST survive deployment

These are not optional hardening — they are the product. Verify each one is intact after every phase.

| # | Constraint | Where it is enforced in this deploy |
|---|---|---|
| **#3** | Flags are **private** (5 reasons → mod review queue); no public flag indicators | Discourse native flag/review queue (F2) |
| **#4** | Portfolio **dollars owner-only**; public surfaces show allocation **%** only, default private | gf-provisioner + v4 app; Ghostfolio $ is owner-only (F3) |
| **#5** | WhatsApp mirroring/notifications **consent-gated**; **E.164 numbers never appear anywhere** | wa-bridge (pseudonymizes to `member-XXXX`, STOP opt-out) (F4) |
| **#7-A** | Anonymous visitors get only the curated **public teaser**; every member endpoint 401/403s | Discourse login-required + v4 teaser (F2/F3) |
| **#8** | Maven performance is **percent-only**; currency stripped **server-side** | models-service / gf-stats % index (F3) |
| **#9** | Recognition ranks **engagement, never money** | Discourse karma weights; no portfolio data on leaderboards (F5) |

If you edit any config below, re-run the leak-sweep guard
(`node docs/gf-stats-contract/leak-sweep.test.mjs`, story 12.5) — it is the machine backstop.

---

## 2. Architecture recap

Production is **two GCP VMs** (recommended default). Discourse owns its own VM because its only
supported install is the Docker launcher on a plain Linux host it fully controls. Everything else —
Ghostfolio, the DesiSquare v4 app, and the three Node services — shares a second VM behind a single
**Caddy** that terminates TLS for all three app subdomains and gets Let's Encrypt certs automatically.

```
                          Internet  (only 80/443 open; SSH via IAP tunnel only)
                              │
        ┌─────────────────────┼──────────────────────────────────────────┐
        ▼                     ▼                     ▼                      ▼
 community.<domain>     app.<domain>          folio.<domain>          wa.<domain>
        │                     └──────────────────────┼──────────────────────┘
        ▼                                            ▼
┌────────────────────┐              ┌──────────────────────────────────────────────┐
│  VM discourse-1     │              │  VM apps-1  (e2-standard-2, 40GB, Ubuntu 24.04)│
│  e2-medium, 40GB    │              │  ── Caddy (:80/:443, TLS for all 3 subdomains) │
│  Ubuntu 24.04       │              │  ── DesiSquare v4 app        :8786  /api/health│
│  official Docker    │◄────webhook──│  ── gf-provisioner           :8789  /health    │
│  Discourse (:443)   │  post_created│  ── wa-bridge                :8788  /health    │
│  + 2GB swap         │              │  ── models-service           :8791  /health    │
│  built-in backups   │─────API─────►│  ── Ghostfolio               :3333  /api/v1/health
└────────────────────┘              │  ── Postgres 15   ── Redis 7                    │
        │                            └──────────────────────────────────────────────┘
        │                                            │
        └───────────────► GCS bucket gs://<PROJECT_ID>-backups (nightly, 30-day lifecycle) ◄──┘
                          Secrets → GCP Secret Manager   ·   Outbound: Brevo SMTP :587, Meta Graph API
```

**Data & trust flow.** A member messages the WhatsApp number → Meta posts to
`wa.<domain>/webhooks/whatsapp` → wa-bridge verifies the HMAC signature, dedupes on `wamid`,
pseudonymizes the sender, and creates a topic in Discourse's **WhatsApp Intake** category. A staff
reply in Discourse fires Discourse's `post_created` webhook → `wa.<domain>/webhooks/discourse` →
wa-bridge sends the reply back to the member (free-form if inside the 24h window, else the approved
`community_reply` template). On signup, gf-provisioner creates/links exactly one Ghostfolio account
and mints the "Open in Ghostfolio →" 1-click SSO link. models-service computes the maven
**percent-only** performance index (100 at inception; currency never enters).

**Alternatives (GCP is the spine of this guide; these are noted for completeness):**
- **Single VPS** (DigitalOcean / Lightsail, ~$40–60/mo): the same Discourse launcher on one
  $12–24 box, Ghostfolio + services alongside. Fine at small scale; you lose GCP's IAP/Secret
  Manager/managed backups. See `deploy/CLIENT-INFRA-CHECKLIST.md` Option B.
- **Managed Discourse** (discourse.org / Communiteq, ~$50–100/mo): zero-ops forum, but plugin/tier
  limits and you still host Ghostfolio + services yourself. Option C.
- **Ghostfolio on Railway**: Ghostfolio deploys cleanly on Railway (one-click template) even if
  Discourse can't. Valid hybrid; wire `GHOSTFOLIO_URL` to the Railway URL. See `v4/DEPLOY.md` §C.
- ❌ **Discourse on Railway** — community image is frozen (no security updates). Demo-only, never prod.

**Cost at pilot (<1,000 members): ~$100/mo all-in** — see §13 for the breakdown.

---

## 3. Prerequisites — client pre-flight (what the client must provide)

From `deploy/CLIENT-INFRA-CHECKLIST.md` (items 1–7). Order is by lead time. **Item 4 (WhatsApp
Business Verification) is the Day-0 critical path — start it before anything else.**

| # | Item | Lead time | Blocks | Verify |
|---|---|---|---|---|
| 1 | **GCP project + billing enabled**; `Owner`/`Editor` to deploy account. Region choice (`us-central1` default, `asia-south1` India-first). Budget sign-off ~$150/mo. | same day | everything | `gcloud beta billing projects describe <PROJECT_ID>` → `billingEnabled: true` |
| 2 | **Registered domain + DNS access** to create 4 A records (`community`/`app`/`folio`/`wa`) plus email TXT records. | same day | HTTPS + email | registrar console reachable |
| 3 | **SMTP relay** — Brevo (free 300/day), Mailgun, SES, or Postmark. Need the **SMTP key** (Brevo: `xsmtpsib-…`, *not* the API key), a sender e.g. `no-reply@<domain>`, and permission to add **SPF/DKIM/DMARC** TXT records. **Port 587** (GCP blocks 25). | same day | real signups | send a test email via the relay |
| 4 | **WhatsApp / Meta** — Meta developer account + app; **Business Verification STARTED (Day 0)**; a dedicated phone number (not an active personal WhatsApp) + a display name. | **1–3 weeks** | WA production only | verification status = pending/approved |
| 5 | **GitHub access / deploy key** to the DesiSquare app repo so apps-1 can pull it. Agreement that all tokens live in **Secret Manager**; `.env` on the VM only. Named platform-admin + ops/moderation contacts. | same day | app deploy (F3) | `git ls-remote` from apps-1 succeeds |
| 6 | *(Optional)* LLM API key (Anthropic/OpenAI, ~$20–50/mo) for Discourse AI summaries/auto-labels; S3/GCS bucket for upload offload. Falls back to keyword rules if absent. | same day | — | key accepted |
| 7 | *(Product decisions)* karma weights, corridor benchmarks (S&P 500 TR / Nifty 50 TR), launch corridors, teaser stays `noindex`. | anytime pre-launch | copy/config | recorded |

**With items 1–3 in hand, the web tier can be live the same day.** Item 4 gates only the WhatsApp
production loop (the test number needs none of it).

---

## 4. Phase F0 — Accounts & prerequisites

Goal: authenticated tooling and every external account in flight. Provision **nothing** yet.
Acceptance criteria: `deploy/gcp/REQUIREMENTS.md` F0.1–F0.6.

**F0.1 — gcloud auth on a billing-enabled project.**
```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud auth list                                   # expect a non-empty ACTIVE account
gcloud beta billing projects describe <PROJECT_ID> # expect billingEnabled: true
```
If the project does not exist: `gcloud projects create <PROJECT_ID>` then have the client enable
billing in the console (only the client can do this).

**F0.2 — Region/zone.** Default `us-central1` / `us-central1-a`; use `asia-south1` (Mumbai) for an
India-first audience. Write your choices into the config block of `deploy/gcp/scripts/01-gcp-provision.sh`
(`PROJECT_ID`, `REGION`, `ZONE`, `DOMAIN`).

**F0.3 — Mode = PRODUCTION.** Confirm registrar access for the real domain (demo mode uses sslip.io
and is out of scope here).

**F0.4 — SMTP relay (required — Discourse will not run without email).** Create the Brevo/Mailgun/SES
account, capture host/port/user/pass (**port 587**), and add the DNS records the relay gives you:
- **SPF:** `TXT @  "v=spf1 include:<relay-spf-include> ~all"`
- **DKIM:** the `TXT <selector>._domainkey` record the relay supplies
- **DMARC:** `TXT _dmarc  "v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>"`
Verify by sending a test through the relay and by `dig +short txt <domain>` showing the SPF record.

**F0.5 — Meta app + Business Verification (START NOW — longest lead time).**
1. Create a Business portfolio at `business.facebook.com`.
2. **Security Center → Start Business Verification** — this is the production critical path (days→weeks).
3. Create the developer app at `developers.facebook.com/apps` → use case *"Connect with customers
   through WhatsApp"* → attach the Business portfolio (full clicks in F4 / `WHATSAPP-SETUP.md` Part 1).
4. Capture **App ID** and **App secret** (App settings → Basic).
Verify: App ID + secret captured; verification status shows pending or approved.

**F0.6 — GitHub deploy key.** Add a read-only deploy key for the DesiSquare app repo (repo → Settings
→ Deploy keys). You'll confirm `git ls-remote` from apps-1 in F3.

**F0 acceptance:** all of F0.1–F0.6 above pass. Do not start F1 until they do.

---

## 5. Phase F1 — GCP foundation

Goal: two VMs, locked-down firewall, backup bucket, DNS resolving. Run
`deploy/gcp/scripts/01-gcp-provision.sh` from your workstation/Cloud Shell (edit its config block
first). It performs every step below; the commands are shown so you can run/verify them individually.

**F1.0 — Enable APIs.**
```bash
gcloud services enable compute.googleapis.com dns.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com \
  monitoring.googleapis.com logging.googleapis.com
```

**F1.1 — Static IPs + two VMs (Ubuntu 24.04 LTS).**
```bash
gcloud compute addresses create discourse-ip --region=<REGION>
gcloud compute addresses create apps-ip      --region=<REGION>
DISCOURSE_IP=$(gcloud compute addresses describe discourse-ip --region=<REGION> --format='value(address)')
APPS_IP=$(gcloud compute addresses describe apps-ip --region=<REGION> --format='value(address)')

gcloud compute instances create discourse-1 \
  --zone=<ZONE> --machine-type=e2-medium \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=40GB --boot-disk-type=pd-balanced \
  --address="$DISCOURSE_IP" --tags=web --metadata=enable-oslogin=TRUE

gcloud compute instances create apps-1 \
  --zone=<ZONE> --machine-type=e2-standard-2 \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=40GB --boot-disk-type=pd-balanced \
  --address="$APPS_IP" --tags=web --metadata=enable-oslogin=TRUE
```
*Verify:* `gcloud compute instances list` → both `RUNNING` with reserved IPs.

**F1.2 — Firewall: only 80/443 public; SSH via IAP range only.**
```bash
gcloud compute firewall-rules create allow-web \
  --allow=tcp:80,tcp:443 --target-tags=web --direction=INGRESS
gcloud compute firewall-rules create allow-iap-ssh \
  --allow=tcp:22 --source-ranges=35.235.240.0/20 --direction=INGRESS
```
*Verify:* `gcloud compute firewall-rules list` shows both; **no** rule opens 22 to `0.0.0.0/0`.

**F1.3 — Backup bucket with 30-day lifecycle + VM write access.**
```bash
gsutil mb -l <REGION> gs://<PROJECT_ID>-backups
printf '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > /tmp/lifecycle.json
gsutil lifecycle set /tmp/lifecycle.json gs://<PROJECT_ID>-backups
SA=$(gcloud iam service-accounts list \
  --filter="displayName:'Compute Engine default service account'" --format='value(email)')
gsutil iam ch "serviceAccount:${SA}:roles/storage.objectAdmin" gs://<PROJECT_ID>-backups
```
*Verify:* `gsutil ls gs://<PROJECT_ID>-backups` OK; a test upload from a VM succeeds (F5).

**F1.4 — DNS A records.** At the registrar (or Cloud DNS) create all four pointing at the right IP:

| Record | Type | Value |
|---|---|---|
| `community.<domain>` | A | `<DISCOURSE_IP>` |
| `app.<domain>` | A | `<APPS_IP>` |
| `folio.<domain>` | A | `<APPS_IP>` |
| `wa.<domain>` | A | `<APPS_IP>` |

*Verify (wait for propagation):*
```bash
for h in community app folio wa; do echo -n "$h → "; dig +short $h.<domain>; done
```
Each must return the expected IP before you install anything that requests a TLS cert.

**F1.5 — IAP SSH works to both VMs.**
```bash
gcloud compute ssh discourse-1 --zone=<ZONE> --tunnel-through-iap -- true   # exits 0
gcloud compute ssh apps-1      --zone=<ZONE> --tunnel-through-iap -- true    # exits 0
```

**F1 acceptance:** F1.1–F1.5 all pass (VMs RUNNING, firewall correct, bucket writable, DNS resolves, IAP SSH green).

---

## 6. Phase F2 — Community (Discourse)

Goal: Discourse live over HTTPS at `community.<domain>` with working email, the WhatsApp Intake
category, the global API key, the `post_created` webhook, nightly backups, and the trust/tone policy.
Reference: `deploy/gcp/scripts/02-discourse-install.sh`, `WHATSAPP-SETUP.md` Part 4 (Discourse side).

**F2.1 — Install (official Docker launcher, 2GB swap).** SSH in and run the install script:
```bash
gcloud compute ssh discourse-1 --zone=<ZONE> --tunnel-through-iap
sudo -i
# copy deploy/gcp/scripts/02-discourse-install.sh onto the VM, then:
bash 02-discourse-install.sh          # adds 2GB swap, installs Docker, clones discourse_docker
```
The script performs the equivalent of:
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
curl -fsSL https://get.docker.com | sh
git clone https://github.com/discourse/discourse_docker.git /var/discourse
cd /var/discourse && chmod 700 containers
```

**F2.2 / F2.3 / F2.4 — Interactive setup, HTTPS, admin, signup email.**
```bash
cd /var/discourse && ./discourse-setup
```
Answer the prompts:

| Prompt | Value |
|---|---|
| Hostname | `community.<domain>` |
| Admin email(s) | your email (becomes the first admin) |
| SMTP server / port | e.g. `smtp-relay.brevo.com` / `587` |
| SMTP user / password | from your Brevo/Mailgun account |
| Let's Encrypt email | your email (auto-HTTPS) |

The first build takes ~5–10 min. Then open `https://community.<domain>`, register with the admin
email, and **confirm the activation email arrives** (F2.4). If it doesn't, SMTP is misconfigured —
fix `containers/app.yml` and `cd /var/discourse && ./launcher rebuild app`.
*Verify HTTPS:* `curl -sI https://community.<domain>` → `200` with a valid cert.

**F2.5 — Categories incl. WhatsApp Intake (record the id).** Admin → run the setup wizard, then create
your corridor/space categories. Create a category named **WhatsApp Intake** and note its numeric id
(shown in the category URL and in `/categories.json`). Record it — it becomes
`DISCOURSE_WA_CATEGORY_ID` in the apps `.env` (F3).

**F2.6 — Global API key + `post_created` webhook.**
- Admin → API → **New API Key** → user `system`, scope **global** → copy the key → this is
  `DISCOURSE_API_KEY`.
- Admin → API → **Webhooks → New** →
  - Payload URL: `https://wa.<domain>/webhooks/discourse`
  - Content type: `application/json`
  - **Secret**: choose a strong value → this is `DISCOURSE_WEBHOOK_SECRET` (set the identical value on
    wa-bridge and gf-provisioner in F3 — an empty secret disables HMAC verification, which is forbidden
    in production).
  - Trigger: **Post event → Post is created** (`post_created`).
  - Active: yes. TLS verify: on.

**F2.7 — force_https + nightly backups.**
- Admin → Settings → search `force_https` → **enable**.
- Admin → Backups → enable **automatic nightly backups**, retention **7 days** (offsite copy added in F5).

**F2.8 — Trust & tone.** Pseudonym-friendly username policy (allow handles like `quiet_lotus`);
add the **"community discussion, not financial advice"** disclaimer to the welcome topic and the site
footer (Admin → Customize → Themes → footer). Keep the community **login-required** so anonymous
visitors hit only the curated teaser (constraint **#7-A**): Admin → Settings → `login required` = on.

**F2 acceptance:** container `app` running; `curl -sI https://community.<domain>` → 200; admin can log
in; activation email received (not spam); WhatsApp Intake id recorded; API key + webhook + secret set;
`force_https` on; nightly backups on; disclaimer visible; anonymous `/latest.json` returns 403/redirect.

---

## 7. Phase F3 — Ghostfolio + DesiSquare app + services

Goal: the compose stack (Ghostfolio + Postgres 15 + Redis 7 + Caddy + wa-bridge + gf-provisioner +
models-service + the v4 app) live on apps-1; HTTPS on `folio.<domain>` and `app.<domain>`; the v4 app
wired to Discourse, Ghostfolio, and the services. Reference: `deploy/gcp/apps-stack/` (compose,
Caddyfile, `.env.sample`), `deploy/gcp/scripts/03-apps-vm-setup.sh`, `v4/DEPLOY.md`.

**F3.1 — Ship the stack to apps-1 and generate secrets.** From your workstation:
```bash
gcloud compute scp --recurse deploy/gcp/apps-stack deploy/gcp/wa-bridge \
  apps-1:~ --zone=<ZONE> --tunnel-through-iap
gcloud compute ssh apps-1 --zone=<ZONE> --tunnel-through-iap
bash ~/apps-stack/../03-apps-vm-setup.sh    # or: bash 03-apps-vm-setup.sh from where you copied it
```
The **first run** installs Docker, lays out `/opt/desisquare`, copies `.env.sample` → `.env`, and
auto-generates the random secrets with `openssl rand`:
`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ACCESS_TOKEN_SALT`, `JWT_SECRET_KEY`, `BRIDGE_API_KEY`,
`WEBHOOK_VERIFY_TOKEN`. It then exits and asks you to edit `.env`.

**F3.2 — Fill `.env`, lock it to mode 600.** Edit `/opt/desisquare/.env`:
```bash
sudo nano /opt/desisquare/.env
```
Set at minimum (leave the auto-generated secrets as-is):
```dotenv
DOMAIN=<domain>
ACME_EMAIL=<you@domain>
# Bridge ↔ Discourse (from F2):
DISCOURSE_BASE_URL=https://community.<domain>   # canonical wiring key: DISCOURSE_URL — set both to be safe
DISCOURSE_API_KEY=<from F2.6>
DISCOURSE_API_USERNAME=system
DISCOURSE_WA_CATEGORY_ID=<WhatsApp Intake id from F2.5>
DISCOURSE_WEBHOOK_SECRET=<the exact secret you set on the Discourse webhook in F2.6>
# Meta values are filled in F4 (leave WEBHOOK_VERIFY_TOKEN as generated for now).
```
Then:
```bash
sudo chmod 600 /opt/desisquare/.env
stat -c '%a' /opt/desisquare/.env    # must print 600
```
> **Env-key reconciliation:** the shipped `apps-stack/.env.sample` names the Discourse base URL
> `DISCOURSE_BASE_URL`; the canonical wiring variable (used by the v4 app and the `services/` bridge) is
> `DISCOURSE_URL`. Set both to the same value so whichever build you run finds it. Full table in §10.

**F3.3 — Add the services + v4 app to the compose stack.** The shipped `docker-compose.yml` already
defines `caddy`, `ghostfolio`, `postgres`, `redis`, and `wa-bridge`. Add `gf-provisioner`,
`models-service`, and the v4 `desisquare-app` service (uncomment/extend the app slot). Each service
reads `.env`; set its listen `PORT` to match the Caddy target:

```yaml
  desisquare-app:                 # v4 forum/experience
    build: ./app                  # git clone of the DesiSquare app repo (F3.5)
    restart: unless-stopped
    env_file: .env
    environment:
      PORT: 8786
      PUBLIC_URL: https://app.${DOMAIN}
      DISCOURSE_URL: https://community.${DOMAIN}
      DISCOURSE_WEBHOOK_SECRET: ${DISCOURSE_WEBHOOK_SECRET}
      GHOSTFOLIO_URL: http://ghostfolio:3333
      GF_PROVISIONER_URL: http://gf-provisioner:8789
      WA_BRIDGE_URL: http://wa-bridge:8788
    depends_on: [ghostfolio, gf-provisioner, wa-bridge, models-service]

  gf-provisioner:
    build: ./gf-provisioner
    restart: unless-stopped
    env_file: .env
    environment:
      PORT: 8789
      GHOSTFOLIO_URL: http://ghostfolio:3333
      GHOSTFOLIO_LIVE: "true"
      DISCOURSE_WEBHOOK_SECRET: ${DISCOURSE_WEBHOOK_SECRET}

  models-service:
    build: ./models-service
    restart: unless-stopped
    env_file: .env
    environment:
      PORT: 8791
```
Set the `wa-bridge` service's internal `PORT` to `8788` (the shipped sample uses `3000`; either works
as long as the Caddyfile target matches). Then update the Caddyfile so every subdomain proxies to the
right container:
```caddyfile
{
        email {$ACME_EMAIL}
}
folio.{$DOMAIN} { reverse_proxy ghostfolio:3333 }
wa.{$DOMAIN}    { reverse_proxy wa-bridge:8788 }
app.{$DOMAIN}   { reverse_proxy desisquare-app:8786 }
```

**F3.5 — Clone the app into the compose app slot.**
```bash
# On apps-1, using the deploy key from F0.6:
git clone git@github.com:kalilurrahman/DesiSquareV3.git /opt/desisquare/app_src
# The v4 app lives in the v4/ subtree; point the build at it (Dockerfile is v4/Dockerfile):
ln -s /opt/desisquare/app_src/v4 /opt/desisquare/app
ln -s /opt/desisquare/app_src/services/gf-provisioner /opt/desisquare/gf-provisioner
ln -s /opt/desisquare/app_src/services/models-service /opt/desisquare/models-service
git ls-remote git@github.com:kalilurrahman/DesiSquareV3.git >/dev/null && echo "deploy key OK"  # F0.6
```
> The v4 server reads the host `PORT` (Railway/GCP inject it; here we set `8786`), health at
> `/api/health`. See `v4/DEPLOY.md` and `v4/railway.json`.

**F3.1 (start) — Bring the stack up.**
```bash
cd /opt/desisquare
sudo docker compose pull
sudo docker compose up -d --build
sudo docker compose ps          # all services healthy/running
```
*Verify health endpoints:*
```bash
curl -sf https://folio.<domain>/api/v1/health   # Ghostfolio
curl -sf https://app.<domain>/api/health        # v4 app
curl -sf https://wa.<domain>/health             # wa-bridge
# internal (from the VM): gf-provisioner :8789/health, models-service :8791/health
docker compose exec desisquare-app wget -qO- http://gf-provisioner:8789/health
docker compose exec desisquare-app wget -qO- http://models-service:8791/health
```

**F3.3 (Ghostfolio) — Claim admin. STORE THE TOKEN — it is unrecoverable.** Open
`https://folio.<domain>`, create the **first user** (the first `POST /api/v1/user` becomes admin) and
**immediately save the security token** in the team vault / Secret Manager. There is no recovery.
Set a data provider in the admin panel if desired (free Yahoo/CoinGecko defaults are fine). Keep
sign-ups open or closed per your pilot policy.

**F3.6 — Cutover from any prior host (if migrating).** If the app currently runs on Railway: freeze
writes → export persistent data (DB dump / volume) → import on GCP → verify `app.<domain>` fully →
only then re-point DNS and scale the old service to zero. No data loss; both URLs serve during the
transition.

**F3.7 — Cross-links.** Ensure app ↔ community ↔ folio navigation resolves on all three surfaces
(header links / footer). The v4 app **probes** `DISCOURSE_URL/about.json`, `GHOSTFOLIO_URL`, and the
services and reports each as ● up in its demo drawer.

**Graceful degradation & the percent-only guarantee.** The v4 app is self-contained and **degrades
gracefully**: if Ghostfolio is down, "Open in Ghostfolio →" shows a hint instead of erroring; if
wa-bridge is down, WhatsApp mirroring falls back; seeded content renders so the site is never blank.
Crucially, the **percent-only guarantee is structural, not a runtime check**: models-service computes
an equity **percent index (100 at inception)** — currency never enters the maven pipeline, so
constraints **#4/#8** hold even during partial outages. Owner dollar values render **only** at the
owner's private `#/me` surface in Ghostfolio and must never appear on a public or maven surface
(leak-sweep, story 12.5). gf-provisioner enforces `GHOSTFOLIO_LIVE=true` and the shared webhook secret.

**F3 acceptance:** `docker compose ps` all healthy; `.env` mode 600; `folio.<domain>` + `app.<domain>`
serve valid TLS; Ghostfolio admin claimed (token stored); v4 core pages render 200; wiring env vars set
so v4↔Discourse and gf-provisioner↔Ghostfolio are live; cross-links resolve; a `curl` of the maven
stats output contains **no currency symbol/code/value** (`node docs/gf-stats-contract/leak-sweep.test.mjs`).

---

## 8. Phase F4 — WhatsApp channel (Meta Cloud API)

Goal: prove the full bidirectional loop on the **free test number** first (Parts 1–4), then flip to
production once Meta verification clears (Part 5). Official **Meta Cloud API only** — never a
WhatsApp-Web library (ToS violation, ban risk). Reference: `deploy/gcp/whatsapp/WHATSAPP-SETUP.md`.

> **Scope decision (this deployment): 1:1 intake only.** Members message the DesiSquare business
> number → topic in Discourse → reply → member. This is fully official-Cloud-API and ToS-compliant.
> WhatsApp **group mirroring is OUT OF SCOPE**: the optional `wa-bridge` inbound seam
> (`src/wa-client-live.js`, unofficial `whatsapp-web.js`) stays **disabled** — leave `WA_BACKEND`
> unset and do **not** run `npm run install:wa`, so `whatsapp-web.js`/Chromium are never installed.
> Revisit only as a separately-approved exception (see `docs/SECURITY-COMPLIANCE.md`).

Platform rules the bridge already enforces: **24-hour window** (free-form in-window, approved
`community_reply` template outside); **HMAC signature verify** (`X-Hub-Signature-256`, raw body, app
secret); **`wamid` dedupe** (Meta delivers at-least-once); **STOP/UNSUBSCRIBE/CANCEL opt-out**;
**pseudonymization** (`member-XXXX`, never the E.164 number → constraint **#5**).

**Part 1 — App + test number (~30 min, free, no verification).**
1. `developers.facebook.com/apps` → your app → **WhatsApp → Set up**: Meta auto-creates a **test WABA**,
   a **test number**, and the pre-approved `hello_world` template.
2. **WhatsApp → API setup**: collect these into `/opt/desisquare/.env`:

   | Meta value | `.env` key |
   |---|---|
   | Phone number ID (test) | `PHONE_NUMBER_ID_COMMUNITY` |
   | WABA ID | `WABA_ID` |
   | Temporary access token (24h) | `META_SYSTEM_USER_TOKEN` |
   | App ID / App secret | `META_APP_ID` / `META_APP_SECRET` |

3. **API setup → To**: add your own phone as a test recipient (max 5) and verify the code.
4. Restart the bridge to pick up the values: `cd /opt/desisquare && sudo docker compose up -d wa-bridge`.

**Part 2 — Prove outbound (2 min).**
```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"<YOUR_NUMBER_E164>","type":"template",
       "template":{"name":"hello_world","language":{"code":"en_US"}}}'
```
You receive "Hello World" on your phone → outbound works.

**Part 3 — Verify the inbound webhook.** No ngrok — the bridge is already public behind Caddy.
1. Confirm `WEBHOOK_VERIFY_TOKEN` is set in `.env` and the stack is up.
2. App Dashboard → **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://wa.<domain>/webhooks/whatsapp`
   - Verify token: the `WEBHOOK_VERIFY_TOKEN` value
   - **Verify and save** (Meta calls the GET handshake; the bridge echoes `hub.challenge`).
3. Click **Manage** → subscribe to the **`messages`** field (inbound + delivery statuses). Optionally
   `message_template_status_update` for template-approval callbacks.

**Part 4 — Prove the full loop (5 min).**
1. Reply to the hello-world conversation from your phone. Watch `sudo docker compose logs -f wa-bridge`:
   the message lands and a topic appears in Discourse under **WhatsApp Intake** (sender shown as
   `member-XXXX`, never the number).
2. Reply to that topic in Discourse as any user other than `system`. Discourse's `post_created` webhook
   fires → the bridge sends the reply → your phone receives it. **Bidirectional loop proven.**
3. Demonstrate the guardrails: send a tampered payload → **401** (signature check, F4.3); a duplicate
   `wamid` → a single Discourse post (dedupe); reply **STOP** → outbound suppressed until you message
   again (opt-out, F4.6).

**Part 4 (Discourse side, one-time)** was completed in F2.5/F2.6 (WhatsApp Intake category id, the
`system` global API key, and the `post_created` webhook to `wa.<domain>/webhooks/discourse`).

**Submit the templates now** (approval takes time): WhatsApp → **Manage templates** → submit the three
in `deploy/gcp/whatsapp/message-templates.json` — `community_reply` (UTILITY), `optin_confirm`
(UTILITY), `weekly_digest` (MARKETING). Each carries the "not financial advice" line and a
"Reply STOP to opt out" footer. *Note: US (+1) marketing templates are paused by Meta (since Apr 2025)
— US-corridor digests go via email or the free in-window service reply.*

**Part 5 — Production (Week 2–3, gated on Meta verification).**
1. **Business Verification approved** (started Day 0 in F0.5).
2. **Real business number:** WhatsApp → API setup → **Add phone number** (must NOT be registered on the
   consumer WhatsApp app) → set the **display name** ("DesiSquare"; Meta reviews it).
3. **Permanent system-user token:** Business settings → **System users** → create → assign the app +
   WABA → generate a token with `whatsapp_business_messaging` + `whatsapp_business_management`. Store it
   in Secret Manager and replace the 24h temp token in `.env`:
   ```bash
   printf '%s' '<PERMANENT_TOKEN>' | gcloud secrets create meta-system-user-token --data-file=-
   # then paste it into /opt/desisquare/.env → META_SYSTEM_USER_TOKEN, and: docker compose up -d wa-bridge
   ```
4. **Advanced Access** for WhatsApp permissions (App Review) so **non-test** numbers can be messaged;
   messaging limits then rise in tiers as your quality rating stays green.
5. Point the **production WABA webhook** at `https://wa.<domain>/webhooks/whatsapp`; keep dev/prod
   credentials separate.
6. **Publish the number** on the site: `https://wa.me/<number>?text=Hi%20DesiSquare` ("WhatsApp us").

**F4 env-var table (all on wa-bridge, in `/opt/desisquare/.env`):**

| Variable | Purpose |
|---|---|
| `PHONE_NUMBER_ID_COMMUNITY` | Meta phone number ID to send from |
| `WABA_ID` | WhatsApp Business Account ID |
| `META_SYSTEM_USER_TOKEN` | Bearer token (24h temp for test → permanent system-user for prod) |
| `META_APP_ID` / `META_APP_SECRET` | App identity; app secret verifies the webhook HMAC |
| `WEBHOOK_VERIFY_TOKEN` | GET-handshake token Meta must echo |
| `META_GRAPH_API_VERSION` | e.g. `v21.0` |
| `WEBHOOK_PATH` | `/webhooks/whatsapp` |
| `DISCOURSE_URL` (`DISCOURSE_BASE_URL`) | Where the bridge posts intake topics |
| `DISCOURSE_API_KEY` / `DISCOURSE_API_USERNAME` | `system` global key to create topics |
| `DISCOURSE_WEBHOOK_SECRET` | HMAC for the Discourse `post_created` callback |
| `DISCOURSE_WA_CATEGORY_ID` | Numeric id of "WhatsApp Intake" |
| `SERVICE_WINDOW_HOURS` | `24` — the free-form window |
| `OPT_OUT_KEYWORDS` | `STOP,UNSUBSCRIBE,CANCEL` |

**F4 troubleshooting:**

| Symptom | Fix |
|---|---|
| Webhook won't verify | `WEBHOOK_VERIFY_TOKEN` mismatch, or stack down / `wa.` DNS not propagated |
| No inbound webhooks | `messages` field not subscribed in **Manage** |
| Outbound 401 / error 190 | Temp token expired (24h) — regenerate or move to the system-user token |
| Error 131047 "re-engagement" | 24h window closed → template required; check `community_reply` is **APPROVED** |
| Signature check fails | Wrong `META_APP_SECRET`, or a proxy re-serialized the body (Caddy here passes it through untouched) |
| "Recipient not in allowed list" | On the test number, add + verify the recipient (max 5) |

**F4 acceptance:** webhook verified (`messages` subscribed); tampered payload → 401 and duplicate
`wamid` → single post; inbound → pseudonymized topic in WhatsApp Intake; Discourse reply → member's
phone (free-form in-window, template out); STOP suppresses outbound; templates ≥ pending; F4.8
production send to a non-test number succeeds (or mark **blocked-on-Meta** if verification pending).

---

## 9. Phase F5 — Operations, hardening & launch readiness

**F5.1 — Nightly offsite backups + cron on BOTH VMs.** Install `deploy/gcp/scripts/04-backups.sh`:
```bash
sudo cp 04-backups.sh /usr/local/bin/desisquare-backup && sudo chmod +x /usr/local/bin/desisquare-backup
echo '30 2 * * * root BUCKET=gs://<PROJECT_ID>-backups /usr/local/bin/desisquare-backup' \
  | sudo tee /etc/cron.d/desisquare-backup
sudo BUCKET=gs://<PROJECT_ID>-backups /usr/local/bin/desisquare-backup   # run once now
```
On discourse-1 it rsyncs the tar.gz backups Discourse already produces; on apps-1 it `pg_dump`s
Ghostfolio's Postgres and copies `.env` offsite. *Verify:* objects for **both** VMs under
`gs://<PROJECT_ID>-backups/{discourse,ghostfolio,config}/`.

**F5.2 — Restore drill (do it, don't assume).** Download a Discourse backup and restore it via Admin →
Backups on a scratch container; load a Ghostfolio dump into a throwaway Postgres:
```bash
gsutil cp gs://<PROJECT_ID>-backups/ghostfolio/ghostfolio-<DATE>.sql.gz /tmp/
gunzip -c /tmp/ghostfolio-<DATE>.sql.gz | docker compose exec -T postgres psql -U <POSTGRES_USER> <SCRATCH_DB>
```
Document the output. Snapshot Postgres before any Ghostfolio upgrade (auto-migrations run on boot).

**F5.3 — Ops Agent + uptime checks + email alerting.** On both VMs:
```bash
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
sudo bash add-google-cloud-ops-agent-repo.sh --also-install
```
In Cloud Monitoring create **uptime checks** for the four URLs and an email notification channel:
`https://community.<domain>` (200), `https://app.<domain>/api/health`,
`https://folio.<domain>/api/v1/health`, `https://wa.<domain>/health`. Verify all green.

**F5.4 — Billing budget alert (~$150/mo).** Billing → Budgets & alerts → create a budget on the project,
amount `$150`, thresholds 50/90/100% → email the ops contact. Verify it's visible in the console.

**F5.5 — Secrets in Secret Manager as the source of truth.**
```bash
printf '%s' '<META_PERMANENT_TOKEN>'   | gcloud secrets create meta-system-user-token --data-file=-
printf '%s' '<DISCOURSE_API_KEY>'      | gcloud secrets create discourse-api-key      --data-file=-
printf '%s' '<DISCOURSE_WEBHOOK_SECRET>' | gcloud secrets create discourse-webhook-secret --data-file=-
printf '%s' '<BRIDGE_API_KEY>'         | gcloud secrets create bridge-api-key          --data-file=-
gcloud secrets list    # shows all of them
```
`.env` on the VM stays the runtime copy (mode 600); Secret Manager is the recoverable source of truth.

**F5.6 — Security audit.** Confirm: `unattended-upgrades` active (Ubuntu default); **no public SSH**
(`gcloud compute firewall-rules list` — 22 only from `35.235.240.0/20`); `.env` files re-verified
`stat -c %a /opt/desisquare/.env` = `600`; Discourse staff have 2FA enabled; `DISCOURSE_WEBHOOK_SECRET`
is non-empty on Discourse **and** both scripts (empty disables HMAC — see `v4/PRODUCTION.md` Part 3).

**F5.7 — SSO phase-in plan (documented, not flipped at launch).** Launch on **Discourse-native auth**
(email-verified signup, invite-only "desi check"). Plan DiscourseConnect with the DesiSquare app as the
**IdP** so registration happens once, with pseudonymous handles preserved:
1. Set `SSO_SECRET` (rotate the dev default) shared between the app and Discourse.
2. Configure Discourse `enable_discourse_connect` + `discourse_connect_url` → the app's SSO endpoint.
3. Map the app's user id → Discourse `external_id`; keep display handles pseudonymous.
4. Phase in behind a toggle; until then v4's own registration runs standalone (`v4/DEPLOY.md` §B).

**F5.8 — Pilot invite pack.** Welcome topic + disclaimer footer live; `wa.me` link published (once F4.8
done); invite list ready (invite code `DSQ-2026`, corridors US/CA/UK/AE/AU/SG). Run a dry-run invite
end-to-end (signup email → member lands on the Hot-sorted feed → gf-provisioner logs `provisioned` once,
`already_linked` on replay).

**F5 acceptance:** backups for both VMs in the bucket; restore drill documented; uptime checks green;
budget armed; secrets in Secret Manager; audit clean (no public SSH, `.env` 600, unattended-upgrades on);
DiscourseConnect plan written; pilot pack dry-run complete. **Anything failing here blocks launch.**

---

## 10. Full environment-variable reference

| Variable | Service(s) | Purpose | Example / placeholder |
|---|---|---|---|
| `DOMAIN` | Caddy / all | Base domain for the three app subdomains | `desisquare.com` |
| `ACME_EMAIL` | Caddy | Let's Encrypt account email | `<you@domain>` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Ghostfolio, Postgres | DB name/user/pass (pass auto-generated) | `ghostfolio` / `ghostfolio` / `<openssl rand>` |
| `REDIS_PASSWORD` | Ghostfolio, Redis | Redis auth (auto-generated) | `<openssl rand -hex 24>` |
| `ACCESS_TOKEN_SALT` / `JWT_SECRET_KEY` | Ghostfolio | Ghostfolio crypto secrets (auto-generated) | `<openssl rand -hex 32>` |
| `PORT` | v4 app / each service | Container listen port | app `8786`, gf-prov `8789`, wa `8788`, models `8791` |
| `PUBLIC_URL` | v4 app | Public origin of the app | `https://app.<domain>` |
| `DISCOURSE_URL` (`DISCOURSE_BASE_URL`) | v4 app, wa-bridge, gf-provisioner | Live Discourse origin | `https://community.<domain>` |
| `DISCOURSE_WEBHOOK_SECRET` | v4 app, wa-bridge, gf-provisioner + Discourse | Shared HMAC for webhooks (empty = disabled, forbidden) | `<SECRET>` |
| `DISCOURSE_API_KEY` / `DISCOURSE_API_USERNAME` | wa-bridge | `system` global key to create intake topics | `<KEY>` / `system` |
| `DISCOURSE_WA_CATEGORY_ID` | wa-bridge | Numeric id of "WhatsApp Intake" | `<int>` |
| `GHOSTFOLIO_URL` | v4 app, gf-provisioner | Ghostfolio origin | `http://ghostfolio:3333` |
| `GHOSTFOLIO_LIVE` | gf-provisioner | `true` = real provisioning (not mock) | `true` |
| `GF_PROVISIONER_URL` | v4 app | gf-provisioner origin (portfolio card + SSO) | `http://gf-provisioner:8789` |
| `WA_BRIDGE_URL` | v4 app | wa-bridge origin | `http://wa-bridge:8788` |
| `META_GRAPH_API_VERSION` | wa-bridge | Graph API version | `v21.0` |
| `WABA_ID` | wa-bridge | WhatsApp Business Account id | `<id>` |
| `META_APP_ID` / `META_APP_SECRET` | wa-bridge | App identity; secret verifies webhook HMAC | `<id>` / `<SECRET>` |
| `META_SYSTEM_USER_TOKEN` | wa-bridge | Bearer token (temp→permanent) | `<TOKEN>` |
| `PHONE_NUMBER_ID_COMMUNITY` | wa-bridge | Phone number id to send from | `<id>` |
| `WEBHOOK_VERIFY_TOKEN` | wa-bridge | GET-handshake verify token (auto-generated) | `<openssl rand -hex 16>` |
| `WEBHOOK_PATH` | wa-bridge | Inbound webhook path | `/webhooks/whatsapp` |
| `BRIDGE_API_KEY` | wa-bridge | Protects `POST /send` (auto-generated) | `<openssl rand -hex 24>` |
| `SERVICE_WINDOW_HOURS` | wa-bridge | Free-form window | `24` |
| `OPT_OUT_KEYWORDS` | wa-bridge | Opt-out triggers | `STOP,UNSUBSCRIBE,CANCEL` |
| `COMMUNITY_DISCLAIMER` | wa-bridge | Appended disclaimer | `Community discussion, not financial advice.` |
| `SSO_SECRET` | v4 app + Discourse (F5.7) | DiscourseConnect shared secret (rotate dev default) | `<SECRET>` |

---

## 11. Verification matrix (F0–F5 acceptance in one table)

| ID | What to run / check | Expected |
|---|---|---|
| F0.1 | `gcloud beta billing projects describe <PROJECT_ID>` | `billingEnabled: true` |
| F0.4 | Send test email via relay | Accepted; SPF/DKIM present in `dig txt` |
| F0.5 | Meta Security Center | Business Verification pending/approved; App ID+secret captured |
| F1.1 | `gcloud compute instances list` | discourse-1 + apps-1 RUNNING, static IPs |
| F1.2 | `gcloud compute firewall-rules list` | 80/443 to tag `web`; 22 only from `35.235.240.0/20` |
| F1.3 | `gsutil ls gs://<PROJECT_ID>-backups` + VM test upload | bucket exists, 30-day lifecycle, writable |
| F1.4 | `dig +short community/app/folio/wa.<domain>` | each = expected IP |
| F1.5 | `gcloud compute ssh <vm> --tunnel-through-iap -- true` | exit 0 |
| F2.2 | `curl -sI https://community.<domain>` | 200 + valid cert |
| F2.4 | Register admin | activation email in inbox (not spam) |
| F2.5 | Category list | WhatsApp Intake id recorded → `DISCOURSE_WA_CATEGORY_ID` |
| F2.6 | Admin → API | global key (`system`) + `post_created` webhook + secret present |
| F2.8 | Anonymous `GET /latest.json` | 403/redirect (constraint #7-A) |
| F3.1 | `docker compose ps` | all healthy/running |
| F3.2 | `stat -c %a /opt/desisquare/.env` | `600` |
| F3.3 | `curl -sf https://folio.<domain>/api/v1/health`; admin login | 200; admin panel reachable; token stored |
| F3.5 | `curl -sf https://app.<domain>/api/health` | 200; core pages render |
| F3.* | `node docs/gf-stats-contract/leak-sweep.test.mjs` | pass — no currency in maven stats (#4/#8) |
| F4.2 | Meta webhook config | verified; `messages` subscribed |
| F4.3 | Tampered payload / duplicate `wamid` | 401 / single Discourse post |
| F4.4 | Inbound test message | topic in WhatsApp Intake, sender `member-XXXX` (no E.164, #5) |
| F4.5 | Discourse reply | reaches phone (free-form in-window; template outside) |
| F4.6 | Send `STOP` | outbound suppressed until member writes again |
| F4.7 | Manage Templates | 3 templates ≥ pending |
| F4.8 | Prod send to non-test number | succeeds (or blocked-on-Meta) |
| F5.1 | `gsutil ls` after manual backup | objects for both VMs |
| F5.2 | Restore drill | documented restore output |
| F5.3 | Cloud Monitoring | 4 uptime checks green + email channel |
| F5.4 | Billing → Budgets | ~$150/mo budget armed |
| F5.5 | `gcloud secrets list` | Meta token, Discourse API key, webhook secret, bridge key |
| F5.6 | Firewall + `stat` + upgrades audit | no public SSH; `.env` 600; unattended-upgrades on |

---

## 12. Cutover & rollback

**Cutover (freeze → export → verify → switch → scale down).**
1. **Freeze writes** on the old host (maintenance mode / read-only) to prevent split-brain.
2. **Export** persistent data: Discourse `Admin → Backups → download`; Ghostfolio `pg_dump`; any
   app volume/DB.
3. **Import** into the GCP stack; **verify** every URL and the maven % + WhatsApp loops on GCP while the
   old host is still frozen (not yet DNS-live).
4. **Switch DNS** A records to the GCP IPs (keep TTL low, e.g. 300s, before cutover day).
5. **Scale the old host to zero** only after `app.<domain>`/`community.<domain>` are verified green.

**Rollback quick reference:**

| Component | Rollback |
|---|---|
| **Discourse** | Bad rebuild → revert `containers/app.yml`, `./launcher rebuild app` again; data persists in `/var/discourse/shared`. Restore a tar via Admin → Backups if needed. |
| **Apps stack** | `cd /opt/desisquare && docker compose down && git -C app_src checkout <prev> && docker compose up -d`; restore Postgres from the latest GCS dump if data is affected. |
| **Ghostfolio** | Pin the previous image tag in compose; restore the pre-upgrade Postgres snapshot (auto-migrations are forward-only). |
| **WhatsApp** | Disable the Meta webhook (stops inbound) or `docker compose stop wa-bridge` (stops outbound); Discourse/site unaffected. |
| **DNS** | Re-point A records back to the old host (low TTL makes this fast). |

---

## 13. Steady-state operations & cost

**Upgrade & maintenance cadences:**

| Task | Cadence | How |
|---|---|---|
| Discourse upgrade | monthly-ish | `cd /var/discourse && ./launcher rebuild app` (5–10 min downtime; announce first) |
| Ghostfolio / services upgrade | monthly | `docker compose pull && docker compose up -d` (seconds; snapshot Postgres before Ghostfolio) |
| OS patches | automatic | `unattended-upgrades`; reboot in a quiet window when required |
| Backup restore drill | quarterly | restore a Discourse tar + `psql <` a Ghostfolio dump into a scratch DB |
| Meta token/quality check | monthly | Business Manager → WhatsApp quality rating + template status; rotate the system-user token before expiry |
| Secret rotation | quarterly | rotate `DISCOURSE_WEBHOOK_SECRET`, `BRIDGE_API_KEY`, DB/Redis passwords; update `.env` + Secret Manager together |
| Leak-sweep / constraint check | each release | `node docs/gf-stats-contract/leak-sweep.test.mjs` (story 12.5) stays green |

**Cost summary — ~$100/mo all-in at pilot (<1,000 members):**

| Item | Est. /mo |
|---|---|
| discourse-1 (e2-medium, 2 vCPU / 4 GB) | ~$25 |
| apps-1 (e2-standard-2, 2 vCPU / 8 GB) | ~$50 |
| 2 × 40 GB pd-balanced boot disks | ~$8 |
| Static IPs (attached) + minor egress | ~$5–8 |
| GCS backups (small, 30-day lifecycle) | ~$1–2 |
| Ops Agent / Monitoring (free tier at this scale) | ~$0 |
| SMTP (Brevo free 300/day) | $0 |
| WhatsApp — free in-window service replies; pay per delivered template only | ~$0 at pilot |
| **Total** | **~$100/mo** |

*Optional add-ons:* LLM API for AI summaries/labels (~$20–50/mo, item 6); managed Cloud SQL/Memorystore
if you outgrow the single VM (Phase F6, out of scope here).

---

*End of guide. Non-negotiables recap: flags private (#3); dollars owner-only, public %-only (#4);
WhatsApp consent-gated, E.164 never shown (#5); anonymous → teaser only (#7-A); maven performance
percent-only, currency stripped server-side (#8); recognition ranks engagement not money (#9).
Positioning is educational only — never investment advice; the disclaimer ships on every content surface.*
