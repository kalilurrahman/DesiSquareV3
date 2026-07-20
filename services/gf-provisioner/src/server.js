// DesiSquare Ghostfolio provisioner — zero-dependency HTTP server (node:http).
//   GET  /health                       status + mode + linked accounts
//   POST /discourse/webhook            user_created/user_confirmed_email -> provision (HMAC)
//   GET  /portfolio/:userId/summary    portfolio summary for the profile card
//   GET  /sso/:userId                  mint a single-click Ghostfolio deep-link
//   POST /provision                    DEV: provision directly { userId, username, email }
import http from 'node:http';
import { config } from './config.js';
import { Store } from './store.js';
import { Ghostfolio } from './ghostfolio.js';
import { provision, portfolioSummary, mintSsoLink, ssoRedirect } from './provisioner.js';
import { verifySignature, extractUser } from './webhook.js';

const store = new Store(config.paths.state);
const ghostfolio = new Ghostfolio(config);

function readBody(req) { return new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); }); }
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', ...CORS }); res.end(JSON.stringify(obj, null, 2)); }

// Friendly page shown when an SSO login link is bad/expired (links are short-lived by design).
function ssoErrorPage(reason, config) {
  const msg = {
    expired: 'This login link has expired. Head back to DesiSquare and open your portfolio again.',
    bad_sig: 'This login link is invalid.',
    malformed: 'This login link is invalid.',
    not_provisioned: 'No portfolio is linked to this account yet.',
    missing_token: 'This login link is incomplete.',
  }[reason] || 'This login link could not be used.';
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DesiSquare · Portfolio sign-in</title>
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:28rem;margin:14vh auto;padding:0 1.25rem;text-align:center;color:#16223C">
  <div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">DesiSquare</div>
  <p style="margin:1rem 0;color:#475569;line-height:1.5">${msg}</p>
  <a href="${config.ghostfolio.url}" style="display:inline-block;margin-top:.5rem;padding:.6rem 1.1rem;background:#FF6A2C;color:#fff;border-radius:.5rem;text-decoration:none;font-weight:600">Open Ghostfolio</a>
</div>`;
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const parts = pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (req.method === 'GET' && pathname === '/health') {
      return json(res, 200, { ok: true, service: 'gf-provisioner', mode: config.mode, linked: store.count() });
    }
    if (req.method === 'POST' && pathname === '/discourse/webhook') {
      const raw = await readBody(req);
      if (!verifySignature(raw, req.headers['x-discourse-event-signature'], config.webhookSecret)) return json(res, 401, { error: 'bad signature' });
      const user = extractUser(req.headers, JSON.parse(raw || '{}'));
      return json(res, 200, await provision(user, { store, ghostfolio, config }));
    }
    if (req.method === 'POST' && pathname === '/provision') {
      const b = JSON.parse((await readBody(req)) || '{}');
      return json(res, 200, await provision({ ...b, emailVerified: b.emailVerified !== false }, { store, ghostfolio, config }));
    }
    // GET /portfolio/:userId/summary[?viewer=public]  — DS-075: private by default for public viewers
    if (req.method === 'GET' && parts[0] === 'portfolio' && parts[2] === 'summary') {
      const viewer = new URL(req.url, 'http://localhost').searchParams.get('viewer') || 'owner';
      return json(res, 200, await portfolioSummary(parts[1], { store, ghostfolio, viewer }));
    }
    // POST /portfolio/:userId/visibility { public: bool }  — member opt-in/out of the public summary
    if (req.method === 'POST' && parts[0] === 'portfolio' && parts[2] === 'visibility') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const l = store.setVisibility(parts[1], b.public === true);
      return l ? json(res, 200, { status: 'ok', userId: parts[1], publicSummary: l.publicSummary })
               : json(res, 404, { status: 'not_provisioned' });
    }
    // GET /sso/click?sso=<token>  — verify token, exchange for a JWT, redirect into Ghostfolio (single-click login)
    if (req.method === 'GET' && pathname === '/sso/click') {
      const token = new URL(req.url, 'http://localhost').searchParams.get('sso');
      const result = await ssoRedirect(token, { store, ghostfolio, config });
      if (result.ok) { res.writeHead(302, { Location: result.redirectTo }); return res.end(); }
      const code = result.reason === 'expired' ? 410 : result.reason === 'not_provisioned' ? 404 : 401;
      res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(ssoErrorPage(result.reason, config));
    }
    // GET /sso/:userId  — mint a single-click login link for a provisioned user
    if (req.method === 'GET' && parts[0] === 'sso' && parts[1]) {
      const link = mintSsoLink(parts[1], { store, config });
      return link ? json(res, 200, link) : json(res, 404, { error: 'not_provisioned' });
    }
    return json(res, 404, { error: 'not found', path: pathname });
  } catch (e) { return json(res, 500, { error: e.message }); }
});

server.listen(config.port, () => {
  console.log(`DesiSquare gf-provisioner on http://localhost:${config.port}  [mode: ${config.mode}]`);
  if (!config.webhookSecret) console.log('  ⚠ DISCOURSE_WEBHOOK_SECRET unset — webhook signature check DISABLED (dev only).');
});

export { server, store };
