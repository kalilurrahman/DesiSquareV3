# DesiSquare — what we need from you (client infra checklist)

> One page, everything the build team needs to take DesiSquare from prototype to a live product. Items are ordered by lead time — **#4 (WhatsApp business verification) takes 1–3 weeks and must start first**. Everything else is same-day. Costs are monthly estimates at pilot scale (<1,000 members).

## The one decision first

**Where does Discourse live?** Discourse (the community engine) only supports one install method: its Docker launcher, which needs a plain Linux VM it fully owns. It cannot run supported on Railway/Heroku-style platforms. Pick one:

| Option | What it means | Cost | Our recommendation |
|---|---|---|---|
| **A. GCP (our default)** | 2 VMs per `deploy/gcp/` — everything scripted, demo in ~1 hour, production per RUNBOOK | ~$100/mo all-in | ✅ Yes — the whole package is built for this |
| B. Any VPS (DigitalOcean/Lightsail) | Same launcher on a single $12–24 VPS; Ghostfolio stays on Railway | ~$40–60/mo | Fine if you prefer your existing accounts |
| C. Managed Discourse hosting | discourse.org or Communiteq run the forum | from ~$50–100/mo | Zero-ops, but plugin/tier limits and you still host the rest |
| ~~D. Railway for Discourse~~ | Community image frozen at 3.5.0 (no security updates), unsupported upstream | — | ❌ Demo-only, never production |

*(Ghostfolio — the portfolio tracker — runs happily on Railway either way; your current Railway app already is one.)*

## The checklist

### 1 · Cloud account & billing *(same day · blocks everything)*
- [ ] **GCP project with billing enabled** (Option A) — grant `Owner` or `Editor` to the deploy account, or run `gcloud auth login` with us on a call. *(Option B: VPS provider account + API token instead.)*
- [ ] Region preference: `us-central1` (default) or `asia-south1` (India-first)?
- [ ] Budget alert sign-off: ~$150/mo cap (per F5.4).

### 2 · Domain & DNS *(same day · blocks HTTPS + email)*
- [ ] **A registered domain** (e.g. `desisquare.com`) — purchase or confirm ownership.
- [ ] **Registrar/DNS access** (or delegate to Cloud DNS) to create 4 A records: `community.` `app.` `folio.` `wa.` — plus the email TXT records below.
- [ ] *(No domain yet? The demo runs on sslip.io hostnames with real HTTPS — zero DNS needed — but production and email require the domain.)*

### 3 · Transactional email (SMTP) *(same day · blocks real signups)*
- [ ] **A Brevo account** (free tier: 300 emails/day) or Mailgun/Postmark — we need the **SMTP key** (Brevo: the `xsmtpsib-…` key, *not* an API key).
- [ ] Permission to add **SPF, DKIM, DMARC** TXT records on the domain (we supply exact values).
- [ ] A sender address (e.g. `no-reply@desisquare.com`).
- *Why it's non-negotiable: Discourse cannot activate signups without email. No SMTP = invite/admin-created accounts only.*

### 4 · WhatsApp (Meta) *(START NOW — 1–3 weeks lead time)*
- [ ] **Meta developer account** + a Meta app created (we walk you through the ~10 clicks; `deploy/gcp/whatsapp/WHATSAPP-SETUP.md`).
- [ ] **Meta Business Verification started on day 0** — this is the critical path for production WhatsApp; the free **test number** works immediately for the demo loop.
- [ ] A **phone number to dedicate** to the Business API (cannot be an active personal WhatsApp number) + the display name you want members to see.

### 5 · Access & secrets *(same day)*
- [ ] GitHub: deploy key / access to the private **DesiSquareV2 app repo** (F0.6) so the existing app deploys next to Ghostfolio.
- [ ] Railway account access **if** keeping Ghostfolio there (hybrid); note: Railway only allows outbound SMTP on its Pro plan ($20/mo) — irrelevant if email is handled on the Discourse VM.
- [ ] Agreement: all tokens (Meta, API keys) live in **GCP Secret Manager**; `.env` files stay on the VMs; nothing in the repo.
- [ ] Who holds the platform-admin credentials, and who is the moderation/ops contact?

### 6 · Optional but recommended
- [ ] **LLM API key** (Anthropic or OpenAI) + a small monthly budget (~$20–50) — powers Discourse AI topic summaries and auto-labelling (requirements R2/R3). Without it we fall back to first-post excerpts and keyword rules; everything still works.
- [ ] S3-compatible bucket (or we use GCS) for forum upload offload/backups.

### 7 · Product decisions we're holding for you *(from the open-questions register)*
- [ ] Karma weights confirm: Actionable/Helpful **+3** > Insightful **+2** > Like +1, accepted answer +5, upheld flag −5.
- [ ] Corridor benchmark for maven charts (S&P 500 TR for US; Nifty 50 TR for India?).
- [ ] Chat Squares at launch: all six corridors or US/CA first?
- [ ] Public teaser stays `noindex` (current constraint #7-A posture) — opening it to search engines would need an explicit privacy re-review.

---

**With items 1–3 in hand we can have the demo live the same day** (Discourse + Ghostfolio + seeded community + the 50-user acceptance test green: `test/community-sim/`). Item 4 gates only the WhatsApp production loop. Sequencing lives in `deploy/gcp/REQUIREMENTS.md` (F0 → F5, one increment per session, each ending in an acceptance table).
