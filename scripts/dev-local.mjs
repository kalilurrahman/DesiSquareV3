#!/usr/bin/env node
// DesiSquare — local full-stack launcher (zero dependencies, Node 18+).
//
//   node scripts/dev-local.mjs
//
// Boots the three glue services and the product app together, so the app
// serves LIVE data (maven Monthly/Yearly/Overall % from models-service) instead
// of seeded fallback. Ghostfolio + Discourse are optional upstreams — the app
// degrades gracefully when they are absent (see deploy/ for the real stack).
//
// Ctrl-C tears the whole stack down. Logs are prefixed and colored per service.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SERVICES = [
  { name: 'models',   dir: 'services/models-service',  cmd: ['node', 'src/server.js'], port: 8791, color: '\x1b[36m', health: '/health' },
  { name: 'wa',       dir: 'services/wa-bridge',        cmd: ['node', 'src/server.js'], port: 8788, color: '\x1b[35m', health: '/health' },
  { name: 'gf',       dir: 'services/gf-provisioner',   cmd: ['node', 'src/server.js'], port: 8789, color: '\x1b[33m', health: '/health' },
  { name: 'app',      dir: 'app',                       cmd: ['node', 'serve.mjs'],     port: 5191, color: '\x1b[32m', health: '/' },
];
const RESET = '\x1b[0m';
const children = [];
let shuttingDown = false;

function log(svc, line) {
  if (!line.trim()) return;
  process.stdout.write(`${svc.color}[${svc.name.padEnd(6)}]${RESET} ${line}\n`);
}

function start(svc) {
  const child = spawn(svc.cmd[0], svc.cmd.slice(1), {
    cwd: join(ROOT, svc.dir),
    env: { ...process.env, PORT: String(svc.port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  svc.child = child;
  children.push(child);
  const pipe = (stream) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach((l) => log(svc, l));
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      log(svc, `exited (code ${code}) — tearing down the stack`);
      shutdown(1);
    }
  });
}

async function waitHealthy(svc, timeoutMs = 15000) {
  const url = `http://127.0.0.1:${svc.port}${svc.health}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.status < 500) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write('\n\x1b[90mshutting down DesiSquare stack…\x1b[0m\n');
  for (const c of children) { try { c.kill('SIGTERM'); } catch { /* already gone */ } }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  process.stdout.write('\x1b[1mDesiSquare — local full stack\x1b[0m\n');
  for (const svc of SERVICES.filter((s) => s.name !== 'app')) {
    start(svc);
    const ok = await waitHealthy(svc);
    log(svc, ok ? `healthy on :${svc.port}` : `WARN: not healthy on :${svc.port} (app will use seeded fallback for this one)`);
  }
  const app = SERVICES.find((s) => s.name === 'app');
  start(app);
  await waitHealthy(app, 8000);
  process.stdout.write(
    `\n\x1b[1m\x1b[32m▸ DesiSquare app:\x1b[0m http://localhost:${app.port}\n` +
    `  models-service :8791  ·  wa-bridge :8788  ·  gf-provisioner :8789\n` +
    `  Maven Monthly/Yearly/Overall % is LIVE from models-service; member gains toggle in Settings.\n` +
    `  Ctrl-C to stop everything.\n\n`
  );
})();
