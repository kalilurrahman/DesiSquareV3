#!/usr/bin/env node
// Phase-1 acceptance smoke (PRD §5) across the REAL three-service wiring:
//   phase1 app (:8786)  ←posts.json←  wa-bridge (:8788)   [Script 1, mock WhatsApp]
//   phase1 app  →user_confirmed_email webhook→  gf-provisioner (:8789)  [Script 2]
//
// Follows the repo smoke conventions: refuses to run if the ports are busy, wipes each
// service's data/ dir first, exit 0 = every gate green. Run via `make smoke` or
// `node phase1-mvp/scripts/smoke.mjs`. E2E_VERBOSE=1 streams service stderr.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const SECRET = 'smoke-secret';
const APP = 'http://localhost:8786';
const WA = 'http://localhost:8788';
const GF = 'http://localhost:8789';
const E164 = /\+[1-9][0-9\-\s().]{7,}[0-9]/;

let failures = 0;
const children = [];
const ok = (cond, label) => {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${label}`);
  if (!cond) failures++;
};

async function req(method, url, body, headers = {}, jar = null) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...(jar?.cookie ? { cookie: jar.cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  const setCookie = res.headers.get('set-cookie');
  if (jar && setCookie) jar.cookie = setCookie.split(';')[0];
  let json = null;
  try { json = await res.json(); } catch { /* redirects/html */ }
  return { status: res.status, body: json, headers: res.headers };
}

async function assertPortsFree() {
  for (const url of [APP, WA, GF]) {
    try {
      await fetch(`${url}/health`, { signal: AbortSignal.timeout(600) });
      console.error(`Port busy at ${url} — run \`make stop\` first (the smoke needs the default ports).`);
      process.exit(2);
    } catch { /* free — good */ }
  }
}

function spawnService(name, cwd, entry, env) {
  const child = spawn(process.execPath, [entry], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', process.env.E2E_VERBOSE ? 'inherit' : 'ignore', process.env.E2E_VERBOSE ? 'inherit' : 'pipe'],
  });
  children.push(child);
  return child;
}

async function waitHealthy(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(500) });
      if (res.ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

process.on('exit', () => children.forEach((c) => c.kill()));

console.log('◆ Phase-1 acceptance smoke');
await assertPortsFree();

// Fresh state everywhere (repo smoke convention).
for (const p of ['phase1-mvp/data/db.json', 'services/wa-bridge/data/state.json', 'services/gf-provisioner/data/identity.json']) {
  rmSync(join(REPO, p), { force: true });
}

spawnService('phase1-app', join(REPO, 'phase1-mvp'), 'server.mjs', { PORT: '8786', DISCOURSE_WEBHOOK_SECRET: SECRET });
spawnService('wa-bridge', join(REPO, 'services/wa-bridge'), 'src/server.js', {
  PORT: '8788', DISCOURSE_URL: APP, DISCOURSE_API_KEY: 'smoke-key',
  MIRROR_CATEGORY: 'ask-the-community', WA_MODE: 'mock', DISCOURSE_WEBHOOK_SECRET: SECRET,
});
spawnService('gf-provisioner', join(REPO, 'services/gf-provisioner'), 'src/server.js', { PORT: '8789', DISCOURSE_WEBHOOK_SECRET: SECRET });

console.log('— boot');
ok(await waitHealthy(APP), 'phase1 app healthy');
ok(await waitHealthy(WA), 'wa-bridge healthy');
ok(await waitHealthy(GF), 'gf-provisioner healthy');
// (probe runs on the app timer; demo/status is session-gated and checked in the leak sweep below)

console.log('— P1-FR-05: WhatsApp mirror < 60 s, pseudonym attribution, consent');
const jar = {};
await req('POST', `${APP}/api/session`, { mode: 'demo', userId: 'quiet_lotus' }, {}, jar);
const t0 = Date.now();
const inject = await req('POST', `${APP}/api/demo/wa-inbound`, { userId: 'quant_aunty', text: 'Smoke: is the 60-second mirror promise real?' }, {}, jar);
ok(inject.body?.path === 'wa-bridge', `mirror path is the REAL wa-bridge (got: ${inject.body?.path})`);
await new Promise((r) => setTimeout(r, 400));
const feed1 = await req('GET', `${APP}/api/feed?space=all`, undefined, {}, jar);
const mirrored = feed1.body.posts.find((p) => p.title.startsWith('Smoke: is the 60-second'));
ok(!!mirrored && mirrored.author.id === 'quant_aunty' && mirrored.via === 'whatsapp', 'post attributed to the mapped pseudonym, labelled via WhatsApp');
ok(Date.now() - t0 < 60_000, `mirror latency ${Date.now() - t0} ms < 60 s`);
// consent: opt out -> guest attribution (quiet_lotus revokes, then restores)
const optOut = await req('PUT', `${APP}/api/me/settings`, { waConsentMirror: false }, {}, jar);
ok(optOut.status === 200 && optOut.body?.me?.waConsentMirror === false, 'consent revoked in settings');
await new Promise((r) => setTimeout(r, 300));
await req('POST', `${APP}/api/demo/wa-inbound`, { userId: 'quiet_lotus', text: 'Smoke: this must NOT be attributed after opt-out.' }, {}, jar);
await new Promise((r) => setTimeout(r, 400));
const feed2 = await req('GET', `${APP}/api/feed?space=all`, undefined, {}, jar);
const guestPost = feed2.body.posts.find((p) => p.title.startsWith('Smoke: this must NOT'));
ok(!!guestPost && guestPost.author.id !== 'quiet_lotus', `opt-out honored — attributed to '${guestPost?.author?.id}', not the member`);
await req('PUT', `${APP}/api/me/settings`, { waConsentMirror: true }, {}, jar);

console.log('— P1-FR-06: signup → exactly one Ghostfolio account, re-fire = no duplicate, 1-click SSO');
const signup = await req('POST', `${APP}/api/demo/signup`, undefined, {}, jar);
ok(signup.body?.first === 'provisioned', `first webhook provisions (got: ${signup.body?.first})`);
ok(signup.body?.second === 'already_linked', `webhook re-fire is idempotent (got: ${signup.body?.second})`);
const sso = await req('POST', `${APP}/api/me/portfolio/sso`, undefined, {}, jar);
const ssoUrl = sso.body?.url;
ok(typeof ssoUrl === 'string' && ssoUrl.includes('/sso/click?sso='), `SSO deep-link minted (got: ${ssoUrl})`);
const click = ssoUrl ? await req('GET', ssoUrl) : { status: 0, headers: new Map() };
ok(click.status === 302 && /\/auth\//.test(click.headers.get('location') || ''), `SSO click 302s into Ghostfolio auth (${click.status})`);

console.log('— P1-FR-04: reactions — positive public, negative private-to-queue');
const rx = await req('POST', `${APP}/api/posts/p01/react`, { type: 'helpful' }, {}, jar);
ok(rx.body?.reactions?.helpful?.on === true, 'positive reaction toggles publicly');
await req('POST', `${APP}/api/posts/p05/flag`, { reason: 'Spam' }, {}, jar);
const jar2 = {};
await req('POST', `${APP}/api/session`, { mode: 'demo', userId: 'nikhil_cfa' }, {}, jar2);
const otherView = await req('GET', `${APP}/api/posts/p05`, undefined, {}, jar2);
ok(otherView.status === 200 && otherView.body?.post?.myFlag === null, 'negative reaction invisible to other members');
const modJar = {};
await req('POST', `${APP}/api/session`, { mode: 'demo', userId: 'desisquare_mod' }, {}, modJar);
const queue = await req('GET', `${APP}/api/review-queue`, undefined, {}, modJar);
ok(queue.body?.items?.some((q) => q.post?.id === 'p05' && q.reason === 'Spam'), 'flag landed in the moderator queue');

console.log('— P1-FR-02: country switch + private community request');
const ca = await req('GET', `${APP}/api/communities?country=CA`, undefined, {}, jar);
ok(ca.body?.communities?.length === 2, 'country switch swaps the community list');
const joinReq = await req('POST', `${APP}/api/communities/fire/join`, undefined, {}, jar);
ok(joinReq.body?.status === 'requested', 'private community join creates a pending request');

console.log('— Non-negotiable #1: E.164 leak sweep over every member-facing response');
let leak = null;
for (const path of ['/api/bootstrap', '/api/feed?space=all', '/api/posts/p04', '/api/users/quant_aunty', '/api/users/dallas_desi', '/api/demo/status', '/categories.json']) {
  const { body } = await req('GET', `${APP}${path}`, undefined, {}, jar);
  const hit = JSON.stringify(body ?? {}).match(E164);
  if (hit) leak = `${path} → ${hit[0]}`;
}
ok(!leak, leak ? `phone leak: ${leak}` : 'no phone number in any response');

console.log(failures === 0 ? '\n◆ SMOKE GREEN — all phase-1 gates passed.' : `\n◆ SMOKE RED — ${failures} gate(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
