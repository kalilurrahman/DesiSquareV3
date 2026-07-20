# wa-bridge (Script 1 — WhatsApp bridge)

Mirrors designated **WhatsApp group messages → Discourse** (as the mapped member) and sends
**Discourse notifications → WhatsApp** via the official Cloud API. Covers tickets **DS-040…DS-047**.

**Zero runtime dependencies for the stub.** The WhatsApp client is a **mock** behind a seam
(`src/wa-client.js`). The **real `whatsapp-web.js` backend is implemented** (`src/wa-client-live.js`)
and selected at runtime by `WA_BACKEND` — its heavy deps (Chromium via puppeteer) are dynamic-imported
only when live, so the default stays dependency-free.

> ⚠️ Architecture reality (see `docs/mvp-investment-platform/09`): the official WhatsApp Cloud API
> **cannot read group messages** — only the unofficial `whatsapp-web.js` bridge can. So **inbound**
> uses the bridge seam; **outbound** notifications use the compliant Cloud API (`src/cloud-api.js`).

## Run
```bash
cd services/wa-bridge
npm test            # unit tests (12)
npm run smoke       # offline pipeline demo (map -> mirror -> dedupe -> guest)
npm start           # http://localhost:8788  (mock mode with no keys)
```

## Exercise it without WhatsApp
```bash
# link a phone to a member (admin) — phone is never echoed back
curl -X POST localhost:8788/map -H 'Content-Type: application/json' \
  -d '{"phone":"+14155550172","username":"rohit","userId":42}'
# simulate an inbound group message -> posts to Discourse as @rohit (or mock-logs it)
curl -X POST localhost:8788/simulate/message -H 'Content-Type: application/json' \
  -d '{"id":"m1","groupJid":"dev-group","phone":"+14155550172","text":"DTAA on US-India gains?"}'
# opt a member out
curl -X POST localhost:8788/optout -H 'Content-Type: application/json' -d '{"phone":"+14155550172"}'
curl localhost:8788/health
```

## Going live with real WhatsApp (`whatsapp-web.js`)
The **inbound** path can read WhatsApp groups only via the **unofficial** `whatsapp-web.js` library
(the official Cloud API can't). It's implemented and wired behind the seam — flip it on once the
decision + number are in place:

1. **Business go/no-go** — this drives a headless WhatsApp Web session, which **violates WhatsApp's
   ToS and can get the number banned**. Decide first, and use a **dedicated** number (not a personal one).
2. `npm run install:wa` — installs `whatsapp-web.js` + `qrcode-terminal` (pulls Chromium via puppeteer;
   `--no-save`, so `package.json` stays dependency-free).
3. Set `WA_BACKEND=whatsapp-web.js` in `.env`, then `npm start`.
4. **Scan the QR** printed in the console (WhatsApp → Settings → Linked devices → Link a device).
   `GET /session` also carries the current `qr`. The paired session is cached under `data/wa-session`
   (git-ignored) so restarts don't re-prompt.
5. Send a message in the group; the bridge posts it into Discourse as the mapped member (unmapped →
   guest). Set `ALLOWED_GROUPS` to the group JID(s) once you know them (shown in the logs).

**Outbound** notifications remain on the compliant Cloud API — set `WA_CLOUD_TOKEN` +
`WA_PHONE_NUMBER_ID` and get the `desisquare_notification` template approved.

## Endpoints
| Method | Path | Purpose | Ticket |
|---|---|---|---|
| GET | `/health` | status + WA connection + mapped users | DS-040 |
| GET | `/session` | WhatsApp connection state (QR seam) | DS-040 |
| POST | `/map` | link phone ↔ member (consent) | DS-042 |
| POST | `/optout` | stop mirroring/notifying a member | DS-042 |
| POST | `/simulate/message` | DEV: inject an inbound group message | DS-041/043 |
| POST | `/discourse/notify-webhook` | Discourse notification → WhatsApp (HMAC) | DS-045/046 |

## Design guarantees (already enforced in the stub)
- **Allow-list** groups (DS-041); empty = allow-all for dev only.
- **Idempotent** by WhatsApp message id / notification id (DS-043) — no double posts.
- **Consent + opt-out** (DS-042); opted-out members are treated as unmapped.
- **Phone privacy**: numbers are the map key, **never returned by any endpoint or written into a
  post**; logs use a salted hash. Unmapped senders post as a guest with an invite (DS-044).
- Outbound **falls back to email** on Cloud API failure (DS-045, stub logs it).

## To productionise
1. ✅ **Done** — `src/wa-client-live.js` implements the `whatsapp-web.js` backend (LocalAuth session
   under `data/wa-session`); flip on with `WA_BACKEND` (see "Going live" above). For deploy, run it as
   a **single stateful instance** with the session on a mounted volume (StatefulSet+PVC on GKE — docs/05).
2. Move `src/store.js` to encrypted Postgres tables (`phone_map`, `wa_message_log`) + Redis for hot
   lookups/dedupe; add rate limiting + `/health` alerting (DS-047).
3. Register the Discourse webhook (`notification_created`) at `/discourse/notify-webhook` with a
   shared `DISCOURSE_WEBHOOK_SECRET`; get WhatsApp Cloud API templates approved.
