# Infra checklist progress — items 1–7 (sequential)

> Companion to `deploy/CLIENT-INFRA-CHECKLIST.md`. The daily nudge reads this file — keep `Status` and `Notes` current. Statuses: `todo` · `in-progress` · `blocked` · `done`.

| # | Item | Status | Started | Done | Notes |
|---|---|---|---|---|---|
| 1 | Cloud account & billing (GCP project, region, budget alert) | in-progress | 2026-07-22 | — | Owner has a live **Railway** account + production service (`desisquarev5-product-production.up.railway.app`). Open decision: Railway as the production cloud (item 1 ≈ confirm plan/billing there) vs GCP per checklist. |
| 2 | Domain & DNS (domain + 4 A records + registrar access) | todo | — | — | |
| 3 | Transactional email (Brevo SMTP key, SPF/DKIM/DMARC) | todo | — | — | |
| 4 | WhatsApp / Meta (dev account, app, **business verification — longest lead time**) | todo | — | — | Start alongside item 1 — verification takes 1–3 weeks |
| 5 | Access & secrets (DesiSquareV2 deploy key, Railway access, Secret Manager, admin contacts) | todo | — | — | Railway access exists (owner deploys `kalilurrahman/desisquarev5-product` there); rest pending |
| 6 | Optional: LLM API key + S3/GCS bucket | todo | — | — | |
| 7 | Product sign-offs (karma weights, benchmarks, chat corridors, noindex posture) | todo | — | — | |

**Demo tier (no client input needed) — already done:** cutdown demo built and verified locally (`demo/`); Railway config-as-code in place (`railway.json`) — deploys with `railway login && railway init && railway up`.

**Log** *(newest first — the nudge session appends here)*
- 2026-07-22 · Owner-confirmed: production Railway service live at `desisquarev5-product-production.up.railway.app` (repo `kalilurrahman/desisquarev5-product`). Deploy config repointed so every build path ships the full v4 app; default branch fast-forwarded to `main` (was 16 commits behind — Railway tracks the default). Item 1 → in-progress pending the Railway-vs-GCP decision; item 4 (Meta verification) still not started — flagged again for its 1–3 week lead time.
- 2026-07-20 · Tracker created; demo-in-a-box built and locally verified; daily nudge scheduled.
