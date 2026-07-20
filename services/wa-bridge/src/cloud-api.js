// Outbound notifications via the OFFICIAL WhatsApp Cloud API. Mock when no token.
// NOTE: the Cloud API can send to users who messaged you / opted in via templates — it CANNOT
// read arbitrary group messages (that's why inbound uses the whatsapp-web.js seam). See docs/09.
export class CloudApi {
  constructor(config, log = console.log) {
    this.config = config;
    this.log = log;
  }
  async sendTemplate(toPhone, bodyParams = []) {
    if (!this.config.cloudApi.token || !this.config.cloudApi.phoneNumberId) {
      this.log(`  [mock cloud-api] would send template '${this.config.cloudApi.template}' with ${bodyParams.length} params`);
      return { mock: true };
    }
    const res = await fetch(`https://graph.facebook.com/v20.0/${this.config.cloudApi.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.cloudApi.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
          name: this.config.cloudApi.template,
          language: { code: 'en' },
          components: bodyParams.length ? [{ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: t })) }] : [],
        },
      }),
    });
    if (!res.ok) throw new Error(`cloud-api ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
