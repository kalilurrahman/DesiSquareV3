// Small HTTP helpers. Zero dependencies.
import { randomBytes, timingSafeEqual, createHmac, scryptSync } from 'node:crypto';

// A client-fault error the dispatcher turns into its `status` instead of a generic 500.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(data);
}

export function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'request body must be valid JSON');
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const key = part.slice(0, i).trim();
    const raw = part.slice(i + 1).trim();
    // A malformed value on ANY cookie (a bare '%', a truncated escape) must not take down
    // the request — a stray cookie set by another localhost app would otherwise 500 us.
    try { out[key] = decodeURIComponent(raw); } catch { out[key] = raw; }
  }
  return out;
}

export function newToken() {
  return randomBytes(24).toString('hex');
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function hmacSha256Hex(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Password storage for open-registration accounts (non-negotiable: never plaintext).
// scrypt via node:crypto — a per-user random salt, format `scrypt$<salt>$<hash>`. Demo
// personas have no passwordHash and remain selectable via the mode:'demo' path only.
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Phone-shaped patterns. Used defensively: the prototype refuses to persist or emit anything
// that looks like a phone number on member-facing surfaces (non-negotiable #1). Two vectors:
//   (a) separator-formatted / international forms with parens, dashes, spaces, dots
//   (b) a bare run of 10 to 15 digits
// Deliberately broad. Short digit groups (years, "401k", a $182,400 amount → six digits) don't
// match; the rare false positive on a 10-plus-digit price is an acceptable trade for zero leaks.
export const PHONE_PATTERN = /\+?\d[\d\s().-]{8,}\d/;
const BARE_DIGITS = /\b\d{10,15}\b/;

export function stripPhoneNumbers(text) {
  return String(text ?? '')
    .replace(new RegExp(PHONE_PATTERN, 'g'), '[number removed]')
    .replace(new RegExp(BARE_DIGITS, 'g'), '[number removed]');
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function timeAgo(ts, nowMs = Date.now()) {
  const mins = Math.max(0, Math.round((nowMs - ts) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
