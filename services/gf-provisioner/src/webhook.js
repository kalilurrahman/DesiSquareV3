import crypto from 'node:crypto';

export function verifySignature(raw, sig, secret) {
  if (!secret) return true; // stub: allow when unset (dev only)
  if (!sig) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Extract the user from a Discourse user webhook. Treat user_confirmed_email (or active user) as verified.
export function extractUser(headers, payload) {
  const event = headers['x-discourse-event'] || headers['x-discourse-event-type'] || '';
  const u = payload?.user || {};
  const emailVerified = event.includes('confirmed_email') || u.active === true || payload?.email_verified === true;
  return { userId: u.id, username: u.username, email: u.email, emailVerified, event };
}
