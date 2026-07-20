// WhatsApp client behind a seam. The stub ships a MOCK client (no whatsapp-web.js, no Chromium)
// so the pipeline runs offline. The real backend now lives in ./wa-client-live.js
// (WhatsAppWebClient) and is selected at runtime by `createWaClient` based on WA_BACKEND — its
// heavy deps are dynamic-imported there, so importing this module stays dependency-free.
//
// The bridge only depends on: connect(), on('message', cb), getState(), and (mock) inject().

// Factory: return the WhatsApp client for the configured backend.
//   WA_BACKEND=mock (default) -> MockWaClient (offline; POST /simulate/message to inject)
//   WA_BACKEND=whatsapp-web.js -> real WhatsAppWebClient (QR pairing; needs `npm run install:wa`)
export async function createWaClient(config, log = console.log) {
  const backend = String(config?.wa?.backend || 'mock').toLowerCase();
  if (backend === 'whatsapp-web.js' || backend === 'wwebjs' || backend === 'live') {
    const { WhatsAppWebClient } = await import('./wa-client-live.js');
    return new WhatsAppWebClient(config, log);
  }
  return new MockWaClient(log);
}

export class MockWaClient {
  constructor(log = console.log) {
    this.log = log;
    this.connected = false;
    this._handlers = { message: [] };
  }
  async connect() {
    this.connected = true;
    this.log('  [mock wa] connected (no real WhatsApp session; use POST /simulate/message to inject)');
    return { connected: true, qr: null };
  }
  on(event, cb) { (this._handlers[event] ||= []).push(cb); }
  _emit(event, ...args) { for (const cb of this._handlers[event] || []) cb(...args); }
  // DEV: simulate a lifecycle event ('disconnected' | 'auth_failure' | 'ready') for alert testing.
  simulateLifecycle(event, detail) { this._emit(event, detail); }
  getState() { return { connected: this.connected, backend: 'mock' }; }
  // Dev helper: simulate an inbound group message.
  inject(msg) {
    for (const cb of this._handlers.message) cb(msg);
  }
}
