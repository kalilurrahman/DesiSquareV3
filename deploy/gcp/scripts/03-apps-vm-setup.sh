#!/usr/bin/env bash
# =============================================================================
# DesiSquare — apps VM setup (run ON the apps-1 VM)
# Installs Docker, lays out /opt/desisquare, starts the compose stack:
#   Caddy (TLS) + Ghostfolio + Postgres + Redis + WhatsApp bridge (+ your app)
# BEFORE RUNNING:
#   - DNS: app./folio./wa.<domain> A records point at this VM
#   - Copy the apps-stack/ and wa-bridge/ folders to this VM, e.g.:
#       gcloud compute scp --recurse apps-stack wa-bridge apps-1:~ \
#         --zone=us-central1-a --tunnel-through-iap
# =============================================================================
set -euo pipefail

echo "==> Docker + compose plugin"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Layout /opt/desisquare"
sudo mkdir -p /opt/desisquare
sudo cp -r ~/apps-stack/* /opt/desisquare/
sudo cp -r ~/wa-bridge /opt/desisquare/wa-bridge
cd /opt/desisquare

if [ ! -f .env ]; then
  sudo cp .env.sample .env
  echo "==> Generating secrets into .env"
  sudo sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
  sudo sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(openssl rand -hex 24)|"       .env
  sudo sed -i "s|^ACCESS_TOKEN_SALT=.*|ACCESS_TOKEN_SALT=$(openssl rand -hex 32)|" .env
  sudo sed -i "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$(openssl rand -hex 32)|"       .env
  sudo sed -i "s|^BRIDGE_API_KEY=.*|BRIDGE_API_KEY=$(openssl rand -hex 24)|"       .env
  sudo sed -i "s|^WEBHOOK_VERIFY_TOKEN=.*|WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 16)|" .env
  echo "    !! Now edit /opt/desisquare/.env — set DOMAIN, ACME_EMAIL, Meta + Discourse values."
  echo "    Then re-run this script to start the stack."
  exit 0
fi

echo "==> Starting stack"
sudo docker compose pull
sudo docker compose up -d --build

echo
echo "============================================================"
echo " Stack is starting. Check:"
echo "   sudo docker compose ps"
echo "   https://folio.<domain>   -> Ghostfolio (create first user, becomes admin)"
echo "   https://wa.<domain>/health -> bridge health"
echo "   https://app.<domain>     -> your DesiSquare app (once image is set)"
echo "============================================================"
