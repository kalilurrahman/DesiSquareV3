# DesiSquare — WhatsApp Cloud API setup (bidirectional, production path)

Goal: a member messages the DesiSquare WhatsApp number → the message appears as a topic in Discourse ("WhatsApp Intake" category) → community/staff reply in Discourse → the reply reaches the member on WhatsApp. All via the official **Meta Cloud API** (the On-Premises API was retired Oct 2025; unofficial WhatsApp Web bridges are ToS-violating — don't use them).

Platform rules the bridge already enforces:

- **24-hour window:** free-form replies only within 24h of the member's last inbound message; outside it the bridge sends the approved `community_reply` **template**.
- **Idempotency:** Meta delivers at least once; the bridge dedupes on `wamid`.
- **Signature verification:** every webhook POST is HMAC-verified (`X-Hub-Signature-256`, raw body, app secret).
- **Opt-out:** STOP/UNSUBSCRIBE/CANCEL suppresses outbound until the member messages again.
- **Pricing:** per delivered template message by category and country (since Jul 2025). In-window free-form service replies are free — the bridge prefers them. Groups API is not viable for large communities (single-digit participant cap); the 1:1 intake number + portal-as-hub model here is the right shape.

## Part 1 — Meta app + test number (Day 3, ~30 min, free)

1. `developers.facebook.com/apps` → **Create app** → use case "Connect with customers through WhatsApp". Attach your Business portfolio (create one at `business.facebook.com` first — and **start Business Verification in Security Center on Day 0**; it can take days to weeks and gates production).
2. Left menu **WhatsApp → Set up**: Meta auto-creates a **test WABA**, **test number**, and the pre-approved `hello_world` template.
3. From **WhatsApp → API setup** collect into `/opt/desisquare/.env`:

   | Value | .env key |
   |---|---|
   | Phone number ID (test) | `PHONE_NUMBER_ID_COMMUNITY` |
   | WABA ID | `WABA_ID` |
   | Temporary access token (24h) | `META_SYSTEM_USER_TOKEN` |
   | App ID / App secret (App settings → Basic) | `META_APP_ID` / `META_APP_SECRET` |

4. In **API setup → To**, add your own phone as a test recipient (max 5) and verify the code.

## Part 2 — Prove outbound (2 min)

```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"<YOUR_NUMBER_E164>","type":"template",
       "template":{"name":"hello_world","language":{"code":"en_US"}}}'
```

You get "Hello World" on your phone → outbound works.

## Part 3 — Wire the inbound webhook (10 min)

No ngrok needed — the bridge is already public at `https://wa.<domain>` behind Caddy.

1. Confirm `WEBHOOK_VERIFY_TOKEN` is set in `/opt/desisquare/.env` and the stack is up (`sudo docker compose up -d wa-bridge`).
2. App Dashboard → **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://wa.<domain>/webhooks/whatsapp`
   - Verify token: the `WEBHOOK_VERIFY_TOKEN` value
   - **Verify and save** (Meta calls the GET handshake; the bridge echoes `hub.challenge`).
3. Click **Manage** → subscribe to the **`messages`** field (covers inbound + delivery statuses). Optionally `message_template_status_update` for template-approval callbacks.

## Part 4 — Prove the full loop (5 min)

1. Reply to the hello-world conversation from your phone. Watch `sudo docker compose logs -f wa-bridge` — the message lands and a topic appears in Discourse under **WhatsApp Intake** (number shown as `member-XXXX`).
2. Reply to that topic in Discourse (as any user other than `system`). The bridge's Discourse webhook fires and your phone receives the reply. **Bidirectional loop proven.**

Discourse side (one-time): create category "WhatsApp Intake" (note its numeric id → `DISCOURSE_WA_CATEGORY_ID`); Admin → API → New API Key (user `system`, global) → `DISCOURSE_API_KEY`; Admin → API → Webhooks → new webhook to `https://wa.<domain>/webhooks/discourse`, event **Post is created**, secret = `DISCOURSE_WEBHOOK_SECRET`.

## Part 5 — Production checklist (Week 2-3, gated on Meta verification)

1. **Business Verification** approved (started Day 0).
2. **Real business number:** WhatsApp → API setup → Add phone number (must not be registered on the consumer WhatsApp app); set display name ("DesiSquare" — Meta reviews it).
3. **Permanent token:** Business settings → System users → create → assign app + WABA → generate token with `whatsapp_business_messaging` + `whatsapp_business_management`. Store in Secret Manager: `gcloud secrets create meta-system-user-token --data-file=-`; replace the 24h temp token in `.env`.
4. **Submit templates** from `message-templates.json` (WhatsApp → Manage templates) and wait for approval.
5. **Advanced Access** for WhatsApp permissions (App Review) so non-test numbers can be messaged; messaging limits then rise in tiers as quality stays green.
6. Point the production WABA webhook at `https://wa.<domain>/webhooks/whatsapp`; keep dev/prod credentials separate.
7. Publish the number: "WhatsApp us" link `https://wa.me/<number>?text=Hi%20DesiSquare` on the site.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Webhook won't verify | `WEBHOOK_VERIFY_TOKEN` mismatch, or stack not up / DNS for `wa.` not propagated |
| No inbound webhooks | `messages` field not subscribed |
| Outbound 401/190 | Temp token expired (24h) — regenerate or move to system-user token |
| Error 131047 "re-engagement" | 24h window closed — template required (bridge does this; check template is APPROVED) |
| Signature check fails | Wrong `META_APP_SECRET`, or a proxy re-serialized the body (Caddy config here passes it through untouched) |
| "Recipient not in allowed list" | On the test number, add + verify the recipient (max 5) |
