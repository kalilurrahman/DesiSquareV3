# DesiSquare — GCP production deployment package

Final-product deployment of DesiSquare (desisquare-production.up.railway.app → GCP) using Discourse (community), Ghostfolio (portfolio tracking), and WhatsApp (Meta Cloud API).

| File | Purpose |
|---|---|
| `DesiSquare_GCP_Deployment_Roadmap.docx` | The roadmap: architecture, phases, timeline, costs, risks, scale-up path |
| `RUNBOOK.md` | Day-by-day go-live steps (start here to execute) |
| `scripts/01-gcp-provision.sh` | Creates VMs, IPs, firewall, backup bucket (run locally/Cloud Shell) |
| `scripts/02-discourse-install.sh` | Discourse VM prep + official installer (run on discourse-1) |
| `scripts/03-apps-vm-setup.sh` | Apps VM: Docker + stack bring-up (run on apps-1) |
| `scripts/04-backups.sh` | Nightly offsite backups to GCS (cron on both VMs) |
| `apps-stack/docker-compose.yml` | Ghostfolio + Postgres + Redis + WhatsApp bridge + Caddy (+ app slot) |
| `apps-stack/Caddyfile` / `.env.sample` | TLS routing and configuration |
| `wa-bridge/` | WhatsApp ↔ Discourse bridge service (Node, ~200 lines) |
| `whatsapp/WHATSAPP-SETUP.md` | Meta onboarding: test loop → production checklist |
| `whatsapp/message-templates.json` | Templates to submit to Meta |

Execution order: **Roadmap (read) → RUNBOOK Day 0 → Day 1 → ... **

Not included (your private repo): the DesiSquareV2 app image — the compose file has a commented slot with instructions to build it from the repo via a deploy key.
