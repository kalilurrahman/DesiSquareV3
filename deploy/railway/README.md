# DesiSquare on Railway — honest deployment pack

> **Researched & verified July 2026** (Railway template marketplace, Bitnami/Broadcom catalog status, Discourse meta + source, Ghostfolio docs/source, Railway docs). Read this page before deploying — Discourse-on-Railway is possible, but it comes with supportability trade-offs the official-VM path does not have.

## The verdict in four lines

1. **Ghostfolio on Railway: yes, cleanly.** Official image + Railway Postgres/Redis; a one-click community template exists (`railway.com/deploy/ghostfolio`). Fine for demo **and** production.
2. **Discourse on Railway: possible for a demo, a dead end for production.** The community template (`railway.com/deploy/discourse`) runs `bitnamilegacy/discourse:3.5.0` — a tag **frozen forever** by Broadcom's Aug-2025 Bitnami catalog change (current Discourse is the 2026.x ESR line, so the template is ~10 months behind on security fixes with no update path). Discourse's only supported install is the `discourse_docker` launcher, which **cannot run on Railway** (no privileged containers — confirmed by Railway staff), and the Discourse team explicitly declines support for non-launcher installs.
3. **Real user signups need SMTP, and Railway blocks outbound SMTP below the Pro plan ($20/mo).** On Hobby, accounts can only be created via the admin API / console (the 50-user simulation does exactly this) — self-serve signup emails will not send.
4. **Recommended shapes:** **Demo-on-Railway** (everything on Railway, eyes open, teardown after) · **Hybrid** (Ghostfolio + wa-bridge on Railway forever; Discourse on the `deploy/gcp` VM with the official launcher — supported upgrades, full plugin set) · **Full GCP** (`deploy/gcp`, the production posture).

## What each path supports

| Capability | A · All-Railway demo | B · Hybrid (recommended) | C · Full GCP (`deploy/gcp`) |
|---|---|---|---|
| Discourse version | 3.5.0 frozen (bitnamilegacy) | current (official launcher) | current (official launcher) |
| Supported upgrades | ❌ none (or self-built `web_only` images, manual) | ✅ `./launcher rebuild` | ✅ `./launcher rebuild` |
| Real signup emails | Pro plan + Brevo only | ✅ Brevo/any SMTP | ✅ Brevo/any SMTP |
| v3 plugin set | core-bundled 3.5.0 plugins only (chat, polls, reactions, calendar, gamification, solved, topic-voting, data-explorer). **No discourse-ai** (needs pgvector + plugin install), no whos-online/follow | ✅ everything incl. discourse-ai | ✅ everything |
| Uploads/avatars | S3-compatible offload required (web+sidekiq can't share a Railway volume) | VM disk (launcher default) | VM disk + GCS backups |
| Ghostfolio | ✅ | ✅ (Railway) | ✅ (apps VM) |
| 50-user simulation (`test/community-sim`) | ✅ works (admin-API users need no email) | ✅ | ✅ |
| Good for | throwaway demo, stakeholder walkthrough | pilot → production | production per roadmap |
| Rough cost | ~$10–25/mo usage (+$20/mo Pro if SMTP) | Railway ~$5–10 + 1 VM ~$30–50 | ~$100/mo pilot scale |

## Files here

| File | Purpose |
|---|---|
| `RUNBOOK-RAILWAY.md` | Step-by-step: Path A (all-Railway) and Path B (hybrid), from empty project to a **living forum with the 50-user test passed** |
| `env/discourse-web.env.sample` | Bitnami Discourse web service variables (Railway `${{...}}` references included) |
| `env/discourse-sidekiq.env.sample` | Sidekiq worker variables (same image, worker entrypoint) |
| `env/ghostfolio.env.sample` | Ghostfolio service variables |

## The five facts people learn the hard way (all verified)

1. **`bitnamilegacy/*` never updates.** Broadcom moved all versioned Bitnami tags to `bitnamilegacy` on 2025-08-28; current images are paid ("Bitnami Secure Images"). Do not build a durable community on a frozen forum image.
2. **Two services, one brain:** Bitnami Discourse needs a **web** service and a **Sidekiq** service from the same image (`/opt/bitnami/scripts/discourse/run.sh` vs `/opt/bitnami/scripts/discourse-sidekiq/run.sh`), sharing the same env. Railway volumes attach to a single service, so uploads must go to S3-compatible storage (`DISCOURSE_USE_S3=true`, R2/Spaces work) — otherwise images uploaded via web are invisible to Sidekiq (broken emails/thumbnails).
3. **`RAILWAY_RUN_UID=0`** on volume-attached Bitnami services, or the non-root image (UID 1001) can't write its volume.
4. **Railway Postgres is fine for Discourse core** (contrib ships `hstore` + `pg_trgm`, superuser default) — but **not for discourse-ai** (pgvector needs a custom Postgres image).
5. **First boot is slow:** asset precompile takes 10–20+ min with a RAM spike. Don't panic-restart it.

## Where the community test fits

Whichever path you pick, once `community.<your-host>` is up and you've created a **Global "All Users" unscoped admin API key**, run:

```bash
DISCOURSE_URL=https://<your-discourse-host> DISCOURSE_API_KEY=<key> node test/community-sim/run.mjs
```

That seeds the 50 pseudonymous members, 15 corridor dialogues, reactions, accepted answers, poll, AMA, and the two flag-queue exercises — then runs the 14 acceptance checks (UC1–UC14) and writes `test/community-sim/report/DesiSquare-50-user-test-report.md`. Details: `test/community-sim/README.md`.
