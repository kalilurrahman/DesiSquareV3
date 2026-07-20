// ============================================================================
// DesiSquare WhatsApp <-> Discourse bridge
//  Inbound:  Meta webhook -> verify HMAC -> dedupe -> create/append Discourse
//            topic in the "WhatsApp Intake" category (number pseudonymized).
//  Outbound: Discourse post_created webhook (or POST /send) -> free-form reply
//            if the 24h service window is open, else approved template.
// ============================================================================
'use strict';
const express = require('express');
const crypto = require('crypto');
const { createClient } = require('redis');

const {
  PORT = 3000,
  META_GRAPH_API_VERSION = 'v21.0',
  META_APP_SECRET,
  META_SYSTEM_USER_TOKEN,
  PHONE_NUMBER_ID_COMMUNITY,
  WEBHOOK_VERIFY_TOKEN,
  WEBHOOK_PATH = '/webhooks/whatsapp',
  DISCOURSE_BASE_URL,
  DISCOURSE_API_KEY,
  DISCOURSE_API_USERNAME = 'system',
  DISCOURSE_WA_CATEGORY_ID,
  DISCOURSE_WEBHOOK_SECRET,
  BRIDGE_API_KEY,
  SERVICE_WINDOW_HOURS = '24',
  OPT_OUT_KEYWORDS = 'STOP,UNSUBSCRIBE,CANCEL',
  DEFAULT_TEMPLATE_LANGUAGE = 'en',
  REDIS_URL = 'redis://localhost:6379',
} = process.env;

const WINDOW_MS = Number(SERVICE_WINDOW_HOURS) * 3600 * 1000;
const OPT_OUT = OPT_OUT_KEYWORDS.split(',').map(s => s.trim().toUpperCase());
const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

const redis = createClient({ url: REDIS_URL });
redis.on('error', e => console.error('redis:', e.message));

const app = express();
// Keep raw bytes for HMAC verification (hash exactly what was received).
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

const hmacOk = (raw, header, secret) => {
  if (!raw || !header || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const mask = n => `member-${String(n).slice(-4)}`; // pseudonymize numbers

// --- health -----------------------------------------------------------------
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Meta webhook: GET verification handshake --------------------------------
app.get(WEBHOOK_PATH, (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

// --- Meta webhook: inbound messages / statuses -------------------------------
app.post(WEBHOOK_PATH, (req, res) => {
  if (!hmacOk(req.rawBody, req.headers['x-hub-signature-256'], META_APP_SECRET)) {
    return res.sendStatus(401);
  }
  res.sendStatus(200); // ACK fast; process async
  setImmediate(() => processInbound(req.body).catch(e => console.error('inbound:', e)));
});

async function processInbound(body) {
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      for (const s of v.statuses || []) console.log(`status ${s.id}: ${s.status}`);
      for (const msg of v.messages || []) {
        // Idempotency: providers deliver at least once — dedupe on wamid.
        const fresh = await redis.set(`wa:seen:${msg.id}`, '1', { NX: true, EX: 7 * 86400 });
        if (fresh !== 'OK') continue;
        const from = msg.from;
        await redis.set(`wa:lastin:${from}`, Date.now(), { PX: WINDOW_MS });
        const text = msg.type === 'text' ? (msg.text?.body || '') : `[${msg.type} message]`;

        if (OPT_OUT.includes(text.trim().toUpperCase())) {
          await redis.set(`wa:optout:${from}`, '1');
          await sendFreeForm(from, 'You are opted out. Message us anytime to opt back in.');
          continue;
        }
        await redis.del(`wa:optout:${from}`); // any inbound = renewed opt-in
        await postToDiscourse(from, text, msg.id);
      }
    }
  }
}

// --- Inbound -> Discourse ----------------------------------------------------
async function discourse(path, opts = {}) {
  const r = await fetch(`${DISCOURSE_BASE_URL}${path}`, {
    ...opts,
    headers: {
      'Api-Key': DISCOURSE_API_KEY,
      'Api-Username': DISCOURSE_API_USERNAME,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`discourse ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function postToDiscourse(from, text, wamid) {
  const topicId = await redis.get(`wa:topic:${from}`);
  const raw = `${text}\n\n<small>via WhatsApp · ${wamid}</small>`;
  if (topicId) {
    await discourse('/posts.json', {
      method: 'POST',
      body: JSON.stringify({ topic_id: Number(topicId), raw }),
    });
  } else {
    const title = `WhatsApp: ${mask(from)} — ${text.slice(0, 50) || 'new conversation'}`;
    const t = await discourse('/posts.json', {
      method: 'POST',
      body: JSON.stringify({ title, raw, category: Number(DISCOURSE_WA_CATEGORY_ID) }),
    });
    await redis.set(`wa:topic:${from}`, t.topic_id);
    await redis.set(`wa:msisdn:${t.topic_id}`, from);
  }
}

// --- Discourse webhook (post_created) -> outbound to member ------------------
app.post('/webhooks/discourse', (req, res) => {
  if (!hmacOk(req.rawBody, req.headers['x-discourse-event-signature'], DISCOURSE_WEBHOOK_SECRET)) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);
  if (req.headers['x-discourse-event'] !== 'post_created') return;
  setImmediate(() => relayReply(req.body?.post).catch(e => console.error('relay:', e)));
});

async function relayReply(post) {
  if (!post || post.username === DISCOURSE_API_USERNAME) return; // ignore our own posts
  const to = await redis.get(`wa:msisdn:${post.topic_id}`);
  if (!to) return; // not a WhatsApp-mapped topic
  const excerpt = String(post.raw || '').replace(/\s+/g, ' ').slice(0, 900);
  await sendToMember(to, post.topic_title || 'your DesiSquare thread', excerpt);
}

async function sendToMember(to, threadTitle, text) {
  if (await redis.get(`wa:optout:${to}`)) return console.log(`skip ${mask(to)}: opted out`);
  const windowOpen = Boolean(await redis.get(`wa:lastin:${to}`));
  if (windowOpen) return sendFreeForm(to, `Reply on "${threadTitle}":\n\n${text}`);
  return sendTemplate(to, 'community_reply', [threadTitle, text]); // outside 24h window
}

// --- Meta send helpers -------------------------------------------------------
async function metaSend(payload) {
  const r = await fetch(`${GRAPH}/${PHONE_NUMBER_ID_COMMUNITY}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_SYSTEM_USER_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`meta send: ${r.status} ${JSON.stringify(body)}`);
  return body;
}
const sendFreeForm = (to, text) => metaSend({ to, type: 'text', text: { body: text } });
const sendTemplate = (to, name, params) => metaSend({
  to, type: 'template',
  template: {
    name, language: { code: DEFAULT_TEMPLATE_LANGUAGE },
    components: [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) }],
  },
});

// --- Manual/ops send: POST /send {to, text} ---------------------------------
app.post('/send', async (req, res) => {
  if (req.headers['x-api-key'] !== BRIDGE_API_KEY) return res.sendStatus(401);
  try {
    const { to, text, threadTitle = 'DesiSquare' } = req.body || {};
    if (!to || !text) return res.status(400).json({ error: 'to and text required' });
    await sendToMember(to, threadTitle, text);
    res.json({ ok: true });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

redis.connect().then(() => {
  app.listen(PORT, () => console.log(`wa-bridge listening on :${PORT}`));
});
