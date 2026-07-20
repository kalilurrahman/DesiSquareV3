#!/usr/bin/env node
// DesiSquare cutdown demo server — zero dependencies, Node 18+.
// Serves the v4 interactive prototype (the full clickable walkthrough),
// the 50-user simulation self-test report, and the key product docs.
// Local:   node demo/server.mjs        → http://localhost:8080
// Railway: deployed via demo/Dockerfile (PORT injected by the platform).

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);

const read = p => readFileSync(join(ROOT, p));
const mdPage = (title, mdPath) => {
  const md = read(mdPath).toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · DesiSquare demo</title>
<style>body{font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;max-width:960px;margin:2rem auto;padding:0 1rem;color:#26303b;background:#f7f8fa}
pre{white-space:pre-wrap;word-break:break-word}a{color:#3b5b92}header a{margin-right:1rem}</style>
<header><a href="/">← prototype</a><a href="/report">test report</a><a href="/stories">user stories</a><a href="/checklist">infra checklist</a></header>
<pre>${md}</pre>`;
};

const ROUTES = {
  // The real product app (from app/index.html) — served with its seeded fallback,
  // since the cutdown has no backing services. Maven Monthly/Yearly/Overall %,
  // member gains toggle, and tabbed search all work from seed data.
  '/': { file: 'app/index.html', type: 'text/html; charset=utf-8' },
  // The design walkthrough prototype stays one click away.
  '/prototype': { file: 'docs/desisquare-wireframes-v4-prototype.html', type: 'text/html; charset=utf-8' },
  '/health': { json: () => ({ ok: true, service: 'desisquare-demo', tier: 'cutdown', app: 'product+prototype', uptime: process.uptime() }) },
  '/report': { md: ['50-user simulation self-test', 'test/community-sim/report-selftest/DesiSquare-50-user-selftest-report.md'] },
  '/stories': { md: ['User stories v3', 'docs/desisquare-user-stories.md'] },
  '/checklist': { md: ['Client infra checklist', 'deploy/CLIENT-INFRA-CHECKLIST.md'] },
};

createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '') || '/';
  const route = ROUTES[path];
  try {
    // The product app fetches /api/* same-origin; the cutdown has no services,
    // so answer with a clean 503 JSON — the app catches it and degrades to seed
    // (never a redirect-to-HTML, which the app's fetch layer can't parse).
    if (path.startsWith('/api/')) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'X-Robots-Tag': 'noindex' });
      return res.end(JSON.stringify({ error: 'demo-cutdown: no backing services (seeded fallback in use)' }));
    }
    if (!route) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    if (route.json) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(route.json()));
    }
    if (route.md) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' });
      return res.end(mdPage(...route.md));
    }
    res.writeHead(200, { 'Content-Type': route.type, 'X-Robots-Tag': 'noindex' });
    res.end(read(route.file));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`demo error: ${e.message}`);
  }
}).listen(PORT, () => {
  const missing = Object.values(ROUTES).filter(r => r.file && !existsSync(join(ROOT, r.file)));
  console.log(`DesiSquare demo on http://localhost:${PORT}  (product app at /, prototype at /prototype, report at /report)`);
  if (missing.length) console.warn('missing files:', missing.map(m => m.file).join(', '));
});
