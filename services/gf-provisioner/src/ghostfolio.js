// Ghostfolio client behind a seam. Mock mode = deterministic fake account + summary so the
// pipeline runs offline. Live mode talks to a real self-hosted Ghostfolio (endpoints verified
// against v3.21.0):
//   POST /api/v1/user                 -> { accessToken, authToken, role }  (anonymous, no auth)
//   POST /api/v1/auth/anonymous       -> { authToken }  (exchange a stored security token for a JWT)
//   GET  /api/v1/user                 -> { id, settings.baseCurrency, ... }  (Bearer)
//   GET  /api/v1/portfolio/details    -> { summary.currentValueInBaseCurrency, holdings{...} }  (Bearer)
//   GET  /api/v2/portfolio/performance-> { performance.netPerformancePercentageWithCurrencyEffect }  (Bearer)
// Ghostfolio anonymous accounts carry no email — we create a fresh user and keep the
// email -> security-token mapping in our own store (dedup is enforced in provisioner.js).
import crypto from 'node:crypto';

const ASSET_CLASS_LABELS = {
  EQUITY: 'Equity',
  FIXED_INCOME: 'Fixed income',
  REAL_ESTATE: 'Real estate',
  COMMODITY: 'Commodity',
  LIQUIDITY: 'Cash',
  ALTERNATIVE_INVESTMENT: 'Alternative',
  CASH: 'Cash',
};
function labelizeAssetClass(cls) {
  if (ASSET_CLASS_LABELS[cls]) return ASSET_CLASS_LABELS[cls];
  return String(cls || 'Other').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export class Ghostfolio {
  constructor(config, log = console.log) { this.config = config; this.log = log; }

  get isLive() { return this.config.ghostfolio.live === true || !!this.config.ghostfolio.adminToken; }
  get base() { return this.config.ghostfolio.url; }

  async _request(method, path, { token, body } = {}) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) throw new Error(`Ghostfolio ${method} ${path} -> ${res.status}: ${json?.message || String(text).slice(0, 140)}`);
    return json;
  }

  // Exchange a stored per-user security token (accessToken) for a short-lived JWT.
  async _jwtFor(accessToken) {
    const { authToken } = await this._request('POST', '/api/v1/auth/anonymous', { body: { accessToken } });
    if (!authToken) throw new Error('Ghostfolio anonymous auth returned no authToken');
    return authToken;
  }

  // SSO exchange-at-click: turn the stored per-user security token into a fresh Ghostfolio JWT.
  // The middleware redirects the browser to Ghostfolio's own OAuth-callback route (/{lang}/auth/:jwt),
  // which persists the JWT client-side and lands the user on their dashboard — no Ghostfolio changes.
  async ssoLogin(tokenRef) {
    if (!this.isLive) return { jwt: `mock-jwt-${tokenRef}`, mock: true };
    if (!tokenRef) throw new Error('SSO login requires the stored per-user security token');
    return { jwt: await this._jwtFor(tokenRef) };
  }

  // Create or link a Ghostfolio account for a verified email. Idempotency is handled upstream
  // (provisioner.js dedups by userId + email), so this always mints a fresh anonymous user.
  async createOrLink({ email, username }) {
    if (!this.isLive) {
      const accountId = 'gf_' + crypto.createHash('sha1').update(email.toLowerCase()).digest('hex').slice(0, 16);
      this.log(`  [mock ghostfolio] created/linked account ${accountId} for @${username}`);
      return { accountId, tokenRef: `mock-token-${accountId}` };
    }
    const created = await this._request('POST', '/api/v1/user'); // { accessToken, authToken, role }
    if (!created.accessToken || !created.authToken) throw new Error('Ghostfolio user create returned no token (signup may be disabled)');
    const me = await this._request('GET', '/api/v1/user', { token: created.authToken }); // { id, ... }
    this.log(`  [ghostfolio] created user ${me.id} for @${username}`);
    return { accountId: me.id, tokenRef: created.accessToken };
  }

  // Portfolio summary for the profile card (value, currency, YTD performance, allocation).
  async getSummary(accountId, tokenRef) {
    if (!this.isLive) {
      const seed = parseInt(String(accountId).replace(/\D/g, '').slice(0, 6) || '1', 10);
      const value = 50000 + (seed % 200000);
      const perf = ((seed % 240) / 10 - 8).toFixed(1); // -8.0 .. +16.0 %
      return {
        mock: true,
        value, currency: 'USD',
        performanceYtdPct: Number(perf),
        allocation: [
          { label: 'Equity', pct: 62 }, { label: 'Funds', pct: 24 },
          { label: 'Real estate', pct: 10 }, { label: 'Cash', pct: 4 },
        ],
      };
    }
    if (!tokenRef) throw new Error('live getSummary requires the stored per-user security token');
    const jwt = await this._jwtFor(tokenRef);
    const [details, perf, user] = await Promise.all([
      this._request('GET', '/api/v1/portfolio/details?range=1y', { token: jwt }),
      this._request('GET', '/api/v2/portfolio/performance?range=ytd', { token: jwt }),
      this._request('GET', '/api/v1/user', { token: jwt }),
    ]);
    const summary = details.summary || {};
    const value = Math.round(summary.currentValueInBaseCurrency ?? 0);
    const currency = user.settings?.baseCurrency || 'USD';
    const pctRaw = perf.performance?.netPerformancePercentageWithCurrencyEffect
      ?? perf.performance?.netPerformancePercentage ?? 0;
    const performanceYtdPct = Number((pctRaw * 100).toFixed(1));

    // Aggregate holdings into an allocation breakdown by asset class. valueInPercentage is a
    // fraction (0..1); guard in case a version reports it already as a percent.
    const byClass = {};
    for (const h of Object.values(details.holdings || {})) {
      const cls = h.assetProfile?.assetClass || h.assetClass || 'OTHER';
      let frac = Number(h.valueInPercentage ?? h.allocationInPercentage ?? 0);
      if (frac > 1) frac /= 100;
      byClass[cls] = (byClass[cls] || 0) + frac;
    }
    const allocation = Object.entries(byClass)
      .map(([cls, frac]) => ({ label: labelizeAssetClass(cls), pct: Math.round(frac * 100) }))
      .filter((a) => a.pct > 0)
      .sort((a, b) => b.pct - a.pct);

    return { value, currency, performanceYtdPct, allocation };
  }
}
