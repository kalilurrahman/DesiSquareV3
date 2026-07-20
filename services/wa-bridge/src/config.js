// Config + minimal .env loader (no dotenv dependency), mirrors the ai-service pattern.
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

const allowed = (process.env.ALLOWED_GROUPS || '').split(',').map((s) => s.trim()).filter(Boolean);

export const ROOT_DIR = ROOT;
export const config = {
  port: Number(process.env.PORT) || 8788,
  mode: process.env.DISCOURSE_API_KEY ? 'live' : 'mock',
  discourse: {
    url: (process.env.DISCOURSE_URL || 'http://localhost:8080').replace(/\/$/, ''),
    apiKey: process.env.DISCOURSE_API_KEY || '',
    apiUsername: process.env.DISCOURSE_API_USERNAME || 'system',
    mirrorCategory: process.env.MIRROR_CATEGORY || 'ask-the-community',
    guestUsername: process.env.GUEST_USERNAME || 'system',
  },
  allowedGroups: allowed, // empty => allow all (dev only)
  wa: {
    // Inbound backend: 'mock' (default, offline) or 'whatsapp-web.js' (real, QR-paired, unofficial).
    backend: (process.env.WA_BACKEND || 'mock').toLowerCase(),
    sessionPath: path.join(ROOT, 'data', 'wa-session'), // gitignored (services/*/data/)
    clientId: process.env.WA_CLIENT_ID || 'desisquare',
  },
  cloudApi: {
    token: process.env.WA_CLOUD_TOKEN || '',
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID || '',
    template: process.env.WA_TEMPLATE_NAME || 'desisquare_notification',
  },
  webhookSecret: process.env.DISCOURSE_WEBHOOK_SECRET || '',
  // B6: Slack-compatible webhook for bridge incidents (empty => log-only).
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || '',
  phoneHashSalt: process.env.PHONE_HASH_SALT || 'change-me',
  paths: { state: path.join(ROOT, 'data', 'state.json') },
};
