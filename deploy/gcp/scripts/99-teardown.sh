#!/usr/bin/env bash
# =============================================================================
# DesiSquare — teardown (stops all billing except the backup bucket).
# DESTRUCTIVE: deletes both VMs and static IPs. Backups in GCS survive.
# =============================================================================
set -euo pipefail
export PROJECT_ID="${PROJECT_ID:-desisquare-prod}"
export REGION="${REGION:-us-central1}"
export ZONE="${ZONE:-us-central1-a}"

gcloud config set project "$PROJECT_ID"
read -r -p "Delete discourse-1 + apps-1 + static IPs in ${PROJECT_ID}? [type YES] " ok
[ "$ok" = "YES" ] || { echo "aborted"; exit 1; }

gcloud compute instances delete discourse-1 apps-1 --zone="$ZONE" --quiet || true
gcloud compute addresses delete discourse-ip apps-ip --region="$REGION" --quiet || true
echo "Done. Backup bucket kept: gs://${PROJECT_ID}-backups (delete manually if desired)."
