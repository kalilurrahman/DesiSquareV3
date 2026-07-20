#!/usr/bin/env bash
# =============================================================================
# DesiSquare — nightly offsite backups to GCS. Install ON EACH VM:
#   sudo cp 04-backups.sh /usr/local/bin/desisquare-backup && sudo chmod +x /usr/local/bin/desisquare-backup
#   echo '30 2 * * * root BUCKET=gs://desisquare-prod-backups /usr/local/bin/desisquare-backup' | sudo tee /etc/cron.d/desisquare-backup
# Discourse also has built-in nightly backups (enable in Admin -> Backups);
# this ships them offsite. On apps-1 it dumps Postgres + copies .env (secrets!).
# =============================================================================
set -euo pipefail
BUCKET="${BUCKET:?set BUCKET=gs://<project>-backups}"
HOST=$(hostname)
STAMP=$(date +%F)

if [ -d /var/discourse/shared/standalone/backups ]; then
  # Discourse VM: sync the tar.gz backups Discourse already produces
  gsutil -m rsync -r /var/discourse/shared/standalone/backups \
    "${BUCKET}/discourse/"
fi

if [ -d /opt/desisquare ]; then
  # Apps VM: Ghostfolio Postgres dump + env snapshot
  cd /opt/desisquare
  docker compose exec -T postgres pg_dump -U "$(grep ^POSTGRES_USER .env | cut -d= -f2)" \
    "$(grep ^POSTGRES_DB .env | cut -d= -f2)" | gzip \
    | gsutil cp - "${BUCKET}/ghostfolio/ghostfolio-${STAMP}.sql.gz"
  gsutil cp .env "${BUCKET}/config/${HOST}-env-${STAMP}"
fi

echo "backup ok ${HOST} ${STAMP}"
