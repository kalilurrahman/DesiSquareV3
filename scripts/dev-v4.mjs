#!/usr/bin/env node
// DesiSquare v4 — full-stack local launcher (zero dependencies, Node 20+).
//
//   node scripts/dev-v4.mjs
//
// Boots the v4 forum together with its glue services so the Ghostfolio-backed
// flows work live: portfolio card, "Open in Ghostfolio →" 1-click SSO, account
// provisioning on registration, WhatsApp mirroring, and the maven %-proof.
//
//   v4 forum        :8786   (app; open http://localhost:8786)
//   gf-provisioner  :8789   (Ghostfolio provisioning, portfolio summary, SSO)
//   wa-bridge       :8788   (WhatsApp ↔ forum mirror, mock mode)
//   models-service  :8791   (percent-only performance engine)
//
// Ghostfolio (:3333) is OPTIONAL — gf-provisioner runs in mock mode without it.
// For a REAL portfolio + SSO, bring Ghostfolio up first (needs Docker):
//   cd services/ghostfolio && docker compose up -d
// then set GHOSTFOLIO_URL=http://localhost:3333 GHOSTFOLIO_LIVE=true before this.
//
// Ctrl-C tears the whole stack down.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GHOSTFOLIO_URL = process.env.GHOSTFOLIO_URL || 'http://localhost:3333';

const SERVICES = [
  { name: 'gf-prov', dir: 'services/gf-provisioner', cmd: ['node', 'src/server.js'], port: 8789, color: '\x1b[33m', health: '/health',
    env: { GHOSTFOLIO_URL, GHOSTFOLIO_LIVE: process.env.GHOSTFOLIO_LIVE || 'false' } },
  { name: 'wa',      dir: 'services/wa-bridge',      cmd: ['node', 'src/server.js'], port: 8788, color: '\x1b[35m', health: '/health' },
  { name: 'models',  dir: 'services/models-service', cmd: ['node', 'src/server.js'], port: 8791, color: '\x1b[36m', health: '/health' },
  { name: 'v4',      dir: 'v4',                       cmd: ['node', 'server.mjs'],    port: 8786, color: '\x1b[32m', health: '/api/health',
    env: { GF_PROVISIONER_URL: 'http://localhost:8789', WA_BRIDGE_URL: 'http://localhost:8788', GHOSTFOLIO_URL } },
];
const RESET = '\x1b[0m';
const children = [];
let shuttingDown = false;

const log = (svc, line) => line.trim() && process.stdout.write(`${svc.color}[${svc.name.padEnd(7)}]${RESET} ${line}\n`);

function start(svc) {
  const child = spawn(svc.cmd[0], svc.cmd.slice(1), {
    cwd: join(ROOT, svc.dir),
    env: { ...process.env, ...(svc.env || {}), PORT: String(svc.port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const pipe = (stream) => { let buf = ''; stream.on('data', (d) => { buf += d; const ls = buf.split('\n'); buf = ls.pop(); ls.forEach((l) => log(svc, l)); }); };
  pipe(child.stdout); pipe(child.stderr);
  child.on('exit', (code) => { if (!shuttingDown) { log(svc, `exited (code ${code}) — tearing down`); shutdown(1); } });
}

async function waitHealthy(svc, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const r = await fetch(`http://127.0.0.1:${svc.port}${svc.health}`, { signal: AbortSignal.timeout(1500) }); if (r.status < 500) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function shutdown(code = 0) {
  if (shuttingDown) return; shuttingDown = true;
  process.stdout.write('\n\x1b[90mshutting down v4 stack…\x1b[0m\n');
  for (const c of children) { try { c.kill('SIGTERM'); } catch { /* gone */ } }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  process.stdout.write('\x1b[1mDesiSquare v4 — full stack (forum + Ghostfolio glue)\x1b[0m\n');
  for (const svc of SERVICES.filter((s) => s.name !== 'v4')) {
    start(svc);
    log(svc, (await waitHealthy(svc)) ? `healthy on :${svc.port}` : `WARN not healthy on :${svc.port} (v4 will show it down / use fallback)`);
  }
  const v4 = SERVICES.find((s) => s.name === 'v4');
  start(v4); await waitHealthy(v4, 8000);
  process.stdout.write(
    `\n\x1b[1m\x1b[32m▸ DesiSquare v4:\x1b[0m http://localhost:8786\n` +
    `  gf-provisioner :8789 · wa-bridge :8788 · models-service :8791\n` +
    `  Ghostfolio: ${GHOSTFOLIO_URL} ${process.env.GHOSTFOLIO_LIVE === 'true' ? '(live)' : '(mock — start it with docker for real portfolios)'}\n` +
    `  Register an account, open a member profile → "Open in Ghostfolio →" (1-click SSO), and a maven → the %-only proof.\n` +
    `  Ctrl-C to stop everything.\n\n`
  );
})();
