#!/usr/bin/env bash
# =============================================================================
# DesiSquare — GCP foundation provisioning (run from your workstation / Cloud Shell)
# Creates: project APIs, static IPs, firewall rules, 2 VMs, backup bucket.
# Prereq: gcloud CLI authenticated (gcloud auth login) + billing-enabled project.
# =============================================================================
set -euo pipefail

# ---- EDIT THESE -------------------------------------------------------------
export PROJECT_ID="desisquare-prod"          # your GCP project id
export REGION="us-central1"                  # asia-south1 (Mumbai) if India-first audience
export ZONE="us-central1-a"
export DOMAIN="desisquare.com"               # your production domain
# -----------------------------------------------------------------------------

gcloud config set project "$PROJECT_ID"

echo "==> Enabling APIs"
gcloud services enable compute.googleapis.com dns.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com \
  monitoring.googleapis.com logging.googleapis.com

echo "==> Reserving static external IPs"
gcloud compute addresses create discourse-ip --region="$REGION" || true
gcloud compute addresses create apps-ip      --region="$REGION" || true
DISCOURSE_IP=$(gcloud compute addresses describe discourse-ip --region="$REGION" --format='value(address)')
APPS_IP=$(gcloud compute addresses describe apps-ip --region="$REGION" --format='value(address)')

echo "==> Firewall: HTTP/HTTPS to tagged VMs, SSH only via IAP"
gcloud compute firewall-rules create allow-web \
  --allow=tcp:80,tcp:443 --target-tags=web --direction=INGRESS || true
gcloud compute firewall-rules create allow-iap-ssh \
  --allow=tcp:22 --source-ranges=35.235.240.0/20 --direction=INGRESS || true

echo "==> VM 1: Discourse (e2-medium, 2 vCPU / 4 GB — resize later if needed)"
gcloud compute instances create discourse-1 \
  --zone="$ZONE" --machine-type=e2-medium \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=40GB --boot-disk-type=pd-balanced \
  --address="$DISCOURSE_IP" --tags=web \
  --metadata=enable-oslogin=TRUE || true

echo "==> VM 2: Apps (Ghostfolio + DesiSquare app + WhatsApp bridge, e2-standard-2)"
gcloud compute instances create apps-1 \
  --zone="$ZONE" --machine-type=e2-standard-2 \
  --image-family=ubuntu-2404-lts-amd64 --image-project=ubuntu-os-cloud \
  --boot-disk-size=40GB --boot-disk-type=pd-balanced \
  --address="$APPS_IP" --tags=web \
  --metadata=enable-oslogin=TRUE || true

echo "==> Backup bucket (30-day lifecycle)"
gsutil mb -l "$REGION" "gs://${PROJECT_ID}-backups" || true
cat > /tmp/lifecycle.json <<'EOF'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}
EOF
gsutil lifecycle set /tmp/lifecycle.json "gs://${PROJECT_ID}-backups"

echo "==> Grant VMs write access to the bucket (default compute SA)"
SA=$(gcloud iam service-accounts list --filter="displayName:'Compute Engine default service account'" --format='value(email)')
gsutil iam ch "serviceAccount:${SA}:roles/storage.objectAdmin" "gs://${PROJECT_ID}-backups"

echo
echo "============================================================"
echo " DONE. Create these DNS records at your registrar:"
echo "   community.${DOMAIN}  A  ${DISCOURSE_IP}"
echo "   app.${DOMAIN}        A  ${APPS_IP}"
echo "   folio.${DOMAIN}      A  ${APPS_IP}"
echo "   wa.${DOMAIN}         A  ${APPS_IP}"
echo
echo " SSH:  gcloud compute ssh discourse-1 --zone=${ZONE} --tunnel-through-iap"
echo "       gcloud compute ssh apps-1      --zone=${ZONE} --tunnel-through-iap"
echo "============================================================"
