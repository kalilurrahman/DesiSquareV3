// Shared test harness: spawn the real server on an ephemeral port with an isolated data dir.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export async function startServer(extraEnv = {}) {
  const port = 18000 + Math.floor(Math.random() * 10000);
  const dataDir = mkdtempSync(join(tmpdir(), 'dsq-test-'));
  const child = spawn(process.execPath, [join(ROOT, 'server.mjs')], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      // Point integrations at ports nothing listens on so probes fail fast and stay offline.
      WA_BRIDGE_URL: 'http://127.0.0.1:1',
      GF_PROVISIONER_URL: 'http://127.0.0.1:1',
      GHOSTFOLIO_URL: 'http://127.0.0.1:1',
      DISCOURSE_URL: 'http://127.0.0.1:1',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (c) => { stderr += c; });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) });
      if (res.ok) return { base, stop: () => { child.kill(); rmSync(dataDir, { recursive: true, force: true }); }, child, dataDir };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error(`server did not start: ${stderr.slice(0, 500)}`);
}

// Cookie-jar fetch: keeps the session cookie across calls.
export function client(base) {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  };
}
