# DesiSquare Demo — Discourse Install Runbook (Ubuntu 24.04, single VPS)

> **BiGMo Consulting · DesiSquare demo pack · 19 Jul 2026.** Researched against official documentation (July 2026) and adversarially fact-checked; verifier corrections are folded in. Companion docs: `demo-install-00-overview.md` for topology and install order.

Scope: `community.example.com` on one Hetzner CPX31/41-class VPS (4 vCPU / 8 GB) that will also run Ghostfolio (`app.example.com`) and the wa-bridge/gf-provisioner/gf-stats scripts. Demo-grade, not HA. Verified against the official install docs (`discourse/discourse/docs/INSTALL-cloud.md`, `discourse/discourse_docker`) as of July 2026 — the install flow and Admin UI changed materially in 2025; this runbook uses the **current** procedure.

> **2025-2026 changes you must know (verified):**
> 1. Official install is now a **one-liner bootstrap** (`install-discourse`) that installs Docker + git, clones to `/var/discourse`, and runs `./discourse-setup`, which now delegates to a `discourse/setup-wizard:release` container.
> 2. **SMTP is now skippable** at setup (falls back to "Login via Discourse ID"). For DesiSquare **do not skip it** — invite emails, digests, and webhook-driven flows need real SMTP.
> 3. **discourse-reactions, discourse-openid-connect, and chat are bundled into Discourse core** (standalone plugin repos archived Jul 2025). No `git clone` hook needed for them — only for genuinely third-party plugins.
> 4. The **Admin UI was reorganized** into a sidebar: *Appearance* (Themes and components, Color palettes, Navigation, Fonts, Logo), *Email* (Server setup, Logs), *Community* (Login & authentication, Trust levels, Moderation flags, Category management), *Advanced* (Backups, API keys, Webhooks, Developer), *Plugins*.
> 5. `top_menu` default is now `latest|new|unread|hot|categories` — Hot is core; the old third-party "hot topics" plugin is obsolete.

---

## Stage 1 — Server prerequisites

1. **Sizing (this host runs Discourse + Ghostfolio + scripts):**
   - Discourse alone: official minimum 1 GB RAM (with swap) / 1 core / 10 GB disk; recommended 2 GB+ / 2+ cores / 20 GB+.
   - For the co-hosted demo: **4 vCPU / 8 GB RAM / 80+ GB NVMe** (Hetzner CPX31 = 4 vCPU/8 GB is the floor; CPX41 comfortable). Budget ~2.5 GB free RAM headroom for `./launcher rebuild app`.
2. **OS + base packages** (fresh Ubuntu 24.04 LTS, as root):
   ```bash
   apt update && apt -y upgrade
   apt -y install git curl wget ufw fail2ban unattended-upgrades
   dpkg-reconfigure -plow unattended-upgrades
   ```
3. **Swap (2 GB — required insurance for rebuilds on 8 GB with Ghostfolio co-resident):**
   ```bash
   fallocate -l 2G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
   ```
   (The setup wizard also offers to create swap on low-memory hosts; doing it now avoids the interruption.)
4. **DNS:** create **A records** at your DNS provider:
   - `community.example.com` → VPS IPv4 (and AAAA if you use IPv6)
   - `app.example.com` → same IP (for Ghostfolio later)
   Propagation is usually minutes but can take up to 48 h; the wizard verifies DNS before building.
5. **Firewall / ports:** Discourse needs 80 (HTTP + Let's Encrypt HTTP-01) and 443. Keep 22 for SSH.
   ```bash
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
   ufw enable
   ```
   Ensure nothing else binds 80/443 (`lsof -i :80`, `lsof -i :443`); `systemctl stop nginx && systemctl disable nginx` if a stray webserver exists. (See the reverse-proxy note in Stage 3.4 for the two-subdomain topology.)

**Checkpoint 1:** `free -h` shows 8 GB RAM + 2 GB swap; `dig +short community.example.com` returns the VPS IP; `ufw status` shows 22/80/443 ALLOW; `lsof -i :80` is empty.

---

## Stage 2 — Docker + discourse_docker

Two equivalent official paths. **Path A (current one-liner, recommended):**
```bash
wget -qO- https://raw.githubusercontent.com/discourse/discourse_docker/main/install-discourse | sudo bash
```
This script (verified from source): checks root, installs Docker via the official `https://get.docker.com | sh` convenience script and enables it with systemctl, installs git, runs `git clone --depth=1 https://github.com/discourse/discourse_docker /var/discourse`, then launches `./discourse-setup` — so it flows straight into Stage 3.

**Path B (manual, if you want to stop before the wizard):**
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
git clone https://github.com/discourse/discourse_docker.git /var/discourse
cd /var/discourse
chmod 700 containers
```

Repo layout you'll use later: `containers/` (your `app.yml` lives here), `samples/` (templates), `shared/standalone/` (all persistent data: uploads, Postgres, backups, logs), `launcher` (container manager: `start|stop|restart|destroy|enter|logs|bootstrap|rebuild|cleanup`).

**Checkpoint 2:** `docker --version` works; `docker run --rm hello-world` succeeds; `ls /var/discourse/launcher` exists.

---

## Stage 3 — `./discourse-setup` walkthrough

```bash
cd /var/discourse
./discourse-setup
```
The setup now runs inside a `discourse/setup-wizard:release` container (the shell script is a thin wrapper). It auto-detects public IP, validates ports 80/443 are free, verifies DNS resolves to this server, offers swap creation on low-RAM hosts (2 GB via `fallocate`), and **auto-tunes `UNICORN_WORKERS` and `db_shared_buffers` from detected CPU/RAM**. Prompts, in order (answer for DesiSquare):

| Prompt | DesiSquare answer |
|---|---|
| Admin email(s) (comma-delimited; become admin on first signup) | your ops email, e.g. `mohan72@outlook.com` |
| Own domain? (Yes = enter hostname; No = free `*.discourse.diy` subdomain + 6-digit Discourse ID code) | **Yes** → `community.example.com` |
| SMTP server address | `smtp-relay.brevo.com` (see Stage 4) — **do not skip**; skipping switches login to Discourse ID |
| SMTP port | `587` |
| SMTP user name | Brevo login email |
| SMTP password | Brevo SMTP key |
| Notification email (From: address) | `noreply@community.example.com` |
| Optional email for Let's Encrypt renewal warnings | ops email (LE certs themselves are provisioned automatically) |
| *(MaxMind GeoLite2 is **no longer a setup prompt** — add `DISCOURSE_MAXMIND_ACCOUNT_ID` / `DISCOURSE_MAXMIND_LICENSE_KEY` to `app.yml` env later if IP lookups are wanted, then rebuild)* | — |

After confirmation it writes **`/var/discourse/containers/app.yml`** (from `samples/standalone.yml`) and bootstraps the container (~5-10 min). Key generated content: `templates:` incl. `web.ssl.template.yml` + `web.letsencrypt.ssl.template.yml`, `expose: 80:80, 443:443`, and `env:` `DISCOURSE_HOSTNAME`, `DISCOURSE_DEVELOPER_EMAILS`, `DISCOURSE_SMTP_ADDRESS/PORT/USER_NAME/PASSWORD`, `DISCOURSE_NOTIFICATION_EMAIL`, `LETSENCRYPT_ACCOUNT_EMAIL`.

**Memory tuning for 4-8 GB (auto-set by bootstrap; override in `app.yml` only if needed):**
- 8 GB host sharing with Ghostfolio: `UNICORN_WORKERS: 4` (default rule ≈ 2/core would give 8 — too much here) and `db_shared_buffers: "1024MB"` (rule of thumb: ≤25% of RAM you're willing to give Postgres; the sample file documents both keys — `db_shared_buffers` under `params:`, `UNICORN_WORKERS` under `env:`).
- 4 GB host: `UNICORN_WORKERS: 3`, `db_shared_buffers: "768MB"`, swap mandatory.
- After any `app.yml` edit: `cd /var/discourse && ./launcher rebuild app`.

**Reverse-proxy note (constraint: one proxy fronting both subdomains):** simplest demo topology is to let the Discourse container own 80/443 for `community.example.com` and run Ghostfolio on `app.example.com` via a separate high port + Discourse's outer nginx is NOT shared. If you want a single host-level nginx/caddy for both subdomains instead: replace `web.ssl`/`web.letsencrypt` templates with `- "templates/web.socketed.template.yml"`, delete the `expose:` section, rebuild, and proxy `unix:/var/discourse/shared/standalone/nginx.http.sock` from host nginx, terminating TLS with certbot on the host. Pick one; don't mix.

**Checkpoint 3:** `docker ps` shows the `app` container Up; `https://community.example.com` loads with a valid Let's Encrypt certificate (padlock, issuer "Let's Encrypt"); `./launcher logs app` shows no repeating errors.

---

## Stage 4 — SMTP for the demo (Brevo example) + SPF/DKIM + testing

1. **Provider:** Brevo free tier (300 emails/day) is the officially documented demo-friendly option: server `smtp-relay.brevo.com`, port `587`, username = your Brevo account email, password = an SMTP key from Brevo dashboard. (Alternatives from the official email doc: Mailgun `smtp.mailgun.org`, SendGrid `smtp.sendgrid.net` with username literally `apikey`, Elastic Email `smtp.elasticemail.com:2525`. Resend also works: `smtp.resend.com`, username `resend`, password = API key, port 465 needs `DISCOURSE_SMTP_FORCE_TLS: true` in `app.yml`.)
2. **Domain authentication:** in Brevo, add and verify the **exact sending subdomain** — the official doc warns: *"you must verify and use the subdomain, e.g. discourse.example.com. If you verify the domain only, mail will not be configured correctly."* Add the DNS records Brevo gives you: **SPF** (`TXT` on the subdomain, e.g. `v=spf1 include:spf.brevo.com ~all` — the legacy `sendinblue.com` include is outdated; note Brevo mail rarely achieves SPF *alignment*, so **DKIM passing is the hard requirement**) and **DKIM** (`mail._domainkey` TXT/CNAME per dashboard). Set a DMARC record (`_dmarc TXT "v=DMARC1; p=none"`) for inbox placement. Enable the provider's bounce **webhooks** (or VERP) so bounces are handled.
3. **Test — CLI (authoritative):**
   ```bash
   cd /var/discourse
   ./launcher enter app
   rake emails:test["you@example.com"]
   exit
   ```
   It prints the SMTP host/port/auth in use and whether the server accepted the message.
4. **Test — Admin UI:** **Admin → Email → Server setup** (`/admin/email/server-settings`) → *Send test email*; check **Admin → Email → Email logs → Sent/Skipped/Bounced** for delivery records.

**Checkpoint 4:** `rake emails:test` reports the mail was accepted; the test mail arrives in a real inbox (check spam); mail-tester.com score ≥ 9 with SPF and DKIM both passing.

---

## Stage 5 — First admin + DesiSquare admin settings

1. **Create admin:** browse to `https://community.example.com`, click **Sign Up**, register with the admin email given in setup → the activation email grants admin automatically. Fallback if email is broken:
   ```bash
   cd /var/discourse && ./launcher enter app
   rake admin:create
   ```
2. Complete the in-browser setup wizard (name "DesiSquare", logos can wait for Stage 7).
3. **Signed-out gate (#7) + invite-only** — **Admin → All site settings** (`/admin/site_settings`), or **Admin → Community → Login & authentication**:
   - `login_required` = **true** (entire site gated for signed-out visitors — constraint #7)
   - `invite_only` = **true** (signup only via invites; model the `DSQ-2026` invite code as an invite link: your avatar → Invites → create a multi-use invite link, optionally scoped to groups)
   - `enable_discourse_connect` = **false** (default; leave OFF — DesiSquare SSO direction is Discourse → Ghostfolio via gf-provisioner, not an external IdP into Discourse)
   - `enable_local_logins` = true; `must_approve_users` = optional extra gate for demo realism
4. **Categories as corridors/spaces:** on `/categories` click **New Category** (or **Admin → Community → Category management**). Create one parent category per corridor (`US`, `CA`, `UK`, `AE`, `AU`, `SG`), then subcategories per space: *Stocks & ETFs, Taxes & FEMA, 401k & Retirement (US), Real Estate, Ask the community, Insurance & Visas, Watercooler*. Set each parent's Security tab to `everyone: See/Reply/Create` (the site-wide gate is `login_required`).
5. **Groups:** **Admin → Groups** → New Group:
   - `mavens` — visible, members visible, "Who can @mention" everyone; add title/flair (e.g. `CFA` flair for nikhil_cfa); use group membership to drive maven badging in the theme.
   - Moderators: grant per-user via **Admin → Users → (user) → Grant Moderation** (moderators get the review queue — flags stay private, constraint #3). Optionally a `moderators` group is built-in as `staff`.
6. **Flags (5 private reasons):** **Admin → Community → Moderation flags** (`/admin/config/flags`) — disable unneeded defaults and add **custom flags**: `Misleading`, `Low Effort`, `Spam` (built-in), `Violation` (rename "Inappropriate"), `Marketing`. All flags route to the private **Review** queue (`/review`), visible to staff only.
7. **Trust levels:** **Admin → Community → Trust levels**. For an invite-only demo set `default_trust_level` = `1` (skips new-user link/image limits), `default_invitee_trust_level` = `1`. Leave TL3 promotion defaults alone.
8. Compliance seasoning: **Admin → Community → Legal** for ToS/privacy; add the "not investment advice" disclaimer via the theme (Stage 7) and `tos_url`.

**Checkpoint 5:** open the site in a private/incognito window — you get only the login screen (no content leaks: constraint #7 holds); signup without an invite link is impossible; `/review` is 404 for a regular member account but loads for a moderator.

---

## Stage 6 — Plugins (reactions, OIDC, chat) + rebuild

**Bundled-in-core (2025+): no git clone needed** for exactly the three DesiSquare needs — verify under **Admin → Plugins → Installed plugins** (`/admin/plugins`):

1. **Reactions (4 public pills — Helpful / Insightful / Actionable / Like):** the plugin ships in core (`plugins/discourse-reactions`; the old repo `github.com/discourse/discourse-reactions` is archived "bundled into Discourse core"). Settings (exact names, from the plugin's `settings.yml`):
   - `discourse_reactions_enabled` = true
   - `discourse_reactions_reaction_for_like` = `heart` (the "Like" pill)
   - `discourse_reactions_enabled_reactions` = pipe-delimited emoji list — set to exactly 3 extra pills, e.g. `raised_hands|bulb|dart` (Helpful / Insightful / Actionable; default is `+1|laughing|open_mouth|clap|confetti_ball|hugs`)
   - `discourse_reactions_allow_any_emoji` = false (locks the set to your 4)
   - `discourse_reactions_like_sync_enabled` = true (reactions count as likes → feeds the Hot algorithm in Stage 8)
2. **OpenID Connect:** also bundled in core (`plugins/discourse-openid-connect`; standalone repo archived Jul 2025). DesiSquare demo keeps it **disabled** (`openid_connect_enabled` = false) — listed here because it's the future path if you later centralize auth; no install action needed.
3. **Chat:** bundled in core, `chat_enabled` defaults to **true**. Keep it on for the Watercooler vibe or set `chat_enabled` = false to reduce surface.

**Third-party plugins (the only case where app.yml hooks are needed).** Pattern, in `/var/discourse/containers/app.yml` (the `docker_manager` line already exists from setup):
```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - git clone https://github.com/discourse/docker_manager.git
          # add third-party plugins below, one git clone per line, e.g.:
          # - git clone https://github.com/discourse/discourse-follow.git
```
Then rebuild (any app.yml change requires it; ~5-10 min of downtime):
```bash
cd /var/discourse
./launcher rebuild app
```

**Checkpoint 6:** on any post, the like-heart now long-presses/hovers into a picker showing exactly your 4 reactions; **Admin → Plugins** lists Reactions as enabled; a reaction on a test post increments the post's like count (sync working).

---

## Stage 7 — Theme (Porcelain Slate) + palette lockdown

1. **Install theme from git:** **Admin → Appearance → Themes and components** (`/admin/config/customize/themes`) → **Install** → **From a git repository** → paste the DesiSquare theme repo URL (private repos: add the deploy key it offers). Set it as **Default theme**. Components install the same way and are attached to the theme.
2. **Color palette (single light "Porcelain Slate" scheme):** **Admin → Appearance → Color palettes** (`/admin/config/colors`) → New palette (or edit the theme's own palette) → set the Porcelain Slate hex values → assign it as the theme's palette. To keep one light lane:
   - Uncheck **User selectable** on every other palette (and every other theme in Themes and components) so members cannot switch schemes/themes.
   - Remove/ignore the dark variant: dark-mode behavior is now controlled **per color palette/theme** (the old `default_dark_mode_color_scheme_id` site setting was removed in July 2025). In **Admin → Appearance → Color palettes**, ensure the Porcelain Slate palette has **no dark variant assigned** (or edit its dark-mode colors to match light), and leave `interface_color_selector` at its default `disabled` so no light/dark toggle is shown and OS dark mode cannot flip the scheme.
   - `interface_color_selector` (Admin → Appearance → Interface) — disable the light/dark selector.
3. **Custom homepage note:** the DesiSquare landing/home treatment is a theme concern — current mechanism is the theme's `custom-homepage` capability (a `<div class="custom-homepage-...">`/connector rendered when "custom homepage" is enabled in the theme's about.json) or, simpler for the demo, skip it and rely on Stage 8's Hot-first `top_menu`. Since `login_required` is on, signed-out users only ever see the login gate regardless.

**Checkpoint 7:** hard-refresh as a member — Porcelain Slate renders; user Preferences → Interface shows **no** theme or color-scheme choices; toggling OS dark mode does not flip the forum to dark.

---

## Stage 8 — Popular by default (Hot)

Hot is core now (since 3.4 it's even in the default `top_menu`). Exact settings:

1. **Make Hot the homepage:** **Admin → All site settings** → `top_menu` (also surfaced under **Admin → Appearance → Navigation**). The **first item is the default homepage**. Reorder to:
   ```
   hot|latest|new|unread|categories
   ```
   (Current default is `latest|new|unread|hot|categories` — just drag `hot` to front.)
2. **Tunables (hidden settings — not in the admin UI; set via console):** `hot_topics_gravity` (default `1.2`; higher = faster decay, fresher feed) and `hot_topics_recent_days` (default `7`; likes window feeding the score):
   ```bash
   cd /var/discourse && ./launcher enter app
   rails c
   SiteSetting.hot_topics_gravity = 1.5      # demo: livelier turnover
   SiteSetting.hot_topics_recent_days = 7
   exit; exit
   ```
   Hot scores recompute on a background job (~every 10 min); with `discourse_reactions_like_sync_enabled` on, all 4 pills feed the ranking.

**Checkpoint 8:** logged in, navigating to `https://community.example.com/` lands on `/hot`; the top-menu tab order starts with Hot; a freshly-liked topic climbs the list within ~10-15 minutes.

---

## Stage 9 — Webhooks + API key (gf-provisioner, notifications)

1. **API key (for gf-provisioner's Discourse API calls and wa-bridge posting):** **Admin → Advanced → API keys** (`/admin/api/keys`) → **New API key** → Description `gf-provisioner`, User Level **Single user** (a dedicated `system-integration` admin user is cleaner than All users), **Scope: Granular** — grant only what the script needs (e.g. `users: show`, `topics: write` for wa-bridge). Copy the key once — it is shown a single time. Calls use headers `Api-Key: <key>` and `Api-Username: <user>`.
2. **Webhook — signup → gf-provisioner:** **Admin → Advanced → Webhooks** (`/admin/api/web_hooks`) → **New webhook**:
   - Payload URL: `https://app.example.com/hooks/discourse/user` (gf-provisioner endpoint)
   - Content type: `application/json`
   - Secret: long random string — gf-provisioner MUST verify the `X-Discourse-Event-Signature` header (`sha256=` HMAC of raw body) and stay **idempotent** on `user_created` retries (exactly-one Ghostfolio account per user).
   - Events: check **User event** (fires `user_created`, `user_confirmed_email`, `user_approved`, `user_updated` — dispatch on the `X-Discourse-Event` header).
   - Check *Active*; TLS verification ON.
3. **Webhook — post events → notification fan-out (WhatsApp opt-in mirror):** second webhook, Payload URL `https://app.example.com/hooks/discourse/post`, events **Post event** (+ **Topic event** if you notify on new threads). Remember constraint #5: the consumer must check consent flags before any WhatsApp send, and never log E.164 numbers.
4. Each webhook row has **Ping** and an **Events/Delivery log** (status, request/response bodies) for debugging.

**Checkpoint 9:** press **Ping** → delivery log shows HTTP 200 from your endpoint; create a throwaway user via invite → gf-provisioner receives `user_created` with valid signature and exactly one Ghostfolio account appears (re-deliver the event to prove idempotency); `curl -s -H "Api-Key: …" -H "Api-Username: system" https://community.example.com/admin/users/list/active.json` returns JSON.

---

## Stage 10 — Backups, upgrades, troubleshooting

1. **Automatic backups:** on by default. Settings (Admin → All site settings, filter `backup`): `enable_backups` = true, `backup_frequency` = `7` days (set `1` for the demo build week), `maximum_backups` = `5`, `backup_location` = `local` (S3 is the other enum choice), `include_thumbnails_on_backup` as preferred. Manage at **Admin → Advanced → Backups** (`/admin/backups`): **Backup** button for on-demand, per-row **Download** (emails a one-time secure link) and **Restore** (requires `allow_restore` = true, enable only while restoring).
2. **Off-box copy (demo-grade DR):** backups live on the host at `/var/discourse/shared/standalone/backups/default/*.tar.gz` — pull them with:
   ```bash
   scp root@community.example.com:/var/discourse/shared/standalone/backups/default/*.tar.gz ./
   ```
3. **Upgrades:** routine updates via web UI `https://community.example.com/admin/upgrade` (docker_manager). Full upgrade (new base image, app.yml changes, or when the web upgrader says so):
   ```bash
   cd /var/discourse
   git pull
   ./launcher rebuild app        # ~5-10 min downtime; take a backup first
   ```

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `rebuild` killed / exit 137 / `Cannot allocate memory` | OOM during bootstrap (asset compile); Ghostfolio eating RAM | Ensure 2 GB swap active (`swapon --show`); temporarily `docker stop ghostfolio`; lower `UNICORN_WORKERS`/`db_shared_buffers` in `app.yml`; retry `./launcher rebuild app` |
| Mail not arriving | SMTP creds/port wrong; sender domain unverified; SPF/DKIM missing | `./launcher enter app && rake emails:test["you@example.com"]`; check **Admin → Email → Email logs → Skipped/Bounced/Rejected**; verify the exact subdomain at the provider; re-run `./discourse-setup` to re-enter SMTP (brief rebuild) |
| Let's Encrypt fails / self-signed cert served | DNS not pointing here yet; port 80 blocked/occupied; LE rate limit (5 dup certs/week) | `dig +short community.example.com` must equal server IP; free port 80 (`lsof -i :80`); check `/var/discourse/shared/standalone/letsencrypt/` + `./launcher logs app`; wait out rate limits, then `./launcher rebuild app` |
| Rebuild takes forever (>30 min) | 1-2 vCPU host compiling assets; slow disk; low RAM w/ heavy swapping | Normal is 5-10 min on 4 vCPU; use the web upgrader (`/admin/upgrade`) for routine updates instead of full rebuilds; upsize the VPS for the build then downsize |
| Site up but `login_required` leaks nothing to test webhooks | gate working as designed | Use API key + `Api-Username` for scripted checks; webhooks fire server-side regardless of the gate |
| Ports 80/443 already in use at setup | stray nginx/apache | `systemctl stop nginx && systemctl disable nginx` (or apache2), rerun `./discourse-setup` |
| Wizard DNS verification fails but DNS is correct | propagation lag / IPv6 mismatch | wait, or rerun `./discourse-setup --skip-connection-test` |

---

## Sources (official)

- https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md — current official cloud install (one-liner, wizard prompts, requirements, launcher commands, troubleshooting)
- https://github.com/discourse/discourse_docker — launcher, directory layout; `samples/standalone.yml` (app.yml keys: `db_shared_buffers`, `UNICORN_WORKERS`, SMTP env, hooks/after_code plugin clones); `install-discourse` and `discourse-setup` scripts
- https://github.com/discourse/discourse/blob/main/docs/INSTALL-email.md — recommended SMTP providers (Brevo/Mailgun/SendGrid/Elastic), subdomain-verification warning, bounce webhooks
- https://github.com/discourse/discourse/tree/main/plugins — bundled core plugins incl. `discourse-reactions`, `discourse-openid-connect`, `chat`
- https://github.com/discourse/discourse-reactions and https://github.com/discourse/discourse-openid-connect — archived (Jul 2025) with "bundled into Discourse core" notices
- `discourse/discourse` `config/site_settings.yml` — exact settings: `top_menu` default `latest|new|unread|hot|categories`, `hot_topics_gravity` 1.2 (hidden), `hot_topics_recent_days` 7 (hidden), `invite_only`, `login_required`, `enable_discourse_connect`, `enable_backups`, `backup_frequency` 7, `maximum_backups` 5, `backup_location` local
- `discourse/discourse` `frontend/discourse/app/lib/sidebar/admin-nav-map.js` — current Admin sidebar structure (Appearance / Email / Security / Plugins / Advanced sections; Webhooks + API keys + Backups under Advanced)
- https://meta.discourse.org/t/discourse-official-standard-installation/142537 — official supported-install policy
- https://meta.discourse.org/t/3-4-0-beta1-hot-now-in-default-top-menu-items-new-feature-indicator-polls-can-show-absolute-numbers-and-more/322329 — Hot in default top menu
- https://meta.discourse.org/t/configure-webhooks-that-trigger-on-discourse-events-to-integrate-with-external-services/49045 — webhook configuration
