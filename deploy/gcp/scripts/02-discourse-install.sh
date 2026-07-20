#!/usr/bin/env bash
# =============================================================================
# DesiSquare — Discourse install (run ON the discourse-1 VM as root)
#   gcloud compute ssh discourse-1 --zone=us-central1-a --tunnel-through-iap
#   sudo -i, then run this script.
# Official Docker-based install (the only supported method).
# BEFORE RUNNING have ready:
#   - DNS: community.<domain> A record pointing at this VM (propagated!)
#   - SMTP credentials (Brevo/Mailgun/SES). GCP blocks port 25 — use 587.
# =============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo -i)"; exit 1; }

echo "==> 2 GB swap (required on a 4 GB machine for image rebuilds)"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Clone official discourse_docker"
if [ ! -d /var/discourse ]; then
  git clone https://github.com/discourse/discourse_docker.git /var/discourse
fi
cd /var/discourse
chmod 700 containers

cat <<'EOF'

============================================================
 Next step is INTERACTIVE. Run:

     ./discourse-setup

 Answers to give:
   Hostname:            community.<your-domain>
   Admin email:         your email (becomes first admin)
   SMTP server/port:    e.g. smtp-relay.brevo.com : 587
   SMTP user/password:  from your Brevo/Mailgun account
   Let's Encrypt email: your email  (auto-HTTPS)

 The first build takes ~5-10 minutes. When it finishes, open
 https://community.<your-domain> and register with the admin
 email to activate your account (activation mail must arrive —
 if it doesn't, SMTP is misconfigured; fix and ./launcher rebuild app).

 Useful later:
   cd /var/discourse && ./launcher rebuild app    # apply config/upgrades (~5-10 min downtime)
   ./launcher enter app                           # shell inside the container
============================================================
EOF
