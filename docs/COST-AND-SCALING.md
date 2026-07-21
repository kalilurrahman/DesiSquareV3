---
title: "DesiSquare — Cost Model & Scaling Path"
subtitle: "Pilot economics and the road from <1,000 to ~100,000 members"
author: "Prepared for K (kalilurrahman)"
date: "July 21, 2026"
status: "Reference — companion to deploy/PRODUCTION-DEPLOYMENT-GUIDE.md and deploy/gcp/roadmap.md (Phase 6)"
---

# Cost & Scaling

**Summary: ~$110/mo all-in at pilot; roughly linear to ~10k members, with step-changes beyond as the stack moves from VMs to Cloud-native managed services.**

Every figure in this document is an **estimate** in `us-central1`, on-demand pricing, mid-2026.
Cloud list prices, Meta WhatsApp rates, and LLM token prices all drift — treat the numbers as
planning bands, not quotes. Nothing here is a secret; no tokens, keys, or account IDs appear.
The canonical pilot number is **~$100/mo core + WhatsApp/LLM usage on top**, matching
`deploy/PRODUCTION-DEPLOYMENT-GUIDE.md` §13 and `deploy/gcp/roadmap.md`'s cost table.

The architecture these numbers price is the shipped default: **two GCP Compute Engine VMs** —
`discourse-1` (e2-medium) running the official Discourse Docker launcher, and `apps-1`
(e2-standard-2) running the DesiSquare app + Ghostfolio + the three Node services
(wa-bridge, gf-provisioner, models-service) + Postgres 15 + Redis 7 behind Caddy — plus a GCS
backup bucket and Cloud Ops. See the deployment guide §2 for the topology diagram.

---

## 1. Pilot cost breakdown (<1,000 members)

Two VMs, on-demand, `us-central1`. All values **estimated $/month**.

| Line item | Spec | ~$/mo | Notes |
|---|---|---:|---|
| `apps-1` VM | e2-standard-2 (2 vCPU / 8 GB) | ~$49 | DesiSquare app + Ghostfolio + wa-bridge + gf-provisioner + models-service + Postgres 15 + Redis 7 + Caddy |
| `discourse-1` VM | e2-medium (2 vCPU / 4 GB) | ~$25 | Official Discourse Docker launcher; owns its own VM (rebuilds in place) |
| Boot disks | 2 × 40 GB pd-balanced | ~$8 | One per VM |
| Static IPs | 2 reserved, attached | ~$7 | One per VM; attached IPs are cheap, unattached ones cost more |
| Egress | ~50 GB/mo internet-out | ~$6 | Pilot traffic; ingress is free |
| GCS backups | Small, 30-day lifecycle | ~$2–5 | Nightly Discourse tars + Ghostfolio `pg_dump` + `.env` offsite |
| Cloud DNS + logs + Ops Agent | Monitoring, uptime checks | ~$2 | Monitoring/logging free tier covers this scale |
| SMTP | Brevo free tier (300 emails/day) | $0 | Mailgun/SES/Postmark are paid alternatives |
| WhatsApp (Meta) | In-window replies free; pay per delivered template only | ~$5–20 | Usage-based; see §4. ~$0 if digests stay off at pilot |
| **Core total** | | **~$100–118/mo** | Headline **~$110/mo**; +domain ~$12/yr (~$1/mo) |

### Optional add-ons (priced separately — not in the ~$110 core)

| Add-on | What it buys | ~$/mo |
|---|---|---:|
| LLM API key (Anthropic/OpenAI) | Discourse AI topic summaries + auto-labelling (checklist item 6). Without it the stack falls back to first-post excerpts + keyword rules — everything still works | ~$20–50 |
| Extra GCS storage / upload offload | Forum media offload, longer backup retention | ~$1–5 |
| 1-year committed-use discount (CUD) | Applied to the two VMs once the shape is stable | **saves ~37% of VM cost** (~$74 → ~$47) |

At pilot the CUD is the single biggest lever and is essentially free money once the machine
sizes are settled — see §8. The budget alert is set at **~$150/mo** (F5.4), which leaves
comfortable headroom above the ~$110 core plus a modest LLM budget.

---

## 2. Where the bill actually comes from

At pilot the bill is **~75% fixed compute** (the two VMs + disks + IPs), so month-to-month it
barely moves. What *does* move it, in rough order of leverage:

1. **Compute hours / machine size (biggest fixed lever).** The two VMs are ~$74/mo of the ~$110
   total. Resizing up is the first scaling move and the first place cost climbs. A 1-year CUD
   knocks ~37% off this line without any architecture change.
2. **WhatsApp template volume (biggest *variable* lever).** In-window service replies are free;
   only out-of-window **template** sends cost money, priced by category and destination country
   (§4). Turning on a weekly marketing digest to a large opted-in list is the fastest way to add
   a recurring charge. The bridge is designed to keep this near zero by preferring in-window
   free-form replies.
3. **LLM tokens (opt-in).** If AI summaries/labels are enabled, cost scales with post volume ×
   tokens per summary. Batching, caching summaries, and summarising only high-traffic topics keep
   it inside the ~$20–50/mo band; disabling it drops it to $0 with graceful keyword-rule fallback.
4. **Egress.** Pilot egress (~50 GB) is ~$6. It grows with active users, media/image traffic, and
   API chatter to Ghostfolio/Meta. It stays small until you serve lots of uploaded images — the
   trigger to put a CDN in front (§5–§6).
5. **Backup storage.** Trivial at pilot (~$2–5) thanks to the 30-day lifecycle rule. Grows slowly
   with forum size; the lifecycle policy caps it.

**Rule of thumb:** below ~10k members the lever that matters is *machine size* (buy a CUD, resize
before you re-architect). Above ~10k the levers become *egress + DB IOPS + WhatsApp volume*, which
is exactly what the Phase 6 managed-service moves are built to absorb.

---

## 3. WhatsApp cost model

**Pricing shape (Meta, since Jul 2025):** WhatsApp Business is billed **per delivered template
message**, priced by **template category** and **destination country**. Free-form **service
replies inside the open 24-hour window are FREE** — and the bridge prefers them automatically.
There is no per-seat or platform fee on the Cloud API itself.

Template categories DesiSquare uses (`deploy/gcp/whatsapp/message-templates.json`):

| Template | Category | When it sends | Cost shape |
|---|---|---|---|
| `community_reply` | UTILITY | A Discourse reply arrives **outside** the member's 24h window | Per-delivered utility rate by country (often free inside an open window under current rules) |
| `optin_confirm` | UTILITY | One-time welcome/opt-in confirmation | Per-delivered utility rate; one per member, ever |
| `weekly_digest` | MARKETING | Optional re-engagement digest | Per-delivered **marketing** rate by country (the most expensive category) |

Utility templates run roughly **$0.004–$0.04 per message** depending on country; marketing
templates are higher. **US (+1) marketing templates are paused by Meta (since Apr 2025)** — so
US-corridor digests go via **email or the free in-window service reply**, not WhatsApp marketing.

### Worked pilot estimate (illustrative — estimate only)

Assume **800 active members**, corridors US/CA/UK/AE/AU/SG:

- **Community replies:** most land *inside* the 24h window (a member asks, the community answers
  within a day) → **free-form, $0**. Say ~20% fall outside the window → `community_reply` UTILITY:
  800 members × ~2 out-of-window replies/mo × ~$0.02 ≈ **~$32/mo worst case**, realistically
  **<$10/mo** because most conversations resolve in-window.
- **Opt-in confirmations:** ~one per new member. At ~100 new members/mo × ~$0.02 ≈ **~$2/mo**.
- **Weekly digest (if enabled, non-US):** ~500 non-US opted-in members × 4 sends/mo ×
  ~$0.03 marketing ≈ **~$60/mo** — this is the line that makes digests a deliberate decision, not
  a default. US members get the digest by email at $0.

**Pilot reality: ~$5–20/mo** with digests off or email-only, which is why the pilot table shows
that band. Enabling a full WhatsApp marketing digest is the main way to push WhatsApp spend past
$50/mo, so it is modelled before it is switched on (roadmap risk register).

### How the bridge minimises cost

- **Prefers in-window free-form replies** — the 24h `SERVICE_WINDOW_HOURS` logic sends a paid
  template *only* when the window has closed (error 131047 path). Most replies cost $0.
- **One opt-in template per member**, not per session.
- **Digests are email-first** for US and opt-in only elsewhere — no blanket marketing blasts.
- **STOP/UNSUBSCRIBE/CANCEL** suppresses outbound immediately, so you never pay to message someone
  who left (and stay compliant).

---

## 4. Scaling ladder

Directional bands, **estimates only**. Maps to `deploy/gcp/roadmap.md` Phase 6 and
`REQUIREMENTS.md`'s F6 out-of-scope note (Cloud Run / Cloud SQL / Memorystore / GKE / CDN). The
guiding principle: **resize before you re-architect; re-architect only when a trigger metric
saturates.** Each row is a lift of existing container images, not a rewrite.

| Members | Architecture at this scale | Key changes | Rough $/mo band | Trigger metrics (what prompts the *next* move) |
|---|---|---|---:|---|
| **~1k** (pilot) | 2 VMs: `discourse-1` e2-medium + `apps-1` e2-standard-2; Postgres/Redis as containers on `apps-1`; GCS backups | Shipped default. Add a 1-yr CUD once stable | **~$100–150** | `apps-1` CPU/RAM sustained >70%; Discourse P95 latency creeping; disk >70% |
| **~10k** | Still 2 VMs, **resized**: `apps-1` → e2-standard-4, `discourse-1` → e2-standard-2/4 with a **separate data disk**; low-TTL DNS | Vertical resize (minutes of downtime); split Discourse's Postgres onto its own disk; consider CDN for forum media | **~$250–450** | Vertical resize exhausted (largest sensible e2); DB CPU/IOPS the bottleneck; ops toil rising; want autoscaling/HA |
| **~50k** | **Cloud Run** for stateless app + 3 services; **Cloud SQL** (Postgres) for the app/Ghostfolio DBs; **Memorystore** (Redis); **Cloud CDN** for static/media; Discourse stays on a **bigger VM** (e2-standard-4+, separate data disk) or moves to **managed Discourse** | Stateless tiers autoscale; managed DB gives backups/HA/failover; CDN offloads egress. Images already exist → lift, not rewrite | **~$600–1,200** | Multi-service scale + team growth; need multi-zone HA; per-service independent scaling; deploy frequency high |
| **~100k** | **GKE Autopilot** for the app/services tier; **Cloud SQL HA** (regional) + read replicas; **Memorystore HA**; **Cloud CDN**/Cloudflare; Discourse on **managed/HA multi-host** (or dedicated e2-standard-4+ with CDN) | Full container orchestration, horizontal autoscaling, regional redundancy; Discourse professionally hosted or multi-host | **~$1,500–4,000+** | Global multi-region demand; strict SLA/uptime targets; dedicated platform team; regulatory/HA requirements |

**Discourse scales on its own track.** It is *not* moved to Cloud Run/GKE — its only supported
install is the Docker launcher owning a VM. It scales **vertically** (bigger machine + separate
data disk + CDN, per roadmap: e2-standard-4 at >20k DAU), and only then to a **managed host**
(discourse.org / Communiteq) or a multi-host setup. This keeps the "supported shape" intact at
every tier while the app tier goes Cloud-native around it.

---

## 5. Capacity planning — what saturates first

Watch these per tier; the **first** one to saturate is your trigger to move.

| Tier | Saturates first | Signal / threshold | Response |
|---|---|---|---|
| **~1k** | `apps-1` CPU/RAM (5 co-located services + Postgres + Redis + Ghostfolio price-fetch jobs) | Sustained CPU or RAM **>70%**; swap thrashing | Resize `apps-1` up one step; buy CUD |
| **~10k** | **Discourse Postgres/Redis** (busiest single component: forum reads, notifications, search) and forum egress from images | Discourse P95 latency up; DB CPU high; rebuild windows painful | Separate Discourse data disk; e2-standard-2/4; CDN in front of forum media |
| **~50k** | **DB IOPS/connections** and **egress**; single-VM has no HA | DB connection saturation; egress bill climbing; zone-incident risk unacceptable | Move DBs to **Cloud SQL** (managed pooling, HA); Redis to **Memorystore**; **Cloud CDN** for media; app/services to **Cloud Run** |
| **~100k** | **App-tier horizontal capacity** + **WhatsApp rate/quality tier** + regional latency | Cloud Run instance ceilings; Meta messaging-limit tier caps throughput; cross-region latency | **GKE Autopilot** app tier; Cloud SQL HA + read replicas; multi-region CDN; raise Meta messaging tier by holding a green quality rating |

**Headroom guidance:** target **<70% sustained** CPU/RAM/disk on any tier — that is the standard
"resize now" line, giving ~30% burst headroom. For the DB, watch **connection count and IOPS**
before raw CPU; those cap first. For WhatsApp, **messaging limits rise in tiers** as the number's
**quality rating** stays green — capacity there is earned by good sending behaviour, not bought.

**When to split Discourse onto managed/HA:** when (a) vertical resize is exhausted (largest
sensible single VM), **or** (b) forum downtime during monthly `./launcher rebuild app` becomes
unacceptable to the community, **or** (c) you need multi-zone HA for the forum specifically. At
that point either a bigger dedicated VM + CDN (>20k DAU, per roadmap) or **managed Discourse**
(discourse.org / Communiteq, ~$100–300+/mo at scale) is the move — it removes forum ops entirely
while the rest of the stack stays on GCP.

---

## 6. Build vs managed

Cost and ops trade-offs by approach. Recommendation is **per stage**, not absolute.

| Option | ~$/mo (pilot) | Ops burden | Control | Key limits | Recommended for |
|---|---:|---|---|---|---|
| **Self-host GCP, 2 VMs** (default) | ~$110 | Medium — you patch/upgrade/back up; scripts automate most | **Full** — IAP, Secret Manager, managed backups, any plugin | You own uptime; single-zone at pilot (no HA) | **Pilot → early growth (the recommendation).** Best control-per-dollar; clean Phase 6 path |
| **Single VPS** (DigitalOcean / Lightsail) | ~$40–60 | Medium — same Discourse launcher on one $12–24 box; Ghostfolio + services alongside | High, but no GCP-native IAP / Secret Manager / managed backups | One box = one failure domain; you rebuild the ops glue yourself | Cost-sensitive pilots already on those providers; not the smoothest scale path |
| **Managed Discourse** (discourse.org / Communiteq) | ~$50–100 (forum only) | **Low** for the forum; you still host Ghostfolio + services | Limited — plugin/tier restrictions, less config access | Plugin/tier caps; you still run the rest of the stack | Teams that want **zero forum ops**; pairs well with GCP for the app tier at ~50k+ |
| **Hybrid: Ghostfolio on Railway** | ~$5–20 (Ghostfolio slice) | Low for Ghostfolio; Discourse still needs a real VM | Medium | **Discourse CANNOT run supported on Railway** (community image frozen at 3.5.0, no security updates — demo-only) | Keeping an existing Railway Ghostfolio; wire `GHOSTFOLIO_URL` to it |

**Hard constraint:** Discourse has exactly one supported install path — its Docker launcher on a
plain Linux VM it fully owns. Railway/Heroku-style platforms are **demo-only, never production**
for Discourse. Ghostfolio, by contrast, deploys cleanly on Railway and is a valid hybrid slice.

**Stage recommendation:** self-host GCP 2-VM for **pilot and early growth**; introduce **managed
Discourse** and **Cloud-native app tiers** only when the §4/§5 trigger metrics fire.

---

## 7. Cost controls & FinOps

Concrete levers, cheapest-effort first:

- **Budget alerts (do this first).** Project budget at **~$150/mo** with 50/90/100% email
  thresholds to the ops contact (F5.4). It is the safety net against surprise WhatsApp/LLM/egress
  creep and is already in the launch checklist.
- **Right-size to <70%.** Watch Ops Agent metrics; resize a VM up (or down) rather than leaving
  slack or running hot. Vertical resize is minutes of downtime and the cheapest scaling move —
  always the first lever before re-architecting.
- **Committed-use / sustained-use discounts.** A **1-year CUD on the two VMs saves ~37%** once the
  machine shape is stable (~$74 → ~$47/mo of VM cost). Sustained-use discounts apply automatically
  for always-on instances. Take the CUD once pilot sizing settles — it is the biggest no-risk save.
- **Spot/preemptible for non-critical only.** Never for the always-on VMs or DBs. Reasonable for
  throwaway batch/restore-drill/scratch instances, which can be spot to cut ~60–90%.
- **Storage lifecycle.** The GCS bucket already has a **30-day delete lifecycle** on backups
  (F1.3) — keep it; it caps backup storage automatically. Extend retention deliberately, not by
  default.
- **WhatsApp discipline.** Prefer in-window free replies (bridge default); keep digests email-first
  for US and opt-in elsewhere; model per-template cost before enabling any broadcast (§3).
- **LLM discipline.** If enabled, cache summaries, batch, and summarise only busy topics; the
  keyword-rule fallback means $0 is always an option.
- **Turn off the demo.** A left-running demo costs **~$0.10/hour (~$75/mo)**. Tear it down with
  `deploy/gcp/scripts/99-teardown.sh` when idle — this is the most common accidental spend.
- **Single-zone at pilot is a deliberate cost choice.** HA (multi-zone, managed DB failover)
  arrives with Phase 6; at pilot the mitigation is nightly offsite backups + a tested restore
  drill, not paying for redundancy you don't yet need.

---

## 8. TL;DR recommendation

- **Pilot & early growth (up to ~10k members): stay on the GCP 2-VM default.** ~$110/mo all-in,
  full control, clean upgrade path. Buy a **1-year CUD** once sizes settle (~37% off the VMs), arm
  the **~$150/mo budget alert**, and keep WhatsApp on free in-window replies with email-first
  digests.
- **Scale vertically before you re-architect.** Resize the VMs (minutes of downtime) as the first
  response to any >70% sustained saturation. This carries you to ~10k members cheaply.
- **Go Cloud-native only when a trigger metric fires (~50k+):** move the stateless app + services
  to **Cloud Run**, DBs to **Cloud SQL**, Redis to **Memorystore**, add a **CDN** — a lift of
  existing images, not a rewrite (~$600–1,200/mo band).
- **GKE Autopilot + regional HA at ~100k** and a dedicated platform team (~$1,500–4,000+/mo).
- **Discourse never moves to Cloud Run/GKE** — it scales vertically, then to a managed/HA host,
  preserving its only supported shape at every tier.

All figures are directional estimates; validate against live GCP/Meta/LLM pricing before
committing. Keep this document consistent with `deploy/PRODUCTION-DEPLOYMENT-GUIDE.md` §13,
`deploy/gcp/roadmap.md` (cost table + Phase 6), and `deploy/CLIENT-INFRA-CHECKLIST.md` (options
A–D) whenever any of them change.
