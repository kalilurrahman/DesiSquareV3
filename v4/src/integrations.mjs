// POC integration glue: wa-bridge (Script 1), gf-provisioner (Script 2), Ghostfolio, Discourse.
// The prototype runs fine standalone; when the real services are reachable it upgrades to them
// live — consent mapping, WhatsApp mirroring, account provisioning, SSO — with no code change.
//
// PRIVACY (non-negotiable #1): demo phone numbers for the wa-bridge consent map are generated
// HERE, server-side, and are only ever sent to wa-bridge (/map, /optout, /simulate/message).
// They never appear in seed files, API responses, logs, or the browser.
import { hmacSha256Hex } from './util.mjs';

const PROBE_TIMEOUT_MS = 1500;
const PROBE_INTERVAL_MS = 30_000;

// Deterministic fake E.164 for a wa handle — reserved-for-fiction US 555 range.
function demoPhoneFor(waHandle) {
  const n = String(waHandle).replace(/\D/g, '').padStart(4, '0').slice(-4);
  return `+1555010${n}`;
}

async function fetchJson(url, opts = {}, timeoutMs = PROBE_TIMEOUT_MS) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 200) }; }
  return { status: res.status, ok: res.ok, body, headers: res.headers };
}

export function createIntegrations({ store, config, log = console.log }) {
  const status = {
    waBridge: { url: config.waBridgeUrl, reachable: false, mode: null, detail: null },
    gfProvisioner: { url: config.gfProvisionerUrl, reachable: false, mode: null, detail: null },
    ghostfolio: { url: config.ghostfolioUrl, reachable: false, detail: null },
    discourse: { url: config.discourseUrl, reachable: false, detail: null },
    lastProbeAt: 0,
  };
  let mappingsRegistered = false;

  function event(kind, detail) {
    const entry = { at: Date.now(), kind, detail };
    store.state.events.unshift(entry);
    if (store.state.events.length > 200) store.state.events.length = 200;
    store.save();
    log(`[integrations] ${kind}: ${JSON.stringify(detail)}`);
    return entry;
  }

  async function probe() {
    // Each target carries a validator so a bare HTTP 200 doesn't count as "up" — e.g. when a
    // URL is mis-pointed at this app, whose SPA fallback returns 200 (HTML) for any path. We
    // only report a service reachable when the response is actually shaped like that service.
    const targets = [
      ['waBridge', `${config.waBridgeUrl}/health`, (b) => b?.service === 'wa-bridge'],
      ['gfProvisioner', `${config.gfProvisionerUrl}/health`, (b) => b?.service === 'gf-provisioner'],
      ['ghostfolio', `${config.ghostfolioUrl}/api/v1/health`, (b) => b != null && typeof b === 'object' && !('raw' in b)],
      ['discourse', `${config.discourseUrl}/about.json`, (b) => b?.about != null || b?.about_version != null],
    ];
    await Promise.all(targets.map(async ([key, url, valid]) => {
      try {
        const { ok, body } = await fetchJson(url);
        const good = ok && valid(body);
        status[key].reachable = good;
        status[key].mode = good ? (body?.mode ?? null) : null;
        status[key].detail = good ? 'up' : (ok ? 'wrong service at this URL' : 'unhealthy');
      } catch {
        status[key].reachable = false;
        status[key].mode = null;
        status[key].detail = 'unreachable';
      }
    }));
    status.lastProbeAt = Date.now();
    if (status.waBridge.reachable && !mappingsRegistered) {
      await registerWaMappings().catch((e) => log(`[integrations] wa map registration failed: ${e.message}`));
    }
    return status;
  }

  // Register the seeded consent mappings with the real wa-bridge (POST /map records consent).
  async function registerWaMappings() {
    for (const m of store.state.waMappings) {
      const user = store.state.users[m.userId];
      if (!user || !user.waConsentMirror) continue;
      await fetchJson(`${config.waBridgeUrl}/map`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: demoPhoneFor(m.waHandle), username: m.userId, userId: m.userId }),
      });
    }
    mappingsRegistered = true;
    event('wa_mappings_registered', { count: store.state.waMappings.length, target: 'wa-bridge' });
  }

  // Consent toggle -> real wa-bridge opt-out/opt-in when it is up.
  async function syncWaConsent(userId, consent) {
    const mapping = store.state.waMappings.find((m) => m.userId === userId);
    if (!mapping || !status.waBridge.reachable) return { synced: false };
    const phone = demoPhoneFor(mapping.waHandle);
    if (consent) {
      await fetchJson(`${config.waBridgeUrl}/map`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, username: userId, userId }),
      });
      event('wa_consent_synced', { userId, consent: true });
    } else {
      await fetchJson(`${config.waBridgeUrl}/optout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      event('wa_consent_synced', { userId, consent: false });
    }
    return { synced: true };
  }

  // Demo driver: inject an inbound WhatsApp group message.
  // Preferred path goes through the REAL wa-bridge (which posts back into this app via the
  // Discourse-compatible API). Fallback path mirrors directly so the demo never blocks.
  async function injectWhatsApp({ userId, text }) {
    const mapping = store.state.waMappings.find((m) => m.userId === userId);
    const startedAt = Date.now();
    // Self-heal against a cold start: if the bridge looks down (e.g. it came up AFTER our
    // one-shot startup probe), re-probe once before falling back to the built-in path.
    if (!status.waBridge.reachable) await probe().catch(() => {});
    if (status.waBridge.reachable && mapping) {
      const { ok, body } = await fetchJson(`${config.waBridgeUrl}/simulate/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: `demo_${startedAt}`,
          groupJid: 'dev-group',
          phone: demoPhoneFor(mapping.waHandle),
          text,
        }),
      }, 8000);
      event('wa_inbound_via_bridge', { userId, status: body?.status ?? ok, ms: Date.now() - startedAt });
      return { path: 'wa-bridge', result: body, ms: Date.now() - startedAt };
    }
    return { path: 'builtin', result: null, ms: Date.now() - startedAt };
  }

  // Provision a Ghostfolio account through the real gf-provisioner by firing the same
  // webhook Discourse would send on user_confirmed_email (HMAC-signed like Discourse does).
  async function provisionGhostfolio(user) {
    // Self-heal against a cold start (gf-provisioner up after our startup probe).
    if (!status.gfProvisioner.reachable) await probe().catch(() => {});
    if (!status.gfProvisioner.reachable) {
      if (!user.ghostfolio) {
        user.ghostfolio = { accountId: `sim_${user.id}`, provisionedAt: Date.now(), source: 'built-in sim' };
        store.save();
      }
      return { status: 'simulated', accountId: user.ghostfolio.accountId };
    }
    const payload = JSON.stringify({ user: { id: user.id, username: user.id, email: user.email, active: true } });
    const headers = {
      'content-type': 'application/json',
      'x-discourse-event': 'user_confirmed_email',
      'x-discourse-event-type': 'user',
    };
    if (config.webhookSecret) {
      headers['x-discourse-event-signature'] = `sha256=${hmacSha256Hex(config.webhookSecret, payload)}`;
    }
    const { body } = await fetchJson(`${config.gfProvisionerUrl}/discourse/webhook`, {
      method: 'POST', headers, body: payload,
    }, 8000);
    if (body?.status && body.status !== 'error') {
      user.ghostfolio = {
        accountId: body.accountId ?? user.ghostfolio?.accountId ?? null,
        provisionedAt: user.ghostfolio?.provisionedAt ?? Date.now(),
        source: status.gfProvisioner.mode === 'live' ? 'ghostfolio live' : 'gf-provisioner mock',
        lastStatus: body.status,
      };
      store.save();
    }
    event('gf_provisioned', { userId: user.id, result: body?.status ?? 'error' });
    return body ?? { status: 'error' };
  }

  async function ghostfolioSummary(userId, viewer) {
    if (!status.gfProvisioner.reachable) return null;
    try {
      const { body } = await fetchJson(
        `${config.gfProvisionerUrl}/portfolio/${encodeURIComponent(userId)}/summary?viewer=${viewer}`,
        {}, 4000,
      );
      return body;
    } catch { return null; }
  }

  async function syncPortfolioVisibility(userId, isPublic) {
    if (!status.gfProvisioner.reachable) return { synced: false };
    await fetchJson(`${config.gfProvisionerUrl}/portfolio/${encodeURIComponent(userId)}/visibility`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ public: isPublic }),
    }, 4000).catch(() => {});
    return { synced: true };
  }

  async function mintSso(userId) {
    if (!status.gfProvisioner.reachable) await probe().catch(() => {});
    if (!status.gfProvisioner.reachable) return null;
    try {
      const { body, ok } = await fetchJson(`${config.gfProvisionerUrl}/sso/${encodeURIComponent(userId)}`, {}, 4000);
      return ok ? body : null;
    } catch { return null; }
  }

  // Outbound notification: a reply landed on a WA-linked member's post -> tell wa-bridge,
  // exactly the way Discourse's notification_created webhook would.
  async function notifyWhatsApp({ recipient, topicId, displayUsername }) {
    const user = store.state.users[recipient];
    if (!user?.waLinked || !user.waNotifs || !status.waBridge.reachable) return { status: 'skipped' };
    const payload = JSON.stringify({
      notification: {
        id: `${recipient}:${topicId}:${Date.now()}`,
        user_id: recipient,
        topic_id: topicId,
        data: { display_username: displayUsername },
      },
    });
    const headers = { 'content-type': 'application/json' };
    if (config.webhookSecret) {
      headers['x-discourse-event-signature'] = `sha256=${hmacSha256Hex(config.webhookSecret, payload)}`;
    }
    try {
      const { body } = await fetchJson(`${config.waBridgeUrl}/discourse/notify-webhook`, {
        method: 'POST', headers, body: payload,
      }, 4000);
      event('wa_notify', { recipient, result: body?.status ?? 'error' });
      return body ?? { status: 'error' };
    } catch (e) {
      return { status: 'unreachable', error: e.message };
    }
  }

  const timer = setInterval(() => probe().catch(() => {}), PROBE_INTERVAL_MS);
  timer.unref?.();

  return {
    status,
    probe,
    injectWhatsApp,
    provisionGhostfolio,
    ghostfolioSummary,
    syncPortfolioVisibility,
    syncWaConsent,
    mintSso,
    notifyWhatsApp,
    event,
  };
}
