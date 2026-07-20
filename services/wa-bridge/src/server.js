// DesiSquare WhatsApp bridge — zero-dependency HTTP server (node:http).
//   GET  /health                    status + mode + connection + mapped users
//   GET  /session                   WhatsApp connection state (stub QR seam)
//   POST /map                       { phone, username, userId? }  link a phone to a member (admin)
//   POST /optout                    { phone }                     stop mirroring/notifying a member
//   POST /simulate/message          { id, groupJid, phone, text } DEV: inject an inbound group msg
//   POST /discourse/notify-webhook  Discourse notification_created -> WhatsApp notification (HMAC)
import http from 'node:http';
import crypto from 'node:crypto';
import { config } from './config.js';
import { Store } from './store.js';
import { Discourse } from './discourse.js';
import { CloudApi } from './cloud-api.js';
import { createWaClient } from './wa-client.js';
import { Alerts } from './alerts.js';
import { handleInbound, notify } from './bridge.js';
import { normalizePhone } from './util.js';

const store = new Store(config.paths.state);
const discourse = new Discourse(config);
const cloudApi = new CloudApi(config);
const wa = await createWaClient(config); // mock by default; whatsapp-web.js when WA_BACKEND set
const alerts = new Alerts({ webhookUrl: config.alertWebhookUrl, service: 'wa-bridge' });

// Wire the WhatsApp client's messages into the inbound pipeline.
wa.on('message', (msg) => handleInbound(msg, { store, discourse, config }).catch((e) => console.error('inbound error', e.message)));
// B6/DS-047: disconnects + auth failures page the admin channel; reconnects clear the incident.
wa.on('disconnected', (reason) => alerts.fire('bridge_disconnected', `WhatsApp session dropped: ${reason || 'unknown'}. Messages are NOT mirroring.`, 'critical'));
wa.on('auth_failure', (msg) => alerts.fire('bridge_auth_failure', `Pairing/auth failed: ${msg || 'unknown'}. Re-scan the QR.`, 'critical'));
wa.on('ready', () => alerts.fire('bridge_connected', 'WhatsApp session connected — mirroring active.', 'info'));

function readBody(req) {
  return new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d)); });
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', ...CORS }); res.end(JSON.stringify(obj, null, 2)); }

function verifyWebhook(raw, sig) {
  if (!config.webhookSecret) return true; // stub: allow when unset (dev only)
  if (!sig) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', config.webhookSecret).update(raw).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (req.method === 'GET' && pathname === '/health') {
      return json(res, 200, { ok: true, service: 'wa-bridge', mode: config.mode, wa: wa.getState(), mappedUsers: store.mappedCount(), allowedGroups: config.allowedGroups.length || 'all(dev)', recentAlerts: alerts.recent.slice(-5) });
    }
    if (req.method === 'GET' && pathname === '/session') {
      const state = wa.getState();
      const note = state.backend === 'mock'
        ? 'MOCK client. Set WA_BACKEND=whatsapp-web.js (+ npm run install:wa) for real pairing/QR.'
        : (state.connected ? 'Paired and connected.' : 'Awaiting pairing — scan the QR shown in the wa-bridge console (also in the qr field).');
      return json(res, 200, { ...state, note });
    }
    if (req.method === 'POST' && pathname === '/map') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const phone = normalizePhone(b.phone);
      if (!phone || !b.username) return json(res, 400, { error: 'phone and username required' });
      store.mapPhone(phone, b.username, b.userId);
      return json(res, 200, { status: 'mapped', username: b.username }); // never echo the phone
    }
    if (req.method === 'POST' && pathname === '/optout') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const phone = normalizePhone(b.phone);
      return json(res, 200, { status: phone && store.optOut(phone) ? 'opted_out' : 'not_found' });
    }
    // DEV: simulate a lifecycle event so alerting (B6) can be exercised offline.
    if (req.method === 'POST' && pathname === '/simulate/lifecycle') {
      const b = JSON.parse((await readBody(req)) || '{}');
      if (!wa.simulateLifecycle) return json(res, 400, { error: 'live backend — lifecycle comes from WhatsApp itself' });
      if (!['disconnected', 'auth_failure', 'ready'].includes(b.event)) return json(res, 400, { error: "event must be disconnected|auth_failure|ready" });
      wa.simulateLifecycle(b.event, b.detail || 'simulated');
      return json(res, 200, { status: 'simulated', event: b.event, recentAlerts: alerts.recent.slice(-3) });
    }
    if (req.method === 'POST' && pathname === '/simulate/message') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const msg = { id: b.id || `sim_${Date.now()}`, groupJid: b.groupJid || 'dev-group', phone: b.phone, text: b.text };
      const result = await handleInbound(msg, { store, discourse, config });
      return json(res, 200, result);
    }
    if (req.method === 'POST' && pathname === '/discourse/notify-webhook') {
      const raw = await readBody(req);
      if (!verifyWebhook(raw, req.headers['x-discourse-event-signature'])) return json(res, 401, { error: 'bad signature' });
      const result = await notify(JSON.parse(raw || '{}'), { store, cloudApi, config });
      return json(res, 200, result);
    }
    return json(res, 404, { error: 'not found', path: pathname });
  } catch (e) { return json(res, 500, { error: e.message }); }
});

function listen() {
  server.listen(config.port, () => {
    console.log(`DesiSquare wa-bridge on http://localhost:${config.port}  [mode: ${config.mode}, wa: ${config.wa.backend}]`);
    if (!config.webhookSecret) console.log('  ⚠ DISCOURSE_WEBHOOK_SECRET unset — notify-webhook signature check DISABLED (dev only).');
  });
}
wa.connect().then(listen).catch((e) => {
  // Live backend failed to start (e.g. whatsapp-web.js not installed). Surface it clearly and keep
  // the HTTP server up so /health and /session still report the problem instead of crashing silently.
  console.error(`  ⚠ WhatsApp backend (${config.wa.backend}) failed to connect: ${e.message}`);
  listen();
});

export { server, store };
