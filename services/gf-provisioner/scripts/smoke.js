// Offline smoke of the provisioning pipeline (no server, no Ghostfolio).
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { Ghostfolio } from '../src/ghostfolio.js';
import { provision, portfolioSummary, mintSsoLink } from '../src/provisioner.js';

const config = { mode: 'mock', ghostfolio: { url: 'http://localhost:3333', adminToken: '' }, sso: { secret: 'smoke', ttl: 120 } };
const store = new Store(path.join(os.tmpdir(), `gf-smoke-${Date.now()}.json`));
const ghostfolio = new Ghostfolio(config, () => {});
const deps = { store, ghostfolio, config, log: console.log };

console.log('register:', await provision({ userId: 42, username: 'rohit', email: 'rohit@example.com', emailVerified: true }, deps));
console.log('again:   ', await provision({ userId: 42, username: 'rohit', email: 'rohit@example.com', emailVerified: true }, deps));
console.log('summary: ', await portfolioSummary(42, deps));
console.log('sso link:', mintSsoLink(42, { store, config }));
