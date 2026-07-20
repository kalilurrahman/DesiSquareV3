import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.join(ROOT, '.env'));

// Live mode talks to a real self-hosted Ghostfolio. Ghostfolio user creation is anonymous
// (no admin token needed), so the switch is an explicit GHOSTFOLIO_LIVE flag; an admin token,
// if provided, also implies live and is kept for future admin-scoped calls.
const ghostfolioLive = process.env.GHOSTFOLIO_LIVE === 'true' || !!process.env.GHOSTFOLIO_ADMIN_TOKEN;

const port = Number(process.env.PORT) || 8789;

export const config = {
  port,
  mode: ghostfolioLive ? 'live' : 'mock',
  // Public base URL of THIS provisioner — the SSO login link points back at our own /sso/click
  // endpoint so the token exchange happens server-side (the security token never reaches the browser).
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  ghostfolio: {
    url: (process.env.GHOSTFOLIO_URL || 'http://localhost:3333').replace(/\/$/, ''),
    adminToken: process.env.GHOSTFOLIO_ADMIN_TOKEN || '',
    live: ghostfolioLive,
    // Ghostfolio serves a per-language SPA; the OAuth-callback route is /{lang}/auth/:jwt.
    lang: process.env.GHOSTFOLIO_LANG || 'en',
  },
  webhookSecret: process.env.DISCOURSE_WEBHOOK_SECRET || '',
  sso: { secret: process.env.SSO_SECRET || 'change-me', ttl: Number(process.env.SSO_TTL_SECONDS) || 120 },
  paths: { state: path.join(ROOT, 'data', 'identity.json') },
};
