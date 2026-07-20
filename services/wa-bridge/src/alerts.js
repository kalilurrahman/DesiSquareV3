// Bridge alerting (B6 / DS-047 seam): pushes disconnect / auth-failure / reconnect events to a
// generic webhook (Slack-compatible `{text}` payload — works with Slack, Discord /slack, Google
// Chat, ntfy, etc.). Cooldown stops a flapping session from spamming the channel. No webhook
// configured → events are only logged (dev default). Alerts are also kept in a ring buffer that
// /health exposes, so the CTO dashboard can show recent incidents without any webhook at all.
const COOLDOWN_MS = 5 * 60_000;
const RING_SIZE = 50;

export class Alerts {
  constructor({ webhookUrl = '', service = 'wa-bridge', log = console.log } = {}) {
    this.webhookUrl = webhookUrl;
    this.service = service;
    this.log = log;
    this.recent = [];            // ring buffer, newest last
    this._lastSentByKind = {};   // cooldown per alert kind
  }

  // Fire an alert. severity: 'critical' | 'warning' | 'info'. Returns what happened.
  async fire(kind, message, severity = 'warning', now = Date.now()) {
    const entry = { kind, message, severity, at: new Date(now).toISOString() };
    this.recent.push(entry);
    if (this.recent.length > RING_SIZE) this.recent.shift();
    this.log(`  [alert:${severity}] ${kind}: ${message}`);

    if (!this.webhookUrl) return { status: 'logged_only', entry };
    const last = this._lastSentByKind[kind] || 0;
    if (now - last < COOLDOWN_MS) return { status: 'cooldown', entry };
    this._lastSentByKind[kind] = now;
    try {
      const icon = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : '🟢';
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${icon} [${this.service}] ${kind}: ${message}` }),
        signal: AbortSignal.timeout(3000),
      });
      return { status: 'sent', entry };
    } catch (e) {
      this.log(`  [alert] webhook delivery failed: ${e.message}`);
      return { status: 'delivery_failed', entry };
    }
  }
}
