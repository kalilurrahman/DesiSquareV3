import crypto from 'node:crypto';

// Best-effort E.164 normalisation. For the stub; production should use libphonenumber.
export function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d+]/g, '');
  if (!s) return null;
  if (!s.startsWith('+')) s = '+' + s.replace(/^0+/, '');
  return s.length >= 8 ? s : null;
}

// Never log raw phone numbers — log a salted hash instead.
export function hashPhone(phone, salt) {
  return crypto.createHash('sha256').update(String(salt) + '|' + String(phone)).digest('hex').slice(0, 12);
}
