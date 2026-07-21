# HANDOVER — resume DesiSquareV3 on another machine (same Claude account)

> **Purpose:** open a fresh Claude Code session on any machine and continue exactly where this one left off. Everything below is committed to the repo, so `git clone` carries it. Last updated 20 Jul 2026.

## 1. Get the code

```bash
# Claude Code (web or CLI), signed into the same account:
#   add / open repo:  kalilurrahman/DesiSquareV3
git clone https://github.com/kalilurrahman/DesiSquareV3
cd DesiSquareV3
git checkout claude/desi-square-product-gh4xbh    # the working branch (also the repo default)
```

- **Repo:** `kalilurrahman/DesiSquareV3` · **Branch:** `claude/desi-square-product-gh4xbh` (this branch *is* the trunk — there is no `main`, so there is no PR to open).
- **HEAD at handover:** `4a6a342`.
- **Restore full product context:** paste `docs/desisquare-handoff.md` into any new chat, or read it first.

## 2. What this project is (10 seconds)

DesiSquare V3 "The Living Square" — a pseudonymous community for South-Asian retail investors on **Discourse** (community) + **Ghostfolio** (portfolio) + **WhatsApp** (opt-in), glued by three small services. This repo is the **final integration of the v1/v2 codebases** plus all product docs, the deploy packages, an interactive prototype, and a 50-user acceptance test.

**Six non-negotiable constraints** (bind every change): #3 flags private · #4 portfolio dollars owner-only (public = % only) · #5 WhatsApp consent-gated, E.164 never leaks · #7-A signed-out visitors get only the curated teaser · #8 percent-only maven pipeline · #9 recognition ranks engagement, never money. **Most-emphasized rule:** maven & member performance is **percent-only — Monthly/Yearly/Overall — never dollar amounts**; the owner's own `#/me` is the sole place an absolute value may render.

## 3. Repo layout

| Path | What |
|---|---|
| `app/` | **product app** (from v2 `desisquare-app`): `node serve.mjs` → :5191. Feed, maven profiles (Monthly/Yearly/Overall **% only**), member gains toggle, tabbed search, moderation. Degrades to seed when services are down. |
| `services/` | `models-service` (:8791, percent-only performance engine — equity indexed to 100, `periods` = Monthly/Yearly/Overall), `wa-bridge` (:8788), `gf-provisioner` (:8789). Each: `node --test` + `node scripts/smoke.js`. |
| `docs/` | `desisquare-user-stories.md` (**124 stories / 21 epics** — canonical spec), v4 prototype + catalog, gf-stats contract, runbooks, handoff index. |
| `deploy/gcp/` | production/demo package (2 VMs; `CLAUDE.md` drives a ~1h demo). `deploy/gcp/REQUIREMENTS.md` = F0–F5 increments. |
| `deploy/railway/` | Railway options (Ghostfolio clean; Discourse demo-only). |
| `deploy/CLIENT-INFRA-CHECKLIST.md` + `deploy/INFRA-PROGRESS.md` | the client ask (items 1–7) + live progress tracker (the daily nudge reads/writes this). |
| `demo/` | cutdown demo server (serves the product at `/`, prototype at `/prototype`); `railway.json` at root builds `demo/Dockerfile`. |
| `test/community-sim/` | 50-user community simulation + 14 acceptance checks (UC1–UC14). |
| `INSTALL.md`, `Makefile`, `scripts/dev-local.mjs` | local full-stack install. |

## 4. Run it (verify the machine is good)

```bash
make install          # Node ≥18 check, nothing to download (zero-dep stack)
make dev              # app + 3 services → http://localhost:5191  (maven %-periods LIVE)
make test             # all 58 service tests (models 34, wa 14, gf 10) — expect all pass
```

Prototype without installing: open `docs/desisquare-wireframes-v4-prototype.html`.
Published prototype artifact (private to the account): https://claude.ai/code/artifact/574e7e57-d264-49b0-b650-ae568fdbef8f

## 5. Deployment state

- **Railway (cutdown demo):** GitHub-connected to this repo/branch, **auto-deploys on push**. Live at `https://desisquarev3-production.up.railway.app` — `/` = product, `/prototype` = walkthrough, `/health` = JSON. *(The build sandbox often can't reach `*.up.railway.app` due to egress policy — confirm from a normal browser.)*
- **Real product (Discourse + Ghostfolio):** not yet stood up — needs the infra checklist (item 1 = GCP project). Use `deploy/gcp/CLAUDE.md` (demo mode ≈ 1 hour) or `deploy/railway/` (hybrid).
- Once a Discourse exists: `DISCOURSE_URL=… DISCOURSE_API_KEY=<global admin key> make community-test` seeds 50 users + runs the 14 acceptance checks.

## 6. Automations & session state (account-level, follow you across machines)

- **Daily nudge routine** `trig_01KmQJfWaMSWAPCX6DjRsC8D` — fires **09:00 daily** into the original session, drives infra checklist items 1–7 sequentially, updates `deploy/INFRA-PROGRESS.md`, commits progress. Manage with the claude-code-remote trigger tools (list/update/delete) or the claude.ai Routines UI. To stop: delete that trigger.
- **v1/v2 source** added to the original session and cloned to `/workspace/desisquare` and `/workspace/desisquarev2` (ephemeral — re-add with `add_repo` / `git clone` on a new machine if you need them for reference).

## 7. Open threads / next steps

1. **Confirm Railway is green** (`/health` from a browser) — the build sandbox can't reach it.
2. **Karma weights sign-off** (Actionable/Helpful +3 > Insightful +2 > Like +1, accepted +5, upheld flag −5) — see open questions in `docs/desisquare-handoff.md`.
3. **Infra checklist items 1–7** — the sequential client ask; the daily nudge is driving it. Item 4 (Meta/WhatsApp verification) has 1–3 week lead time — start early.
4. **Decision parked:** demo serves the product at `/` and the wireframe at `/prototype` — trivially swappable if you'd rather the wireframe be at `/`.
5. **Not yet built:** the real Discourse+Ghostfolio stack (needs infra); optional Discourse-AI (needs an LLM key).

## 8. Conventions & guardrails

- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + the `Claude-Session:` line. Push to `claude/desi-square-product-gh4xbh` with `git push -u origin <branch>`.
- **Never commit secrets** — `.env` files stay git-ignored / on the VM; tokens go to Secret Manager.
- Keep the app/prototype **zero-dependency, single-file, no build/network**.
- Any change to a public/maven surface must stay **percent-only** — re-run the leak checks (browser `$`-assert + the service no-currency guards) before committing.
- Root `CLAUDE.md` carries the binding product rules; read it before editing docs or prototype.
