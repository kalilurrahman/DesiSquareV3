# DesiSquare — Go-Live Runbook (GCP)

Fastest path from nothing to a running production stack. Web live in ~2 days; WhatsApp production in 1-3 weeks (Meta verification is the critical path — start it Day 0).

Target topology:

```
community.<domain>  -> VM discourse-1 (e2-medium)   Discourse, official Docker install
app.<domain>        -> VM apps-1 (e2-standard-2)    DesiSquareV2 app (migrated off Railway)
folio.<domain>      -> VM apps-1                    Ghostfolio (+ Postgres 15 + Redis 7)
wa.<domain>         -> VM apps-1                    WhatsApp <-> Discourse bridge
                       Caddy on apps-1 terminates TLS for the three apps subdomains
                       GCS bucket: nightly offsite backups
```

## Day 0 — Accounts & prerequisites (~2-3 h, mostly waiting-free)

- [ ] Buy the domain (Cloud Domains, Namecheap, etc.).
- [ ] GCP: create project `desisquare-prod`, enable billing, install `gcloud` locally (or use Cloud Shell).
- [ ] **Meta (start now — longest lead time):** create Business portfolio at `business.facebook.com`, then Security Center → **Start Business Verification**. Also create the developer app (whatsapp/WHATSAPP-SETUP.md Part 1).
- [ ] SMTP for Discourse (required — Discourse will not run without email): create a Brevo account (free 300 emails/day) or Mailgun/SES. Get host/port/user/password; **port 587** (GCP blocks 25). Add the SPF/DKIM DNS records they give you.
- [ ] GitHub: add a read-only deploy key for `DesiSquareV2` (repo → Settings → Deploy keys) so apps-1 can pull it.

## Day 1 — Infrastructure + Discourse live

1. Edit the config block in `scripts/01-gcp-provision.sh` (project, region, domain) and run it. Note the two IPs it prints.
2. Create the 4 DNS A records at your registrar (community/app/folio/wa). Wait for propagation (`dig community.<domain>`).
3. SSH to discourse-1 and install:
   ```bash
   gcloud compute ssh discourse-1 --zone=us-central1-a --tunnel-through-iap
   sudo -i
   # copy scripts/02-discourse-install.sh here, then:
   bash 02-discourse-install.sh
   cd /var/discourse && ./discourse-setup     # interactive: hostname, admin email, SMTP, LE email
   ```
4. Open `https://community.<domain>`, register the admin account, confirm the activation email arrives (if not: fix SMTP, `./launcher rebuild app`).
5. First-run admin: run the setup wizard, create categories (incl. **WhatsApp Intake** — note its id), enable nightly backups (Admin → Backups → 7 days), set `force_https`.

## Day 2 — Ghostfolio + app + TLS

1. From your workstation: `gcloud compute scp --recurse apps-stack wa-bridge apps-1:~ --zone=us-central1-a --tunnel-through-iap`
2. SSH to apps-1, run `bash 03-apps-vm-setup.sh` (first run generates secrets), edit `/opt/desisquare/.env` (DOMAIN, ACME_EMAIL, Discourse API values), run it again to start the stack.
3. Verify `https://folio.<domain>` — create the first Ghostfolio user (becomes admin), then in admin panel set a data provider if desired. Keep **sign-ups open** or closed per your pilot policy.
4. Migrate the app off Railway:
   ```bash
   git clone git@github.com:kalilurrahman/DesiSquareV2.git /opt/desisquare/app
   # uncomment desisquare-app in docker-compose.yml + app.<domain> block in Caddyfile
   # port: whatever the app listens on (Railway used $PORT — set PORT=8080 in .env)
   sudo docker compose up -d --build
   ```
   Export any persistent data from Railway (DB dump / volume) before pointing DNS away; freeze writes during cutover. Keep Railway alive until `app.<domain>` is verified, then scale it to zero.
5. Confirm all three subdomains serve valid TLS (Caddy handles certificates automatically).

## Day 3 — WhatsApp test loop

Follow `whatsapp/WHATSAPP-SETUP.md` Parts 1-4: test number → outbound curl → webhook verify → message your number → topic appears in Discourse → Discourse reply arrives on your phone. Submit the templates in `whatsapp/message-templates.json` the same day (approval takes time).

## Day 4-5 — Hardening + pilot invite

- [ ] Backups: install `scripts/04-backups.sh` + cron on both VMs; run once manually; confirm objects in `gs://<project>-backups`. **Test a restore** (download a Discourse backup, restore via Admin → Backups on a scratch container if possible).
- [ ] Monitoring: install Google Ops Agent on both VMs (`curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh && sudo bash add-google-cloud-ops-agent-repo.sh --also-install`); create uptime checks for the 4 URLs + email alerting; set a billing budget alert (e.g. $150/mo).
- [ ] Security: verify SSH is IAP-only (no public 22), unattended-upgrades enabled (Ubuntu default), `.env` files mode 600, Meta/Discourse secrets also copied into Secret Manager as the source of truth.
- [ ] Discourse polish: logo/theme, pseudonym-friendly username policy, financial-advice disclaimer in welcome topic + footer, DiscourseConnect planning (Phase 5).
- [ ] Invite the pilot cohort (<1k members target).

## Week 2-3 — WhatsApp production (gated on Meta)

`whatsapp/WHATSAPP-SETUP.md` Part 5: verification approved → real number + display name → permanent system-user token → approved templates → Advanced Access → production webhook → publish `wa.me` link on the site.

## Steady-state operations

| Task | Cadence | How |
|---|---|---|
| Discourse upgrade | monthly-ish | `cd /var/discourse && ./launcher rebuild app` (5-10 min downtime; announce) |
| Ghostfolio/bridge upgrade | monthly | `docker compose pull && docker compose up -d` (seconds) |
| OS patches | automatic | unattended-upgrades; reboot in a quiet window when required |
| Backup restore drill | quarterly | restore Discourse tar + `psql <` Ghostfolio dump into scratch |
| Meta token/quality check | monthly | Business Manager → WhatsApp quality rating, template status |

## Rollback quick reference

- Discourse bad rebuild: `./launcher rebuild app` again with reverted `containers/app.yml`; data persists in `/var/discourse/shared`.
- Apps stack: `docker compose down && git checkout <prev> && docker compose up -d`; DB restore from GCS dump if needed.
- WhatsApp: set Meta webhook to disabled (stops inbound), or stop `wa-bridge` container (outbound halts); Discourse/site unaffected.
