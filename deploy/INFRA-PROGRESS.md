# Infra checklist progress — items 1–7 (sequential)

> Companion to `deploy/CLIENT-INFRA-CHECKLIST.md`. The daily nudge reads this file — keep `Status` and `Notes` current. Statuses: `todo` · `in-progress` · `blocked` · `done`.

| # | Item | Status | Started | Done | Notes |
|---|---|---|---|---|---|
| 1 | Cloud account & billing (GCP project, region, budget alert) | todo | — | — | |
| 2 | Domain & DNS (domain + 4 A records + registrar access) | todo | — | — | |
| 3 | Transactional email (Brevo SMTP key, SPF/DKIM/DMARC) | todo | — | — | |
| 4 | WhatsApp / Meta (dev account, app, **business verification — longest lead time**) | todo | — | — | Start alongside item 1 — verification takes 1–3 weeks |
| 5 | Access & secrets (DesiSquareV2 deploy key, Railway access, Secret Manager, admin contacts) | todo | — | — | |
| 6 | Optional: LLM API key + S3/GCS bucket | todo | — | — | |
| 7 | Product sign-offs (karma weights, benchmarks, chat corridors, noindex posture) | todo | — | — | |

**Demo tier (no client input needed) — already done:** cutdown demo built and verified locally (`demo/`); Railway config-as-code in place (`railway.json`) — deploys with `railway login && railway init && railway up`.

**Log** *(newest first — the nudge session appends here)*
- 2026-07-20 · Tracker created; demo-in-a-box built and locally verified; daily nudge scheduled.
