# WhatsApp Business Cloud API — Configuration Runbook (DesiSquare Demo)

> **BiGMo Consulting · DesiSquare demo pack · 19 Jul 2026.** Researched against official documentation (July 2026) and adversarially fact-checked; verifier corrections are folded in. Companion docs: `demo-install-00-overview.md` for topology and install order.

**Scope:** Wire the Meta WhatsApp Business Cloud API to the DesiSquare demo VPS (Ubuntu 24.04, Caddy reverse proxy, `community.example.com` / `app.example.com`) for (a) opt-in member notifications and (b) the consent-gated `wa-bridge` mirroring path. Demo-grade, single WABA, unverified business. Graph API version used throughout: **v25.0** (current as of mid-2026; pin it in one env var so upgrades are a one-line change).

**Hard rules carried through this runbook:** official Cloud API only — no whatsapp-web.js, no Baileys, no reverse-engineered clients (ToS violation + account ban + zero audit story). Consent-gated mirroring (constraint #5): E.164 numbers never appear in forum content; a message from a non-consented number is dropped, never posted.

**Environment variables used in every command** (put in `/etc/desisquare/wa-bridge.env`, mode `0600`, owned by the service user):

```bash
WA_GRAPH_VERSION=v25.0
WA_PHONE_NUMBER_ID=            # "Phone number ID" from API Setup panel (NOT the phone number itself)
WA_WABA_ID=                    # WhatsApp Business Account ID
WA_ACCESS_TOKEN=               # temporary (Step 3.1) then system-user permanent (Step 3.2)
WA_APP_SECRET=                 # App Dashboard > App settings > Basic > App secret
WA_VERIFY_TOKEN=               # any random string you invent, e.g. openssl rand -hex 24
```

---

## 1. Prerequisites and what works UNVERIFIED

1. **Personal Meta (Facebook) account** — needed to log in to `developers.facebook.com`. Use a real, aged account; brand-new throwaway accounts get flagged.
2. **Meta Business Portfolio** (formerly "Business Manager account") — create at `business.facebook.com` → **Create a business portfolio** (business name "DesiSquare", your name, business email). The app-creation wizard in Step 2 can also create one inline.
3. **Business verification is NOT required for the demo.** Unverified, you get:
   - An auto-provisioned **test phone number** (a Meta-owned number) that can send **unlimited messages to up to 5 verified recipient numbers**. Test numbers need no payment method to send template messages.
   - If you instead register a **real** number while unverified: limited to **250 business-initiated conversations per rolling 24 h** until business verification + display-name approval move you to Tier 1 (1,000). Since Oct 2025 messaging limits are **portfolio-based** (all numbers in the portfolio share the highest achieved limit).
4. **For production later** you will need: completed business verification (Business Portfolio → **Settings → Security Center → Start verification**: legal name, address, registration doc, domain/email proof), an approved **display name**, a **real phone number** that can receive an SMS/voice OTP and is not currently registered to a WhatsApp consumer/Business app, and a **payment method** on the portfolio.
5. Demo server prerequisites: Caddy already terminating TLS for `community.example.com` (Let's Encrypt), `wa-bridge` service listening on `127.0.0.1:8787`.

**✅ Checkpoint 1:** You can open `business.facebook.com/settings` and see the "DesiSquare" portfolio; you can log in to `developers.facebook.com/apps`.

---

## 2. Create the app, add WhatsApp, get the test number

1. Go to `developers.facebook.com/apps` → **Create App**.
2. Enter **app name** (`desisquare-demo`) and contact **email** → Next.
3. **Use case selection** (current flow): choose **"Connect with customers through WhatsApp"** (this replaces the old "app type: Business" picker; if you instead pick "Other/Something else", choose app type **Business** and add the **WhatsApp** product from the dashboard afterwards — same result). → Next.
4. **Business portfolio**: select the DesiSquare portfolio (or create one inline) → review → **Create app**.
5. You land on **WhatsApp → Quickstart / API Setup** (dashboard left nav: *WhatsApp > API Setup*). Meta has auto-provisioned:
   - a **test WhatsApp Business Account** (copy its ID → `WA_WABA_ID`),
   - a **test business phone number** (copy the **Phone number ID** → `WA_PHONE_NUMBER_ID`; note the Phone number ID is a Graph object ID, not the +1555… number).
6. **Add recipient test numbers** (max **5**): in *API Setup*, under **To** → **Manage phone number list** → **Add phone number** → enter your personal WhatsApp number in international format → Meta sends a WhatsApp/SMS **verification code** to that phone → enter it. Repeat for each demo tester (you + up to 4 teammates). **Note:** recipients can be added **and removed** via To → Manage phone number list (each add requires code re-verification); it is the Meta-provided **test business number itself** that cannot be deleted. Unverified/unlisted recipients fail with error **131030**.

**✅ Checkpoint 2:** *API Setup* shows a test number with a green "Connected"-style status, `WA_PHONE_NUMBER_ID` and `WA_WABA_ID` are filled in your env file, and at least one recipient number shows as verified.

---

## 3. Tokens: temporary (24 h) vs permanent system-user token

### 3.1 Temporary token (first smoke test only)

1. On *WhatsApp > API Setup*, copy the **Temporary access token**. It **expires in ~24 hours** — good for Step 4's smoke test, nothing else. When it dies you'll see OAuth error **code 190** ("Error validating access token: Session has expired").

### 3.2 Permanent token via SYSTEM USER (what wa-bridge/gf jobs actually use)

1. `business.facebook.com/settings` (Business Portfolio **Settings**) → **Users → System users** → **Add**.
2. Name: `desisquare-svc`; role: **Admin** (Admin is simplest for a demo; Employee works if you assign assets carefully) → **Create system user**. Accept the non-disclosure prompt if shown.
3. Select the new system user → **Assign assets** → tab **Apps** → select `desisquare-demo` → enable **Full control (Manage app)** → **Assign assets**. (If your WABA appears under an "WhatsApp accounts" asset tab, assign it too with full control.)
4. Still on the system user → **Generate token** → choose app `desisquare-demo` → **token expiration: Never** → tick permissions **`whatsapp_business_messaging`** and **`whatsapp_business_management`** (both are required; missing either causes permission errors on send or template/webhook management) → **Generate token**.
5. **Copy the token immediately — it is shown only once.** Put it in `WA_ACCESS_TOKEN` in `/etc/desisquare/wa-bridge.env`. Never commit it; never expose it client-side.

**✅ Checkpoint 3:**

```bash
source /etc/desisquare/wa-bridge.env
curl -s "https://graph.facebook.com/${WA_GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name" \
  -H "Authorization: Bearer ${WA_ACCESS_TOKEN}"
# → {"display_phone_number":"+1 555 ...","verified_name":"Test Number","id":"..."}
```

---

## 4. Send the first messages

### 4.1 `hello_world` template (works cold — no service window needed)

```bash
source /etc/desisquare/wa-bridge.env
curl -i -X POST "https://graph.facebook.com/${WA_GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "15551234567",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": { "code": "en_US" }
    }
  }'
```

`to` = a **verified test recipient** in E.164 digits (no `+` needed). Success response contains `"messages":[{"id":"wamid...."}]` — a `wamid` proves the API accepted it (delivery is confirmed via webhook `statuses`, not the HTTP response).

### 4.2 Free-form text inside the 24-hour customer-service window

Free-form (non-template) messages are only deliverable within **24 h of the user's last inbound message**. So: from the test recipient's phone, **send any WhatsApp message to the test number first**, then:

```bash
curl -i -X POST "https://graph.facebook.com/${WA_GRAPH_VERSION}/${WA_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "15551234567",
    "type": "text",
    "text": {
      "preview_url": false,
      "body": "DesiSquare demo: your alert wiring works. (Educational community — not investment advice.)"
    }
  }'
```

If you skip the inbound-first step you get error **131047** (re-engagement / outside service window → must use a template).

**✅ Checkpoint 4:** Both messages arrive on the tester's phone; both API responses returned a `wamid`.

---

## 5. Webhooks → wa-bridge (inbound messages)

### 5.1 Requirements

- Callback URL must be **public HTTPS with a valid CA-signed cert** (Let's Encrypt via Caddy is fine; self-signed fails).
- Must answer the GET verification handshake and answer POSTs with **HTTP 200 fast** (process async; Meta retries aggressively, with backoff up to ~7 days, and repeated failures pause delivery).

### 5.2 Caddy route (demo server)

In the `community.example.com` site block of `/etc/caddy/Caddyfile`:

```caddyfile
community.example.com {
    handle /wa-bridge/webhook* {
        reverse_proxy 127.0.0.1:8787
    }
    # ... existing Discourse reverse_proxy below ...
}
```

`sudo systemctl reload caddy`. Callback URL = `https://community.example.com/wa-bridge/webhook`.

### 5.3 Verification handshake (GET)

Meta sends: `GET /wa-bridge/webhook?hub.mode=subscribe&hub.verify_token=<your token>&hub.challenge=<random>`.
wa-bridge must check `hub.mode == "subscribe"` and `hub.verify_token == WA_VERIFY_TOKEN`, then respond **200 with the raw `hub.challenge` value as the plain-text body** (not JSON, no quotes). Anything else → dashboard shows "callback URL couldn't be verified".

### 5.4 Signature validation (REQUIRED on every POST)

Every POST carries `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256 of the **raw request body** with the **App secret** (App Dashboard → *App settings → Basic → App secret* → `WA_APP_SECRET`). wa-bridge must reject mismatches with 403 **before** trusting `from`:

```python
import hmac, hashlib

def valid_signature(raw_body: bytes, header: str, app_secret: str) -> bool:
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[len("sha256="):])
```

Compute over the **raw bytes** (before any JSON re-serialization — re-encoding changes the bytes and breaks the HMAC). Use a timing-safe compare.

### 5.5 Configure in the App Dashboard and subscribe to `messages`

1. App Dashboard → **WhatsApp → Configuration → Webhook → Edit**.
2. Callback URL: `https://community.example.com/wa-bridge/webhook`; Verify token: value of `WA_VERIFY_TOKEN` → **Verify and save** (this fires the GET handshake).
3. Under **Webhook fields**, **Subscribe** to **`messages`** (this one field carries inbound messages *and* delivery `statuses`). Skip the rest for the demo.
4. For a WABA not auto-linked by the wizard, subscribe the app explicitly:
   ```bash
   curl -X POST "https://graph.facebook.com/${WA_GRAPH_VERSION}/${WA_WABA_ID}/subscribed_apps" \
     -H "Authorization: Bearer ${WA_ACCESS_TOKEN}"
   ```

### 5.6 Sample inbound payload (what wa-bridge parses)

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<WA_WABA_ID>",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "15550001111", "phone_number_id": "<WA_PHONE_NUMBER_ID>" },
        "contacts": [{ "profile": { "name": "Nikhil" }, "wa_id": "14085551234" }],
        "messages": [{
          "from": "14085551234",
          "id": "wamid.HBgLMTQwODU1NTEyMzQ...",
          "timestamp": "1752888000",
          "type": "text",
          "text": { "body": "Anyone tracking VOO vs VTI for the US corridor?" }
        }]
      }
    }]
  }]
}
```

wa-bridge rules: handle `value.messages[]` of `type == "text"`; **ignore** `value.statuses[]` (read/delivery receipts); dedupe on the `wamid` (Meta redelivers); map `from` (wa_id) → Discourse user via the consent table (Step 7) and post under the member's **pseudonym** within 60 s. The E.164 never enters the post, title, or logs at info level.

**✅ Checkpoint 5:** Dashboard shows the webhook verified and `messages` subscribed; sending "test" from a tester phone to the test number produces a wa-bridge log line with a `wamid` within seconds, and a spoofed `curl -X POST` without a valid signature returns 403.

---

## 6. Message templates (WhatsApp Manager)

1. Open **Meta Business Suite → WhatsApp Manager** (`business.facebook.com/wa/manage/`) → select the WABA → **Message templates** → **Create template**. (Templates can also be created via API: `POST /{WABA_ID}/message_templates`.)
2. **Category — choose deliberately, Meta re-categorizes miscategorized templates:**
   - **Utility** = triggered by a user action/agreed transaction or subscription (order updates, account alerts). **DesiSquare reply alerts are Utility**: the member explicitly subscribed to "notify me of replies to my threads" — it is a transactional notification about their own activity, not promotion. Utility is also cheaper, and since 1 July 2025 **free when delivered inside an open service window**.
   - **Marketing** = anything promotional or engagement-bait; **mixed content (alert + promo) is forced to Marketing**. The weekly digest is promotional re-engagement → Marketing.
3. **Variable rules:** placeholders are `{{1}}, {{2}}…` in strict sequence; a body cannot **begin or end** with a variable and cannot have adjacent variables with no text between; you must supply **sample values** at submission; too many variables relative to text triggers rejection (`INVALID_FORMAT`).
4. **Approval:** status goes *In review* → *Approved/Rejected*, typically **minutes to 24 hours** (auto-review is usually fast for clean Utility templates). You'll also see status webhooks if you subscribe to `message_template_status_update` (optional for demo).
5. **DesiSquare demo templates:**

   **`reply_alert` — category UTILITY, language `en`:**
   ```
   Hi {{1}}, there's a new reply in your DesiSquare thread "{{2}}".
   Open DesiSquare to read and respond. DesiSquare is an educational
   community — nothing here is investment advice.
   Reply STOP to turn off reply alerts.
   ```
   Samples: `{{1}}=quiet_lotus`, `{{2}}=401k rollover after moving to Canada`. Add a **CTA URL button** "View reply" → `https://community.example.com/t/{{1}}` (button variable) rather than a raw link in the body.

   **`weekly_digest` — category MARKETING, language `en`:**

> **US corridor warning:** marketing templates **cannot be delivered to US (+1) numbers** (Meta pause since 1 Apr 2025, still active — sends fail with error 131049). `weekly_digest` works for CA/UK/AE/AU/SG corridors only; for US members use email or the free 24-hour service window.
   ```
   Namaste {{1}}! Your DesiSquare weekly digest: this week's top
   discussion in the {{2}} community was "{{3}}", plus {{4}} new posts
   in the spaces you follow. Educational content only — not investment
   advice. Reply STOP to unsubscribe from the digest.
   ```
   Samples: `{{1}}=quiet_lotus`, `{{2}}=US`, `{{3}}=Roth vs Traditional for H-1B holders`, `{{4}}=12`.

6. Send an approved template exactly like Step 4.1, adding `components` for the body parameters:
   ```json
   "template": {
     "name": "reply_alert",
     "language": { "code": "en" },
     "components": [{
       "type": "body",
       "parameters": [
         { "type": "text", "text": "quiet_lotus" },
         { "type": "text", "text": "401k rollover after moving to Canada" }
       ]
     }]
   }
   ```

**✅ Checkpoint 6:** Both templates show **Approved** in WhatsApp Manager; a `reply_alert` send to a verified tester lands with variables filled; sending with a wrong parameter count fails with error **132000** (parameter count mismatch — proves your error handling path).

---

## 7. Opt-in capture and consent storage (constraint #5)

**Meta's opt-in rules** (Business Messaging / getting-opt-in policy): you must obtain prior permission before sending business-initiated messages; the opt-in must **clearly name the business ("DesiSquare")** and state the person is agreeing to receive WhatsApp messages from it; consent must be an affirmative action — **no pre-checked boxes**, no bundled/implied consent; you must honor opt-outs (on or off WhatsApp) and provide clear opt-out instructions per message category. Since the Nov 2024 Business Messaging Policy update, the opt-in **need not be WhatsApp-specific** — a general affirmative opt-in to receive messages from DesiSquare, collected on any channel, satisfies Meta's requirement (any-channel collection was already permitted before). Local law (India DPDP/TRAI; TCPA for US numbers) still applies on top, and DesiSquare keeps its explicit per-channel WhatsApp consent anyway (#5) — stricter than Meta's floor.

**DesiSquare implementation:**

1. Discourse → **Admin → Customize → User Fields** (or a plugin-managed custom field): store
   - `dsq_wa_optin` (`true/false`, default **false**),
   - `dsq_wa_optin_scope` (`alerts`, `digest`, `mirror` — independent toggles),
   - `dsq_wa_number_e164` (server-side only; **never rendered in any template, serializer, or public API response**),
   - `dsq_wa_optin_ts` (audit timestamp).
2. UI: an **unchecked** checkbox in preferences: "Send me WhatsApp notifications from **DesiSquare** at the number below. Msg rates may apply. Reply STOP anytime." Number entry → validated to E.164 → confirmed by a one-time template ping.
3. **STOP handling in wa-bridge:** inbound text matching `^(stop|unsubscribe)$` (case-insensitive) → set `dsq_wa_optin=false` for all scopes, reply (free-form, inside the service window the STOP itself opened): "You're unsubscribed from DesiSquare WhatsApp messages. You can re-enable them in your profile settings." All outbound jobs (`reply_alert`, `weekly_digest`) check `dsq_wa_optin` at send time, not at enqueue time.
4. **Consent-off behavior for mirroring:** wa-bridge resolves inbound `from` (wa_id) against `dsq_wa_number_e164` of members with `dsq_wa_optin_scope` including `mirror`. **No match, or consent revoked → the message is dropped (logged as a hashed wa_id counter only), never posted, never queued.** Matched messages post under the member's pseudonym; the phone number appears nowhere in Discourse content, titles, or search.

**✅ Checkpoint 7:** A tester with `mirror` consent sees their WhatsApp message appear as a forum post under their pseudonym in <60 s; the same message from a non-consented number produces only a dropped-message counter; texting STOP flips `dsq_wa_optin=false` and subsequent `reply_alert` jobs skip that user.

---

## 8. Group-message mirroring — the honest reality for the demo

**There is no official API access to consumer WhatsApp groups. Full stop.** The Cloud API cannot join, read, or mirror ordinary member-created WhatsApp groups. The 2025-launched **Groups API** is not that either: it creates **business-managed** groups capped at **8 members** (by design, up to 10,000 groups per number), joinable by invite link only, gated on an **Official Business Account (OBA)** — which an unverified demo cannot get — and it does not touch pre-existing consumer groups. Unofficial libraries (whatsapp-web.js, Baileys, etc.) are **banned** for this project: ToS violation, near-certain number ban, and no audit story.

**wa-bridge demo modes (pick per demo scene):**

1. **Forward-to-bridge (real traffic):** the DesiSquare business (test) number is a 1:1 endpoint. Consented members **forward or send** interesting group messages to it; wa-bridge receives them as ordinary inbound `text` messages (Step 5.6) and mirrors them to the forum under the sender's pseudonym. This is exactly the consent model constraint #5 wants — only the consenting member's own submission is mirrored, never third parties' group chatter.
2. **Simulated injection (scripted demo):** a local script POSTs synthetic inbound payloads (Step 5.6 shape) to `127.0.0.1:8787` with a correctly computed `X-Hub-Signature-256` over the body using `WA_APP_SECRET`, using wa_ids of consented demo users. Same code path, deterministic demo, no phone juggling. Label it clearly in demo notes as simulated.
3. **Later (production, post-verification + OBA):** optionally run DesiSquare-operated 8-member "maven circles" via the official Groups API — a different product surface than mirroring consumer groups, and it should be positioned as such.

**✅ Checkpoint 8:** Mode 1 and mode 2 both land forum posts through the identical wa-bridge ingest path; the demo script/readme states plainly that consumer-group reading is not possible via official APIs.

---

## 9. Limits, pricing, and the demo → production path

**Limits (demo):**
- **Test number:** unlimited messages, but only to the **≤5 verified recipients**; anything else → error **131030**.
- **Real number, business unverified:** **250 business-initiated conversations / rolling 24 h** (portfolio-level since Oct 2025). User-initiated replies within the service window are not capped by this.
- **Cloud API throughput** (not a demo concern): default 80 messages/sec per number, auto-scaling higher.

**Pricing (since 1 July 2025 — per-message pricing, PMP):**
- Billing switched from per-conversation to **per delivered template message**, priced by **category (marketing / utility / authentication) and recipient country**.
- **Free:** all free-form messages inside the 24 h customer-service window, and — key change — **utility templates delivered inside an open service window**. So `reply_alert` sent while the member's window is open costs nothing.
- **Paid:** marketing templates always (e.g. `weekly_digest`); utility/auth templates outside a window (volume-tiered rates).
- Test-number traffic to the 5 recipients doesn't require a payment method; add a card to the portfolio before using a real number at scale.

**Demo → production checklist:**
1. Complete **business verification** (Security Center) → unlocks Tier 1 (1,000 unique customers/24 h; auto-scales 1k → 10k → 100k → unlimited with ≥50% utilization over 7 days and good quality rating).
2. Register a **real phone number** (SMS/voice OTP; must not be an active consumer/Business-app WhatsApp number) and submit the **display name** ("DesiSquare") for approval.
3. Add a **payment method**; monitor **quality rating** in WhatsApp Manager (too many user blocks/reports → limit downgrade).
4. Rotate to production system-user token; re-point webhooks; keep `WA_GRAPH_VERSION` pinned and review Meta's changelog before bumping (versions live ~2 years).
5. (Optional) pursue **OBA** if the maven-circles Groups API idea graduates.

---

## 10. Troubleshooting

| Symptom / code | Meaning (verified current) | Fix |
|---|---|---|
| Dashboard: "Callback URL couldn't be verified" | GET handshake failed: wrong `WA_VERIFY_TOKEN`, body not the raw `hub.challenge`, non-200, or TLS/proxy issue | Echo `hub.challenge` verbatim as plain text with 200; confirm Caddy route with `curl "https://community.example.com/wa-bridge/webhook?hub.mode=subscribe&hub.verify_token=$WA_VERIFY_TOKEN&hub.challenge=1234"` → body `1234`; valid CA cert required |
| Webhook verified but no POSTs arrive | App not subscribed to the WABA / `messages` field unticked | Tick `messages` in App Dashboard → WhatsApp → Configuration; `POST /{WABA_ID}/subscribed_apps`; check `GET /{WABA_ID}/subscribed_apps` |
| All webhook POSTs rejected 403 by wa-bridge | HMAC computed over re-serialized JSON, not raw bytes; or wrong `WA_APP_SECRET` | Hash the raw request body; copy App secret from App settings → Basic |
| **131030** | Recipient not in the test number's allowed list | Add + verify the recipient (max 5) in API Setup, or move to a real registered number |
| **131047** | Re-engagement: >24 h since user's last inbound message — free-form send blocked | Send an approved **template** instead; free-form only inside the service window |
| **131026** | Message undeliverable: recipient has no WhatsApp, hasn't accepted new ToS, or Meta withheld delivery (common for marketing, per engagement/policy signals) | Verify recipient is on WhatsApp; for marketing sends treat as a signal to reduce frequency |
| **131049** / 131050 | Two causes: (a) **ALL marketing templates to US (+1) numbers are paused by Meta since 1 Apr 2025 — still in force; every US-bound marketing send returns 131049**; (b) per-user marketing frequency caps / user opted out | For US-corridor members deliver digests via email or free-form inside an open 24h service window; elsewhere back off and honor opt-outs |
| **131051** | Unsupported message type | Send a supported type; wa-bridge should ignore unsupported inbound types gracefully, still 200 |
| **132000** | Template parameter count/format mismatch | `components.parameters` must match the approved placeholder count exactly |
| **132001** | Template does not exist (name or language mismatch) | Template must be **Approved**, exact `name`, exact `language.code` (`en` ≠ `en_US`) |
| **190** (OAuth) | Access token expired/invalidated — classic 24 h temporary-token death | Use the system-user permanent token (Step 3.2); after password/secret rotation, regenerate |
| Template rejected | Category mismatch (promo content in Utility), variable at start/end, adjacent variables, missing samples, policy content | Fix per Step 6.3; resubmit or appeal in WhatsApp Manager; genuinely transactional wording for Utility |
| Messages accepted (`wamid` returned) but never arrive | Delivery ≠ acceptance; check webhook `statuses` (sent/delivered/failed with error object) | Subscribe to `messages` field and log `statuses[].errors[]` for the real cause |
| 250-conversation ceiling hit on a real number | Business unverified | Complete business verification → Tier 1 (1,000) |

---

## Sources (official)

- Get started (test number, 5 recipients, first curl): https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- Access tokens (temporary vs system-user): https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/
- Webhooks setup & signature validation: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks (and Graph webhooks security: https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- Messaging limits: https://developers.facebook.com/docs/whatsapp/messaging-limits/
- Pricing (per-message, July 2025): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Template fundamentals & categorization: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview , https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- Opt-in policy: https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in
- Groups API (8-member, OBA-gated): https://developers.facebook.com/documentation/business-messaging/whatsapp/groups
- Error codes: https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes
- Graph API v25.0 announcement (Feb 2026): https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/
