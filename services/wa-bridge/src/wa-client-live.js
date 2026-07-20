// Live WhatsApp client — the real backend behind the seam (mirrors the MockWaClient interface:
// connect(), on('message', cb), getState()). It uses the UNOFFICIAL whatsapp-web.js library, which
// drives a headless WhatsApp Web session via puppeteer/Chromium. This is the only way to READ group
// messages (the official Cloud API cannot), but it violates WhatsApp's ToS and risks a number ban —
// a business go/no-go decision is required before pairing a real number (see README + .env.example).
//
// Dependencies are loaded via DYNAMIC import inside connect() so the zero-dependency mock stays the
// default: `npm run install:wa` installs whatsapp-web.js + qrcode-terminal (pulls Chromium) on demand.

// Pure mapper: whatsapp-web.js Message -> the { id, groupJid, phone, text } shape the bridge expects.
// Exported so it can be unit-tested without importing whatsapp-web.js. Groups are `...@g.us`; the
// sender within a group is `msg.author` (a `phone@c.us` JID), while for direct chats it's `msg.from`.
export function normalizeWaMessage(m) {
  const from = String(m?.from || '');
  const author = String(m?.author || from);
  return {
    id: m?.id?._serialized || m?.id?.id || null,
    groupJid: from,
    // strip the JID suffix so only the bare number reaches the bridge (which hashes it in logs)
    phone: author.replace(/@(c\.us|s\.whatsapp\.net|lid)$/i, ''),
    text: m?.body || '',
    isGroup: from.endsWith('@g.us'),
  };
}

export class WhatsAppWebClient {
  constructor(config, log = console.log) {
    this.config = config;
    this.log = log;
    this.connected = false;
    this._qr = null;
    this._client = null;
    this._handlers = { message: [] };
  }

  on(event, cb) { (this._handlers[event] ||= []).push(cb); }
  _emit(event, ...args) { for (const cb of this._handlers[event] || []) cb(...args); }

  getState() {
    return { connected: this.connected, backend: 'whatsapp-web.js', paired: this.connected, qr: this._qr || null };
  }

  async connect() {
    const wweb = await import('whatsapp-web.js').catch(() => null);
    if (!wweb) {
      throw new Error(
        'whatsapp-web.js is not installed. Run `npm run install:wa` in services/wa-bridge ' +
        '(installs whatsapp-web.js + qrcode-terminal and pulls Chromium via puppeteer), then restart.'
      );
    }
    const { Client, LocalAuth } = wweb.default || wweb;
    let qrcode = null;
    try { qrcode = (await import('qrcode-terminal')).default; } catch { /* optional pretty QR */ }

    this._client = new Client({
      authStrategy: new LocalAuth({ dataPath: this.config.wa.sessionPath, clientId: this.config.wa.clientId }),
      puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    });

    this._client.on('qr', (qr) => {
      this._qr = qr;
      this.log('  [wa] scan this QR in WhatsApp → Settings → Linked devices → Link a device:');
      if (qrcode) qrcode.generate(qr, { small: true });
      else this.log('  (install qrcode-terminal for an inline QR) QR payload: ' + qr);
    });
    this._client.on('authenticated', () => this.log('  [wa] authenticated (session cached under data/wa-session).'));
    // Forward lifecycle events so the server can alert on them (B6/DS-047).
    this._client.on('auth_failure', (msg) => { this.log('  [wa] auth failure: ' + msg); this._emit('auth_failure', msg); });
    this._client.on('ready', () => { this.connected = true; this._qr = null; this.log('  [wa] connected — paired and ready.'); this._emit('ready'); });
    this._client.on('disconnected', (reason) => { this.connected = false; this.log('  [wa] disconnected: ' + reason); this._emit('disconnected', reason); });

    // Mirror only group messages (the bridge's allow-list further narrows which groups).
    this._client.on('message', (m) => {
      const msg = normalizeWaMessage(m);
      if (!msg.isGroup) return;
      for (const cb of this._handlers.message) cb(msg);
    });

    await this._client.initialize(); // boots Chromium + emits `qr` (first run) or restores the session
    return { connected: this.connected, qr: this._qr };
  }

  async disconnect() {
    try { await this._client?.destroy(); } catch { /* ignore */ }
    this.connected = false;
  }
}
