// DesiSquare Phase-1 prototype — single zero-dependency Node 22 server.
//   node server.mjs            -> http://localhost:8786
// Serves the SPA, the member JSON API, the Discourse-compatible surface for wa-bridge,
// and the demo driver. See RUNBOOK.md for the full POC wiring.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore } from './src/store.mjs';
import { createIntegrations } from './src/integrations.mjs';
import { createApi } from './src/api.mjs';
import { createDiscourseCompat } from './src/discourse-compat.mjs';
import { readJson } from './src/util.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// Minimal .env loader (repo convention: one .env per service, env wins over file).
try {
  const envFile = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch { /* no .env — defaults below */ }

const PORT = Number(process.env.PORT || 8786);
const config = {
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${PORT}`,
  cookieName: 'dsq_session',
  mirrorSpace: process.env.MIRROR_SPACE || 'help', // "Ask the community"
  waBridgeUrl: (process.env.WA_BRIDGE_URL || 'http://localhost:8788').replace(/\/$/, ''),
  gfProvisionerUrl: (process.env.GF_PROVISIONER_URL || 'http://localhost:8789').replace(/\/$/, ''),
  ghostfolioUrl: (process.env.GHOSTFOLIO_URL || 'http://localhost:3333').replace(/\/$/, ''),
  discourseUrl: (process.env.DISCOURSE_URL || 'http://localhost:8080').replace(/\/$/, ''),
  mailhogUrl: (process.env.MAILHOG_URL || 'http://localhost:8025').replace(/\/$/, ''),
  webhookSecret: process.env.DISCOURSE_WEBHOOK_SECRET || '',
  compatApiKey: process.env.COMPAT_API_KEY || '', // empty = accept any non-empty Api-Key (local demo)
  compatGuestUsername: process.env.GUEST_USERNAME || 'system',
};

const store = createStore({
  dataDir: process.env.DATA_DIR || join(ROOT, 'data'),
  seedDir: join(ROOT, 'data'),
});
const integrations = createIntegrations({ store, config });
const api = createApi({ store, integrations, config });
const compat = createDiscourseCompat({ store, api, integrations, config });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const PUBLIC_DIR = join(ROOT, 'public');

function serveStatic(res, pathname) {
  let filePath = resolve(PUBLIC_DIR, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filePath.startsWith(PUBLIC_DIR + sep) && filePath !== join(PUBLIC_DIR, 'index.html')) {
    res.writeHead(403); res.end('forbidden'); return true;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // SPA fallback: unknown non-API paths render the app shell.
    filePath = join(PUBLIC_DIR, 'index.html');
  }
  const body = readFileSync(filePath);
  res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, config.publicUrl);
  const pathname = url.pathname;
  try {
    if (pathname.startsWith('/api/')) {
      const handled = await api.handle(req, res, pathname, url.searchParams);
      if (handled !== null) return;
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'no such endpoint' }));
      return;
    }
    const compatHandled = await compat.handle(req, res, pathname, readJson);
    if (compatHandled !== null) return;
    serveStatic(res, pathname);
  } catch (err) {
    console.error(`[server] ${req.method} ${pathname} crashed:`, err);
    if (!res.headersSent) { res.writeHead(500, { 'content-type': 'application/json' }); }
    res.end(JSON.stringify({ error: 'internal error' }));
  }
});

server.listen(PORT, () => {
  console.log(`◆ DesiSquare Phase-1 prototype`);
  console.log(`  app           ${config.publicUrl}`);
  console.log(`  health        ${config.publicUrl}/api/health`);
  console.log(`  demo driver   in-app (bottom-right ▶ Demo) or POST /api/demo/wa-inbound`);
  console.log(`  wa-bridge     expects ${config.waBridgeUrl} (optional — POC Script 1)`);
  console.log(`  gf-provision  expects ${config.gfProvisionerUrl} (optional — POC Script 2)`);
  integrations.probe().then(() => {
    const s = integrations.status;
    const flag = (x) => (x.reachable ? `up${x.mode ? ` (${x.mode})` : ''}` : 'not running');
    console.log(`  wiring        wa-bridge: ${flag(s.waBridge)} · gf-provisioner: ${flag(s.gfProvisioner)} · ghostfolio: ${flag(s.ghostfolio)} · discourse: ${flag(s.discourse)}`);
  }).catch(() => {});
});
