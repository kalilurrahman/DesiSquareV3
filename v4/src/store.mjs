// JSON-file store for the Phase-1 prototype. Zero dependencies.
// State lives in data/db.json (gitignored); first boot builds it from data/seed.json.
// Writes are atomic (tmp + rename) and debounced so a burst of reactions costs one write.
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

const now = () => Date.now();

export function createStore({ dataDir, seedDir, dbFile = 'db.json', seedFile = 'seed.json' } = {}) {
  const dbPath = join(dataDir, dbFile);
  const seedPath = join(seedDir ?? dataDir, seedFile);
  let state;
  let saveTimer = null;

  function buildFromSeed() {
    const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
    const t = now();
    const posts = seed.posts.map((p) => ({
      id: p.id,
      space: p.space,
      author: p.author,
      createdAt: t - p.minsAgo * 60_000,
      via: p.via || 'web',
      title: p.title,
      body: p.body,
      bodyFull: p.bodyFull || p.body,
      reactions: { ...p.reactions },
      removed: false,
      comments: (p.comments || []).map((c, i) => ({
        id: `${p.id}-c${i + 1}`,
        author: c.author,
        createdAt: t - c.minsAgo * 60_000,
        text: c.text,
        reactions: { like: 0 },
      })),
    }));
    return {
      seededAt: t,
      inviteCodes: seed.inviteCodes,
      countries: seed.countries,
      communities: seed.communities.map((c) => ({ ...c })),
      spaces: seed.spaces.map((s) => ({ ...s })),
      users: Object.fromEntries(seed.users.map((u) => [u.id, {
        experiments: { density: 'A', reactions: 'A', rail: 'A' },
        theme: 'warm',
        country: 'US',
        joined: u.id === 'wealth_guru_77' || u.id === 'moon_bets' ? [] : ['usinv'],
        requested: [],
        ghostfolio: null, // filled by provisioning: { accountId, provisionedAt, source }
        ...u,
      }])),
      waMappings: seed.waMappings,
      posts,
      reviewQueue: seed.reviewQueue.map((q) => ({ ...q, createdAt: t - q.minsAgo * 60_000 })),
      reactionsBy: {}, // `${userId}:${postId}` -> { helpful:true, ... } (toggle state per member)
      sessions: {},    // token -> { userId, createdAt }
      events: [],      // demo/ops log: wa inbound, webhooks, provisioning — NEVER contains phone numbers
    };
  }

  function load() {
    if (existsSync(dbPath)) {
      state = JSON.parse(readFileSync(dbPath, 'utf8'));
    } else {
      state = buildFromSeed();
      persistNow();
    }
    return state;
  }

  function persistNow() {
    mkdirSync(dirname(dbPath), { recursive: true });
    const tmp = `${dbPath}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(state, null, 1));
    renameSync(tmp, dbPath);
  }

  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try { persistNow(); } catch (err) { console.error('[store] persist failed:', err.message); }
    }, 250);
    saveTimer.unref?.();
  }

  function reset() {
    state = buildFromSeed();
    persistNow();
    return state;
  }

  function newId(prefix) {
    return `${prefix}_${randomBytes(5).toString('hex')}`;
  }

  load();
  return {
    get state() { return state; },
    save,
    persistNow,
    reset,
    newId,
  };
}
