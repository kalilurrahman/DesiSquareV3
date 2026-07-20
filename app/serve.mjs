// DesiSquare product app — zero-dependency static server + same-origin API proxy.
// `node serve.mjs` → http://localhost:5191
//
// The proxy keeps the browser same-origin (no CORS changes to any service) and mirrors the
// route-map a Cloud Load Balancer / API gateway provides in the GCP tier:
//   /api/ai/*        → :8787   (ai-service — dedup / KB / guardrail)
//   /api/wa/*        → :8788   (wa-bridge — WhatsApp status, mock mode)
//   /api/gf/*        → :8789   (gf-provisioner — Ghostfolio portfolios)
//   /api/models/*    → :8791   (models-service — model metrics + signal records)
//   /api/discourse/* → :8080   (Discourse core)
//
// Free-only MVP: stripe-bridge is deliberately NOT proxied (Phase L).
//
// Optional (git-ignored desisquare-app/.env): DISCOURSE_API_KEY + DISCOURSE_API_USERNAME are
// injected server-side on /api/discourse writes. Without them (and with every upstream down)
// the app still demos fully from its seeded prototype content.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { readFile as readFileP } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 5191;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// minimal .env loader (same pattern as the services)
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const UPSTREAMS = {
  ai: process.env.AI_URL || 'http://localhost:8787',
  wa: process.env.WA_URL || 'http://localhost:8788',
  gf: process.env.GF_URL || 'http://localhost:8789',
  models: process.env.MODELS_URL || 'http://localhost:8791',
  discourse: process.env.DISCOURSE_URL || 'http://localhost:8080',
};

async function proxy(req, res, target, rest) {
  const url = `${target}${rest}`;
  const headers = { Accept: 'application/json' };
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  // Server-side credential injection for Discourse writes (never exposed to the browser).
  if (target === UPSTREAMS.discourse && process.env.DISCOURSE_API_KEY) {
    headers['Api-Key'] = process.env.DISCOURSE_API_KEY;
    headers['Api-Username'] = process.env.DISCOURSE_API_USERNAME || 'system';
  }
  const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ? await new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); })
    : undefined;
  try {
    const upstream = await fetch(url, { method: req.method, headers, body: body || undefined, signal: AbortSignal.timeout(10000) });
    const text = await upstream.text();
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    res.end(text);
  } catch (e) {
    // Graceful degradation: the app treats any 502 as "upstream down" and falls back to seed content.
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream_unreachable', target: url.replace(/^https?:\/\//, ''), detail: e.message }));
  }
}

createServer(async (req, res) => {
  const { pathname, search } = new URL(req.url, 'http://x');
  const m = pathname.match(/^\/api\/(ai|wa|gf|models|discourse)(\/.*)?$/);
  if (m) return proxy(req, res, UPSTREAMS[m[1]], (m[2] || '/') + (search || ''));
  try {
    let path = decodeURIComponent(pathname);
    if (path === '/') path = '/index.html';
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFileP(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    // SPA: unknown paths fall back to the shell (hash routing handles views)
    try {
      const body = await readFileP(join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  }
}).listen(PORT, () => {
  console.log(`DesiSquare app on http://localhost:${PORT}`);
  console.log(`  proxying /api/{ai,wa,gf,models,discourse} → ${Object.values(UPSTREAMS).join(', ')}`);
  console.log('  every upstream is optional — the app degrades to seeded prototype content');
});
