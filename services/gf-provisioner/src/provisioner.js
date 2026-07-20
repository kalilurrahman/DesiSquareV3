// Core provisioning logic (pure, dependency-injected for testability).
import crypto from 'node:crypto';

// Create/link a Ghostfolio account for a verified Discourse user. Idempotent by userId + email.
export async function provision(user, { store, ghostfolio, config, log = console.log }) {
  if (!user?.userId || !user.email) return { status: 'bad_user' };
  if (!user.emailVerified) return { status: 'skipped_unverified' };

  const existing = store.getByUserId(user.userId);
  if (existing?.ghostfolioAccountId) return { status: 'already_linked', accountId: existing.ghostfolioAccountId };

  const byEmail = store.getByEmail(user.email);
  if (byEmail?.ghostfolioAccountId) {
    store.link({ userId: user.userId, username: user.username, email: user.email, ghostfolioAccountId: byEmail.ghostfolioAccountId, tokenRef: byEmail.tokenRef });
    return { status: 'linked_existing', accountId: byEmail.ghostfolioAccountId };
  }

  const { accountId, tokenRef } = await ghostfolio.createOrLink({ email: user.email, username: user.username });
  store.link({ userId: user.userId, username: user.username, email: user.email, ghostfolioAccountId: accountId, tokenRef });
  log(`  provisioned Ghostfolio ${accountId} for @${user.username} (${config.mode})`);
  return { status: 'provisioned', accountId };
}

// Portfolio summary for the profile card (theme calls this). DS-075: summaries are private
// by default — a public viewer only gets data after the member opts in via /visibility.
export async function portfolioSummary(userId, { store, ghostfolio, viewer } = {}) {
  const link = store.getByUserId(userId);
  if (!link) return { status: 'not_provisioned' };
  if (viewer === 'public' && !link.publicSummary) {
    return { status: 'private', username: link.username };
  }
  const summary = await ghostfolio.getSummary(link.ghostfolioAccountId, link.tokenRef);
  return { status: 'ok', username: link.username, publicSummary: !!link.publicSummary, ...summary };
}

// Single-click SSO login link: a short-lived HMAC token that points back at OUR /sso/click
// endpoint. The token carries only the (non-secret) Ghostfolio account id + expiry; the actual
// security-token→JWT exchange happens server-side at click time, so nothing sensitive is ever
// exposed in the URL or the browser.
export function mintSsoLink(userId, { store, config }) {
  const link = store.getByUserId(userId);
  if (!link) return null;
  const exp = Math.floor(Date.now() / 1000) + config.sso.ttl;
  const payload = `${link.ghostfolioAccountId}.${exp}`;
  const sig = crypto.createHmac('sha256', config.sso.secret).update(payload).digest('hex').slice(0, 32);
  const token = Buffer.from(`${payload}.${sig}`).toString('base64url');
  const base = config.publicUrl || `http://localhost:${config.port || 8789}`;
  return { token, url: `${base}/sso/click?sso=${token}`, expiresAt: new Date(exp * 1000).toISOString() };
}

// Exchange-at-click middleware: verify the SSO token, look the account up, swap its stored security
// token for a fresh Ghostfolio JWT, and hand back Ghostfolio's OAuth-callback URL (/{lang}/auth/:jwt)
// that logs the user in. Returns { ok:false, reason } for a bad/expired/unknown token.
export async function ssoRedirect(token, { store, ghostfolio, config }) {
  if (!token) return { ok: false, reason: 'missing_token' };
  const v = verifySso(token, config);
  if (!v.valid) return { ok: false, reason: v.reason };
  const link = store.getByAccountId(v.accountId);
  if (!link) return { ok: false, reason: 'not_provisioned' };
  const { jwt, mock } = await ghostfolio.ssoLogin(link.tokenRef);
  const lang = config.ghostfolio.lang || 'en';
  return {
    ok: true, mock: !!mock,
    accountId: v.accountId, username: link.username,
    redirectTo: `${config.ghostfolio.url}/${lang}/auth/${jwt}`,
  };
}

// Verify an SSO token (what the Ghostfolio side / a middleware would run).
export function verifySso(token, config) {
  try {
    const [accountId, exp, sig] = Buffer.from(token, 'base64url').toString().split('.');
    const expected = crypto.createHmac('sha256', config.sso.secret).update(`${accountId}.${exp}`).digest('hex').slice(0, 32);
    if (sig !== expected) return { valid: false, reason: 'bad_sig' };
    if (Number(exp) < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' };
    return { valid: true, accountId };
  } catch { return { valid: false, reason: 'malformed' }; }
}
