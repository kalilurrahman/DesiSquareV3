// DesiSquare Phase-1 SPA — vanilla JS, no build step, no dependencies.
// The design prototype (Phase 1 mode) is the UX contract; tokens live in styles.css.

/* ---------------- state ---------------- */
const state = {
  boot: null,          // /api/bootstrap payload
  me: null,
  route: { name: 'feed', param: null },
  space: 'all',
  posts: [],
  feedSort: 'popular', // feed sort tab: popular | new (Popular is the default)
  teaser: null,        // /api/teaser payload for the signed-out landing
  calendar: null,      // /api/calendar payload (community calendar — moderators)
  leaderboard: null,   // /api/leaderboard payload (top contributors, by karma)
  post: null,          // active post detail
  profile: null,       // active profile payload
  profileTab: 'posts',
  review: null,
  demo: null,          // /api/demo/status payload
  search: '',
  searchData: null,    // /api/search payload for the active #/search view
  searchTab: 'all',    // all | posts | communities | comments | profiles
  maven: null,         // { id, perf, info } for the active #/maven view
  mavenTab: 'overview',// overview | stats | portfolio | chart
  admin: null,         // { overview, users } for the active #/admin view
  authMode: 'register',// landing auth card: register | signin
  authError: '',       // inline auth error (dup username, weak password…)
  ui: { menu: false, country: false, composer: false, flagFor: null, lab: false, demo: false, signin: false, joinGate: false, calAdd: false },
  draft: { title: '', body: '', space: 'help' },
  newSpace: '',        // admin: new space name draft
  reply: '',
  toastMsg: '',
};

const RX_META = [
  ['helpful', '👍', 'Helpful'],
  ['insightful', '💡', 'Insightful'],
  ['actionable', '📈', 'Actionable'],
  ['like', '❤️', 'Like'],
];
const FLAG_REASONS = ['Misleading', 'Low Effort', 'Spam', 'Violation', 'Marketing'];

/* ---------------- utilities ---------------- */
const $app = document.getElementById('app');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { state.me = null; render(); throw new Error('unauthorized'); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

let toastTimer = null;
// Toasts write straight to their own DOM host — never through render() — so a toast firing
// (or auto-dismissing 2.6 s later) can't rebuild the app and drop the user's focus/caret.
function toast(msg) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  host.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.innerHTML = ''; }, 2600);
}

function avatar(a, size = 34, extraClass = '', action = 'open-profile') {
  return `<span class="avatar ${extraClass}" data-action="${esc(action)}" data-user="${esc(a.id)}"
    style="width:${size}px;height:${size}px;background:${esc(a.color)};font-size:${Math.round(size * 0.36)}px;cursor:pointer">${esc(a.initials)}</span>`;
}

// Signed % helpers shared by the maven view — green ≥0, red <0. Never a currency symbol.
function fmtPct(n, withSign = true) {
  const v = Number(n) || 0;
  const sign = v > 0 && withSign ? '+' : '';
  return `${sign}${v.toFixed(v % 1 === 0 ? 0 : 1)}%`;
}
function pctClass(n) { return (Number(n) || 0) >= 0 ? 'pos' : 'neg'; }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Render an ISO-ish timestamp as a short "12 Jul" label; fall back to the raw string.
function shortDate(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s ?? '');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function authorBadges(a) {
  let html = '';
  if (a.isMaven) html += `<span class="badge badge-maven">MAVEN ✓</span>`;
  if (a.isModerator) html += `<span class="badge badge-mod">MOD</span>`;
  if (a.isSeeker) html += `<span class="badge badge-seeker">SEEKER</span>`;
  return html;
}

function exp(key) { return state.me?.experiments?.[key] ?? 'A'; }

/* ---------------- karma (engagement reputation — #9-bounded) ----------------
   Karma is earned from Helpful/Insightful/Actionable/Like reactions — NEVER from
   portfolio performance, never a currency, never a % return. When the backend supplies
   `karma`/`tier` on an author card those win; the seeded map below only fills in so the
   demo stands alone (matching the app's "degrade to seeded content" philosophy). */
// Tier bands mirror the backend's KARMA_TIERS so fallback labels never contradict live ones.
function tierFromKarma(n) {
  n = Number(n) || 0;
  return n >= 10000 ? 'Luminary' : n >= 2000 ? 'Anchor' : n >= 500 ? 'Trusted' : n >= 100 ? 'Regular' : 'New Arrival';
}
// Static last-resort karma (id → number) for the fully standalone demo. The live leaderboard
// (loaded for the rail) is preferred so feed bylines match the Top-contributors card exactly.
const KARMA_FALLBACK = {
  nikhil_cfa: 4200, priya_taxes: 3600, quant_aunty: 3100, arjun_quant: 2800,
  desisquare_mod: 2100, desisquare_admin: 1800, quiet_lotus: 1400, chai_and_charts: 1200,
  first_gen_saver: 980, dallas_desi: 760, new_investor: 60, wealth_guru_77: 40, moon_bets: 25,
};
// The live leaderboard row for a user id, if it has been loaded (carries real karma + tier).
function liveKarmaRow(id) {
  const rows = state.leaderboard?.contributors;
  if (!Array.isArray(rows)) return null;
  const hit = rows.find((x) => x.id === id);
  return hit && typeof hit.karma === 'number' ? hit : null;
}
function karmaOf(a) {
  if (!a) return null;
  if (typeof a.karma === 'number') return a.karma;        // author card / profile / search carry it
  const live = liveKarmaRow(a.id);
  if (live) return live.karma;                            // leaderboard-derived (real, matches rail)
  const f = KARMA_FALLBACK[a.id];
  return f != null ? f : null;                            // standalone-demo last resort
}
function tierOf(a) {
  if (!a) return null;
  if (a.tier) return a.tier;
  const live = liveKarmaRow(a.id);
  if (live && live.tier) return live.tier;
  const k = karmaOf(a);
  return k != null ? tierFromKarma(k) : null;
}
// Thousands → "2.8k". Below 1000 stays a plain integer. Never a $ or % — engagement only.
function fmtKarma(n) {
  n = Number(n) || 0;
  if (n >= 1000) { const k = n / 1000; return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`; }
  return String(Math.round(n));
}
const KARMA_TIP = 'Karma — earned from Helpful/Insightful/Actionable/Like reactions. Never from portfolio performance.';
function karmaChip(a) {
  const k = karmaOf(a);
  if (k == null) return '';
  return `<span class="karma-chip" title="${esc(KARMA_TIP)}">▲ ${esc(fmtKarma(k))}</span>`;
}
function tierChip(a) {
  const t = tierOf(a);
  if (!t) return '';
  const slug = String(t).toLowerCase().replace(/\s+/g, '-');
  return `<span class="tier-chip tier-${esc(slug)}" title="Reputation tier — from community engagement, never portfolio value.">${esc(t)}</span>`;
}

/* ---------------- popular / calendar / teaser / leaderboard fallbacks ----------------
   All engagement/percent-free. Real backend payloads (with popRank/score, events,
   contributors) take precedence; these keep the standalone demo whole. */
// Popularity score used only when the backend hasn't ranked the feed itself.
function postScore(p) {
  if (typeof p.score === 'number') return p.score;
  const rx = p.reactions && typeof p.reactions === 'object'
    ? Object.values(p.reactions).reduce((n, r) => n + (typeof r === 'number' ? r : (r?.n ?? 0)), 0) : 0;
  return rx * 2 + (p.commentCount ?? 0) * 3;
}
// Tag the top-3 with popRank (1..3) for the "#n POPULAR" chip; clear ranks on the New sort.
function decoratePopular(posts, sort) {
  const list = (posts ?? []).slice();
  if (sort !== 'popular') { list.forEach((p) => { p.popRank = null; }); return list; }
  const preRanked = list.some((p) => p.popRank);
  if (preRanked) {
    list.sort((a, b) => (a.popRank ?? 99) - (b.popRank ?? 99) || postScore(b) - postScore(a));
  } else {
    list.sort((a, b) => postScore(b) - postScore(a));
    list.forEach((p, i) => { p.popRank = i < 3 ? i + 1 : null; });
  }
  return list;
}

const TEASER_FALLBACK = { posts: [
  { id: 'p03', title: 'FEMA + FBAR: the NRI filing checklist I wish I had in year one', snippet: 'Every account, every threshold, in the order the IRS actually asks for them — FCNR, NRE/NRO, and the Schedule B trap.', space: 'Tax & FEMA', author: 'priya_taxes', reactions: 126, commentCount: 1, age: '2d' },
  { id: 'p07', title: 'Rental vs REIT for the diaspora landlord — a 10-year model', snippet: 'I ran the numbers on managing a Dallas rental from abroad against an equivalent REIT allocation. Sharing the sheet.', space: 'Real Estate', author: 'quant_aunty', reactions: 89, commentCount: 1, age: '3d' },
  { id: 'p01', title: 'Why I trimmed my US large-cap and what I rotated into', snippet: 'Not advice — my reasoning, on the record: valuations, the rupee, and a barbell I can actually sleep with.', space: 'Stocks & ETFs', author: 'nikhil_cfa', reactions: 77, commentCount: 2, age: '1d' },
  { id: 'p08', title: 'First 401(k): the three-fund lazy portfolio, desi edition', snippet: 'Match first, then Roth, then taxable. Here is the exact fund split and the why behind each slice.', space: 'Ask the community', author: 'first_gen_saver', reactions: 82, commentCount: 2, age: '4d' },
]};

const CALENDAR_FALLBACK = { events: [
  { id: 'ev1', date: '2026-07-28', title: 'AMA: FCNR vs US CDs in a rate-cut cycle', host: 'nikhil_cfa', kind: 'Maven AMA', scope: 'US Investment' },
  { id: 'ev2', date: '2026-08-04', title: 'Tax clinic: FBAR & FEMA questions, live', host: 'priya_taxes', kind: 'Live session', scope: 'Tax & FEMA' },
  { id: 'ev3', date: '2026-08-12', title: 'Community townhall — moderation & roadmap', host: 'desisquare_mod', kind: 'Townhall', scope: 'All communities' },
]};

function calEvents() {
  const evs = state.calendar?.events;
  return Array.isArray(evs) ? evs : CALENDAR_FALLBACK.events;
}

function leaderboardContributors() {
  const backend = state.leaderboard?.contributors;
  if (Array.isArray(backend) && backend.length) return backend.slice(0, 5);
  const mavens = new Set(['nikhil_cfa', 'priya_taxes', 'arjun_quant']);
  return Object.entries(KARMA_FALLBACK)
    .map(([id, karma]) => ({ id, name: id, karma, tier: tierFromKarma(karma), isMaven: mavens.has(id) }))
    .sort((a, b) => b.karma - a.karma)
    .slice(0, 5);
}

// Best-effort GET that returns a fallback (never throws / toasts) — for endpoints the
// parallel backend may not expose yet. Keeps existing views working and the console clean.
async function apiSafe(path, fallback) {
  try { return await api(path); } catch { return fallback; }
}

// Standalone-demo copy of the karma rules (the live /api/karma/rules is preferred). Mirrors the
// backend's real KARMA_WEIGHTS/KARMA_TIERS so the "How karma works" page renders offline too.
const KARMA_RULES_FALLBACK = {
  statement: 'Karma measures community engagement — never money. Portfolio value and % returns can never affect it (#9).',
  earn: [
    { action: '“Actionable” reaction received on your post or comment', points: 3 },
    { action: '“Helpful” reaction received on your post or comment', points: 3 },
    { action: '“Insightful” reaction received on your post or comment', points: 2 },
    { action: '“Like” reaction received on your post or comment', points: 1 },
    { action: 'Your reply is marked the accepted answer', points: 5, note: 'Phase-2 — accepted answers are not tracked yet' },
  ],
  tiers: [{ name: 'New Arrival', min: 0 }, { name: 'Regular', min: 100 }, { name: 'Trusted', min: 500 }, { name: 'Anchor', min: 2000 }, { name: 'Luminary', min: 10000 }],
  antiGaming: [
    'You cannot react to your own posts, so you cannot award yourself karma.',
    'Content removed by moderation grants no karma — and its author is stripped of any karma it earned.',
    'Karma only ever comes from reactions others give your contributions; it never uses portfolio value or returns.',
  ],
  changelog: [{ date: '2026-07-21', note: 'Initial weights published: Actionable/Helpful +3, Insightful +2, Like +1, accepted answer +5.' }],
};

// EP-03 Hub fallback — shown if /api/hub is briefly unreachable (the app degrades, never blanks).
const HUB_FALLBACK = { experts: [], services: [], guides: [] };

/* ---------------- routing ---------------- */
function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  // Split on the FIRST slash only — a search query can itself contain slashes.
  const idx = hash.indexOf('/');
  const name = idx < 0 ? hash : hash.slice(0, idx);
  const rawParam = idx < 0 ? '' : hash.slice(idx + 1);
  const known = ['feed', 'post', 'communities', 'u', 'me', 'settings', 'review', 'register', 'search', 'maven', 'admin', 'karma', 'hub'];
  let param = null;
  if (rawParam) { try { param = decodeURIComponent(rawParam); } catch { param = rawParam; } }
  state.route = known.includes(name) ? { name, param } : { name: 'feed', param: null };
}

function nav(hash) { location.hash = hash; }

window.addEventListener('hashchange', async () => {
  parseRoute();
  state.ui.menu = false; state.ui.country = false; state.ui.flagFor = null;
  await loadRouteData();
  window.scrollTo(0, 0);
  render();
});

let routeToken = 0;
async function loadRouteData() {
  if (!state.me) return;
  const r = state.route;
  const token = ++routeToken; // guard: a slower earlier load must not overwrite a newer route
  // Clear the slot we're about to fill so stale content never shows under the new URL.
  if (r.name === 'post') state.post = null;
  else if (r.name === 'u' || r.name === 'me') state.profile = null;
  else if (r.name === 'review') state.review = null;
  else if (r.name === 'search') state.searchData = null;
  else if (r.name === 'maven') state.maven = null;
  else if (r.name === 'admin') state.admin = null;
  try {
    if (r.name === 'feed') {
      const sort = state.feedSort || 'popular';
      const [feed, calendar, leaderboard] = await Promise.all([
        api(`/api/feed?space=${encodeURIComponent(state.space)}&sort=${encodeURIComponent(sort)}`),
        apiSafe('/api/calendar', state.calendar ?? CALENDAR_FALLBACK),
        apiSafe('/api/leaderboard', state.leaderboard ?? { contributors: leaderboardContributors() }),
      ]);
      if (token !== routeToken) return;
      state.posts = decoratePopular(feed.posts, sort);
      state.calendar = calendar;
      state.leaderboard = leaderboard;
    } else if (r.name === 'post' && r.param) {
      const { post } = await api(`/api/posts/${encodeURIComponent(r.param)}`);
      if (token !== routeToken) return;
      state.post = post;
    } else if (r.name === 'u' && r.param) {
      const profile = await api(`/api/users/${encodeURIComponent(r.param)}`);
      if (token !== routeToken) return;
      state.profile = profile;
      state.profileTab = 'posts';
    } else if (r.name === 'me') {
      const profile = await api(`/api/users/${encodeURIComponent(state.me.id)}`);
      if (token !== routeToken) return;
      state.profile = profile;
      state.profileTab = 'posts';
    } else if (r.name === 'review' && state.me.isModerator) {
      const [review, calendar] = await Promise.all([
        api('/api/review-queue'),
        apiSafe('/api/calendar', state.calendar ?? CALENDAR_FALLBACK),
      ]);
      if (token !== routeToken) return;
      state.review = review;
      state.calendar = calendar;
    } else if (r.name === 'review') {
      // Non-moderator deep-linked to #/review: fall back to the feed so they don't see a
      // false 'nothing here yet' empty state built from unloaded data.
      const { posts } = await api(`/api/feed?space=${encodeURIComponent(state.space)}`);
      if (token !== routeToken) return;
      state.posts = posts;
      state.route = { name: 'feed', param: null };
    } else if (r.name === 'search') {
      state.search = r.param ?? '';
      state.searchTab = 'all';
      const q = (r.param ?? '').trim();
      if (!q) { state.searchData = { q: '', counts: { all: 0, posts: 0, communities: 0, comments: 0, profiles: 0 }, posts: [], communities: [], comments: [], profiles: [] }; return; }
      const data = await api(`/api/search?q=${encodeURIComponent(q)}&tab=${encodeURIComponent(state.searchTab)}`);
      if (token !== routeToken) return;
      state.searchData = data;
    } else if (r.name === 'maven' && r.param) {
      // Two calls: the % performance engine + the author card for the header. Neither carries $.
      const [perf, profile] = await Promise.all([
        api(`/api/mavens/${encodeURIComponent(r.param)}/performance`),
        api(`/api/users/${encodeURIComponent(r.param)}`).catch(() => null),
      ]);
      if (token !== routeToken) return;
      const fromBoot = (state.boot.mavens ?? []).find((m) => m.id === r.param);
      const info = perf.profile || profile?.profile || fromBoot || { id: r.param, name: r.param };
      state.maven = { id: r.param, perf, info, reactionsReceived: profile?.profile?.reactionsReceived ?? null };
      state.mavenTab = 'overview';
    } else if (r.name === 'admin' && state.me.isAdmin) {
      const [overview, usersResp] = await Promise.all([
        api('/api/admin/overview').catch(() => null),
        api('/api/admin/users').catch(() => null),
      ]);
      if (token !== routeToken) return;
      state.admin = {
        overview: overview ?? {},
        users: Array.isArray(usersResp) ? usersResp : (usersResp?.users ?? []),
      };
    } else if (r.name === 'admin') {
      // Non-admin deep-linked to #/admin: fall back to the feed (mirrors the review-queue guard).
      const { posts } = await api(`/api/feed?space=${encodeURIComponent(state.space)}`);
      if (token !== routeToken) return;
      state.posts = posts;
      state.route = { name: 'feed', param: null };
    } else if (r.name === 'register') {
      // Signed-in user hit #/register — nothing to load; render() will fall through to the feed.
      state.route = { name: 'feed', param: null };
    } else if (r.name === 'karma') {
      state.karmaRules = await apiSafe('/api/karma/rules', state.karmaRules ?? KARMA_RULES_FALLBACK);
      if (token !== routeToken) return;
    } else if (r.name === 'hub') {
      const [hub, bookings] = await Promise.all([
        apiSafe('/api/hub', state.hub ?? HUB_FALLBACK),
        apiSafe('/api/hub/bookings', { bookings: state.hubBookings ?? [] }),
      ]);
      if (token !== routeToken) return;
      state.hub = hub;
      state.hubBookings = bookings.bookings ?? [];
    }
  } catch (err) {
    if (token === routeToken && err.message !== 'unauthorized') toast(err.message);
  }
}

/* ---------------- render: landing teaser (general-visitor "Popular this week") ----------------
   A curated public taste of the community. Cards are Reddit-style summaries; clicking ANY card
   opens the join/register gate — never the full thread (#7-A: full discussions are member-only). */
function renderTeaser() {
  const posts = (state.teaser?.posts ?? TEASER_FALLBACK.posts);
  if (!posts.length) return '';
  return `
  <div class="teaser">
    <div class="teaser-head">
      <span class="teaser-flame">▲</span>
      <span class="teaser-title-lbl">Popular this week</span>
      <span class="teaser-sub">A curated public preview</span>
    </div>
    <div class="teaser-list">
      ${posts.map((p) => `
        <button class="card teaser-card" data-action="teaser-gate" aria-label="Join to read: ${esc(p.title)}">
          <div class="teaser-meta"><span class="teaser-space">${esc(p.space ?? '')}</span> · ${esc(authorName(p.author))} · ${esc(p.age ?? '')}</div>
          <div class="teaser-card-title">${esc(p.title)}</div>
          ${p.snippet ? `<div class="teaser-snip">${esc(p.snippet)}</div>` : ''}
          <div class="teaser-foot">
            <span>▲ ${reactionTotal(p.reactions)} reactions</span>
            <span>${p.commentCount ?? 0} ${p.commentCount === 1 ? 'comment' : 'comments'}</span>
            <span class="teaser-lock">🔒 Join to read</span>
          </div>
        </button>`).join('')}
    </div>
    <div class="teaser-note">A taste of the community — join to read full discussions.</div>
  </div>`;
}

/* ---------------- render: landing ---------------- */
function renderLanding() {
  const b = state.boot ?? { stats: { members: '—', online: '—', mavens: '—', communities: '—' }, demoAccounts: [] };
  return `
  <div class="landing">
    <div class="landing-top">
      <span class="logo-mark" style="width:11px;height:11px"></span>
      <span class="logo-word" style="font-size:19px">DesiSquare</span>
      <span style="flex:1"></span>
      <button class="btn btn-ghost" style="border-radius:999px" data-action="toggle-signin">Explore as a demo persona</button>
    </div>
    <div class="landing-hero">
      <h1>Where desi money questions get <em>trusted</em> answers.</h1>
      <p class="landing-sub">A minimalist, trust-driven investment community for the diaspora — mavens, seekers and peers collaborating in public, on the web and on WhatsApp. Pseudonymous by default. Free to join.</p>
      <div class="landing-stats">
        <span><span class="dot"></span><b>${esc(b.stats.members.toLocaleString?.() ?? b.stats.members)}</b> members</span>
        <span><span class="dot"></span><b>${esc(String(b.stats.online))}</b> online now</span>
        <span>${esc(String(b.stats.mavens))} credential-verified mavens</span>
        <span>${esc(String(b.stats.communities))} US communities · more countries soon</span>
      </div>
      <div class="card landing-auth">
        <div class="auth-tabs">
          <button class="auth-tab ${state.authMode === 'register' ? 'on' : ''}" data-action="auth-mode" data-mode="register">Create account</button>
          <button class="auth-tab ${state.authMode === 'signin' ? 'on' : ''}" data-action="auth-mode" data-mode="signin">Sign in</button>
        </div>
        ${state.authMode === 'register' ? `
          <div class="auth-form">
            ${state.ui.joinGate ? `<div class="join-gate-note">🔒 Join free to read the full discussion — it only takes a minute.</div>` : ''}
            <input id="reg-email" class="input" type="email" placeholder="Email — verified, never shown to members" autocomplete="off">
            <input id="reg-username" class="input" placeholder="Username — your public pseudonym" autocomplete="off">
            <input id="reg-password" class="input" type="password" placeholder="Password — 8+ characters" autocomplete="new-password">
            ${state.authError ? `<div class="auth-error">${esc(state.authError)}</div>` : ''}
            <button class="btn btn-primary" data-action="register">Create account</button>
            <div class="auth-foot">Pseudonymous by default · we email a verification, never your number. Free to join.</div>
          </div>` : `
          <div class="auth-form">
            <input id="login-username" class="input" placeholder="Username" autocomplete="off">
            <input id="login-password" class="input" type="password" placeholder="Password" autocomplete="current-password">
            ${state.authError ? `<div class="auth-error">${esc(state.authError)}</div>` : ''}
            <button class="btn btn-primary" data-action="signin-password">Sign in</button>
            <div class="auth-foot">Welcome back. Your session lasts two weeks on this device.</div>
          </div>`}
      </div>
      ${renderTeaser()}
      ${state.ui.signin ? `
      <div class="card landing-signin-panel">
        <div style="font-size:13.5px;font-weight:700">Explore as a demo persona</div>
        <div style="font-size:12px;color:var(--dim);margin-top:2px">This is the runnable Phase-1 prototype; pick an identity to explore with.</div>
        <div class="demo-accounts">
          ${b.demoAccounts.map((a) => `
            <button class="demo-account" data-action="demo-signin" data-user="${esc(a.id)}">
              <span class="avatar" style="width:34px;height:34px;background:${esc(a.color)};font-size:12px">${esc(a.initials)}</span>
              <span class="who"><b>${esc(a.name)}</b><span>${esc(a.label)}</span></span>
              <span style="color:var(--teal);font-weight:700;font-size:12px">Sign in →</span>
            </button>`).join('')}
        </div>
      </div>` : ''}
      <div class="landing-cards">
        <div class="card"><div class="t">Experts on the record</div><div class="d">Mavens are credential-verified and wear the badge in every thread — outcomes over claims, in public.</div></div>
        <div class="card"><div class="t">Lives where you chat</div><div class="d">Join from WhatsApp, chat from WhatsApp, attend live sessions there — the web keeps the durable record.</div></div>
        <div class="card"><div class="t">Pseudonymous by default</div><div class="d">Money talk needs safety: phone numbers are never shown, real names are optional, reputation is earned.</div></div>
      </div>
      <div class="landing-join">
        <div class="card primary">
          <div style="font-size:13.5px;font-weight:700">I have an invite</div>
          <div class="row">
            <input id="invite-code" class="input" placeholder="Invite code · DSQ-····" autocomplete="off">
            <input id="invite-name" class="input" placeholder="Pick a pseudonym" autocomplete="off" style="max-width:150px">
            <button class="btn btn-primary" data-action="join-invite">Join</button>
          </div>
          <div style="font-size:11px;color:var(--faint);margin-top:8px">Demo code: <b style="color:var(--dim)">DSQ-2026</b></div>
        </div>
        <div class="card">
          <div style="font-size:13.5px;font-weight:700">Request membership</div>
          <div class="row">
            <input id="voucher" class="input" placeholder="A member who knows you (optional)" autocomplete="off">
            <button class="btn btn-ghost" data-action="request-join">Request to join</button>
          </div>
        </div>
      </div>
      <div class="landing-foot">Pseudonymous by default · phone numbers never shown · community content is not investment advice</div>
    </div>
  </div>`;
}

/* ---------------- render: chrome ---------------- */
function renderTopbar() {
  const me = state.me;
  const country = state.boot.countries?.find((c) => c.code === me.country);
  return `
  <div class="topbar">
    <div class="topbar-inner">
      <div class="brand" data-action="go" data-to="feed">
        <span class="logo-mark"></span><span class="logo-word">DesiSquare</span>
      </div>
      <input class="search" id="search" placeholder="Search posts, communities, people…" value="${esc(state.search)}" autocomplete="off">
      <span class="topbar-spring"></span>
      <button class="pill-btn" data-action="toggle-lab" title="A/B experiments — switch live">🧪 <span>A/B Lab</span></button>
      <div style="position:relative;flex:none">
        <button class="pill-btn" data-action="toggle-country"><span>${esc(me.country)}</span><span class="caret">▾</span></button>
        ${state.ui.country ? `
        <div class="menu" style="width:220px">
          <div class="section-label" style="padding:8px 10px 4px">Your NRI home base</div>
          ${(state.boot.countries ?? []).map((c) => `
            <div class="menu-row ${c.code === me.country ? 'on' : ''}" data-action="pick-country" data-code="${esc(c.code)}">
              <span>${esc(c.name)}</span>
              <span class="count">${c.communityCount} ${c.communityCount === 1 ? 'community' : 'communities'}</span>
            </div>`).join('')}
        </div>` : ''}
      </div>
      <div style="position:relative;flex:none">
        <button class="avatar avatar-btn" data-action="toggle-menu" style="background:${esc(me.color)}" aria-label="Account menu">${esc(me.initials)}</button>
        ${state.ui.menu ? `
        <div class="menu">
          <div class="menu-head" data-action="go" data-to="me">
            <span class="avatar" style="width:34px;height:34px;background:${esc(me.color)};font-size:12px">${esc(me.initials)}</span>
            <span style="flex:1;min-width:0">
              <span style="display:block;font-size:13px;font-weight:700">${esc(me.name)}</span>
              <span style="display:block;font-size:11.5px;color:var(--dim)">${me.isModerator ? 'Moderator' : me.groups?.includes('mavens') ? 'Maven ✓' : 'Peer'} · desi-verified ✓</span>
            </span>
          </div>
          <div class="hairline-v"></div>
          <div class="menu-item" data-action="go" data-to="me">My profile — posts, comments</div>
          <div class="menu-item" data-action="go" data-to="settings">Settings</div>
          ${me.isModerator ? `<div class="menu-item" data-action="go" data-to="review">Review queue${me.pendingFlags ? ` <span class="count-pill" style="background:var(--saffron-tint);color:var(--saffron);font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px">${me.pendingFlags}</span>` : ''}</div>` : ''}
          ${me.isAdmin ? `<div class="menu-item" data-action="go" data-to="admin">Admin panel</div>` : ''}
          <div class="hairline-v"></div>
          <div class="menu-item danger" data-action="sign-out">Sign out</div>
        </div>` : ''}
      </div>
    </div>
    <div class="scope-strip">
      <div class="scope-strip-inner"><b>Phase 1 · Core community</b> — communities &amp; spaces, feed + 9 reactions, WhatsApp sync, Ghostfolio portfolio, pseudonyms &amp; phone privacy — native Discourse config + two small scripts.</div>
    </div>
  </div>`;
}

function renderSidebar() {
  const me = state.me;
  const r = state.route.name;
  const commonName = state.boot.communities?.find((c) => c.type === 'common')?.name ?? 'US Investment';
  return `
  <div class="sidebar">
    <nav style="display:flex;flex-direction:column;gap:2px">
      <div class="nav-item ${r === 'feed' || r === 'post' ? 'on' : ''}" data-action="go" data-to="feed">Feed</div>
      <div class="nav-item ${r === 'communities' ? 'on' : ''}" data-action="go" data-to="communities">Communities</div>
      <div class="nav-item ${r === 'hub' ? 'on' : ''}" data-action="go" data-to="hub">Experts &amp; services</div>
      <div class="nav-item ${r === 'settings' ? 'on' : ''}" data-action="go" data-to="settings">Settings</div>
      ${me.isModerator ? `<div class="nav-item ${r === 'review' ? 'on' : ''}" data-action="go" data-to="review"><span style="flex:1">Review queue</span>${me.pendingFlags ? `<span class="count-pill">${me.pendingFlags}</span>` : ''}</div>` : ''}
      ${me.isAdmin ? `<div class="nav-item ${r === 'admin' ? 'on' : ''}" data-action="go" data-to="admin">Admin</div>` : ''}
    </nav>
    <div class="side-spaces">
      <div class="section-label" style="padding:0 12px 6px">Spaces · ${esc(commonName)}</div>
      <div style="display:flex;flex-direction:column;gap:1px">
        <div class="space-item ${state.space === 'all' ? 'on' : ''}" data-action="pick-space" data-space="all"><span style="flex:1">All posts</span></div>
        ${(state.boot.spaces ?? []).map((s) => `
          <div class="space-item ${state.space === s.id ? 'on' : ''}" data-action="pick-space" data-space="${esc(s.id)}">
            <span style="flex:1">${esc(s.name)}</span><span class="n">${s.count}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="card wa-card" data-action="go" data-to="settings">
      <div class="t"><span class="dot" style="margin:0"></span>WhatsApp ${me.waLinked ? 'connected' : 'not linked'}</div>
      <div class="d">${me.waLinked ? 'Chat from WhatsApp, it lands here. Manage in Settings.' : 'Link your WhatsApp in Settings to mirror group chats.'}</div>
    </div>
  </div>`;
}

/* ---------------- render: feed ---------------- */
function reactionPills(post, context = 'feed') {
  const compact = exp('reactions') === 'B';
  return RX_META.map(([key, emoji, label]) => {
    const r = post.reactions[key];
    const text = compact
      ? `${emoji}${r.n ? ` ${r.n}` : ''}`
      : `${emoji} ${label}${r.n ? ` ${r.n}` : ''}`;
    return `<button class="rx-pill ${r.on ? 'on' : ''} ${compact ? 'compact' : ''}" title="${esc(label)}"
      data-action="react" data-post="${esc(post.id)}" data-type="${key}" data-context="${context}">${text}</button>`;
  }).join('');
}

function flagMenu(post) {
  if (state.ui.flagFor !== post.id) return '';
  return `
  <div class="flag-menu">
    <div class="head">Flag with a reason</div>
    ${FLAG_REASONS.map((r) => `<div class="flag-option" data-action="flag" data-post="${esc(post.id)}" data-reason="${esc(r)}">${esc(r)}</div>`).join('')}
    <div class="foot">Goes privately to the review queue — never shown publicly.</div>
  </div>`;
}

function postCard(post) {
  const a = post.author;
  return `
  <article class="card post-card" data-search="${esc((post.title + ' ' + post.body + ' ' + a.name).toLowerCase())}">
    ${post.popRank ? `<div class="pop-rank">#${post.popRank} POPULAR</div>` : ''}
    <div class="post-head">
      ${avatar(a, exp('density') === 'B' ? 26 : 34)}
      <div class="who">
        <div class="line">
          <span class="name" data-action="open-profile" data-user="${esc(a.id)}">${esc(a.name)}</span>
          ${karmaChip(a)}
          ${authorBadges(a)}
          ${post.via === 'whatsapp' ? '<span class="badge badge-wa">via WhatsApp</span>' : ''}
        </div>
        <div class="meta">${esc(post.spaceName)} · ${esc(post.timeAgo)}${a.credential ? ` · ${esc(a.credential)}` : ''}</div>
      </div>
      <div style="position:relative">
        <button class="flag-btn" title="Flag with a reason" data-action="toggle-flag" data-post="${esc(post.id)}">⋯</button>
        ${flagMenu(post)}
      </div>
    </div>
    <div class="post-body" data-action="open-post" data-post="${esc(post.id)}">
      <div class="post-title">${esc(post.title)}</div>
      <div class="post-excerpt">${esc(post.body)}</div>
    </div>
    ${post.myFlag ? `<div class="post-flagged-note">Flagged as “${esc(post.myFlag)}” — sent privately to the review queue.</div>` : ''}
    <div class="post-foot">
      ${reactionPills(post)}
      <button class="comments-link" data-action="open-post" data-post="${esc(post.id)}">${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}</button>
    </div>
  </article>`;
}

function renderComposer() {
  const me = state.me;
  if (!state.ui.composer) {
    return `
    <div class="card composer">
      <div class="composer-closed">
        ${avatar({ id: me.id, color: me.color, initials: me.initials }, 34)}
        <button class="composer-hint" data-action="open-composer">Share an idea or a question…</button>
      </div>
    </div>`;
  }
  return `
  <div class="card composer">
    <div class="composer-open">
      <input class="composer-title" id="draft-title" placeholder="Title — make it searchable for the next person" value="${esc(state.draft.title)}" autocomplete="off">
      <textarea class="composer-body" id="draft-body" placeholder="Details, numbers, links. Public-first — no DMs-for-advice.">${esc(state.draft.body)}</textarea>
      <div class="composer-spaces">
        <span class="lbl">Space</span>
        ${(state.boot.spaces ?? []).map((s) => `<button class="chip ${state.draft.space === s.id ? 'on' : ''}" data-action="pick-draft-space" data-space="${esc(s.id)}">${esc(s.name)}</button>`).join('')}
      </div>
      <div class="composer-actions">
        <button class="btn btn-quiet" data-action="close-composer">Cancel</button>
        <button class="btn btn-primary" data-action="submit-post">Post</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- shared: community calendar + top contributors ----------------
   The calendar is a MODERATOR surface (moderators ≠ mavens): mods add/remove events; the
   panel renders in the moderation view and, compact, in the feed right-rail. Top contributors
   ranks by KARMA (engagement) only — never portfolio value or % returns (#9). */
function calDateBlock(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `<span class="m">—</span><span class="d">·</span>`;
  return `<span class="m">${MONTHS[d.getUTCMonth()]}</span><span class="d">${d.getUTCDate()}</span>`;
}

function calendarPanel({ mod = false, compact = false } = {}) {
  const events = calEvents();
  return `
  <div class="cal-panel ${compact ? 'compact' : ''}">
    <div class="cal-head">
      <span class="cal-title">Community calendar</span>
      <span class="cal-managed">managed here</span>
    </div>
    <div class="cal-note">moderators ≠ mavens — sessions are hosted here, performance lives on maven profiles.</div>
    <div class="cal-list">
      ${events.length ? events.map((ev) => `
        <div class="cal-event">
          <div class="cal-date">${calDateBlock(ev.date)}</div>
          <div class="cal-mid">
            <div class="cal-ev-title">${esc(ev.title)}</div>
            <div class="cal-ev-sub">${esc(authorName(ev.host))}${ev.kind ? ` · ${esc(ev.kind)}` : ''}</div>
          </div>
          <span class="cal-scope">${esc(ev.scope ?? '')}</span>
          ${mod ? `<button class="cal-del" data-action="cal-remove" data-id="${esc(ev.id)}" title="Remove event" aria-label="Remove event">×</button>` : ''}
        </div>`).join('') : `<div class="cal-empty">No events scheduled.</div>`}
    </div>
    ${mod ? `
      <div class="cal-tools">
        <button class="btn btn-ghost cal-add-btn" data-action="toggle-cal-add">${state.ui.calAdd ? '× Cancel' : '+ Add event'}</button>
      </div>
      ${state.ui.calAdd ? `
      <div class="cal-form">
        <input id="cal-f-title" class="input" placeholder="Event title" autocomplete="off">
        <div class="cal-form-row">
          <input id="cal-f-date" class="input" type="date" value="${esc(new Date().toISOString().slice(0, 10))}">
          <input id="cal-f-kind" class="input" placeholder="Kind — e.g. Maven AMA" autocomplete="off">
        </div>
        <div class="cal-form-row">
          <input id="cal-f-host" class="input" placeholder="Host" autocomplete="off">
          <input id="cal-f-scope" class="input" placeholder="Scope — e.g. US Investment" autocomplete="off">
        </div>
        <button class="btn btn-primary" data-action="cal-add">Add to calendar</button>
      </div>` : ''}` : ''}
  </div>`;
}

function topContributorsCard() {
  const rows = leaderboardContributors();
  return `
  <div class="card lb-card">
    <div class="section-label">Top contributors</div>
    <div class="lb-sub">by karma, never by returns</div>
    <div class="lb-list">
      ${rows.map((c, i) => {
        const dest = c.isMaven ? 'open-maven' : 'open-profile';
        return `
        <div class="lb-row">
          <span class="lb-rank">${i + 1}</span>
          <span class="lb-name" data-action="${dest}" data-user="${esc(c.id)}">${esc(c.name)}${c.isMaven ? ' <span class="badge badge-maven" style="font-size:9px;padding:0 5px">✓</span>' : ''}</span>
          ${tierChip(c)}
          <span class="lb-karma" title="${esc(KARMA_TIP)}">▲ ${esc(fmtKarma(c.karma))}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="lb-note">Karma reflects Helpful / Insightful / Actionable / Like reactions — engagement, not money. <a class="lb-how" data-action="go" data-to="karma">How karma works →</a></div>
  </div>`;
}

/* ---------------- "How karma works" — the transparency page (story 21.7) ----------------
   Shows exactly how points are awarded, the tier ladder, the anti-gaming rules and a dated
   changelog. Sourced live from /api/karma/rules (the SAME constants that award karma), so what
   members read here can never drift from what the code does. */
function renderKarma() {
  const k = state.karmaRules ?? KARMA_RULES_FALLBACK;
  return `
  <section class="karma-page">
    <a class="back-link" data-action="go" data-to="feed">← Back to feed</a>
    <h1 class="karma-h1">How karma works</h1>
    <p class="karma-statement">${esc(k.statement)}</p>

    <div class="card karma-card">
      <div class="section-label">Earning karma</div>
      <table class="karma-table">
        <thead><tr><th>Action</th><th class="pts">Points</th></tr></thead>
        <tbody>
          ${k.earn.map((e) => `<tr>
            <td>${esc(e.action)}${e.note ? ` <span class="karma-soon">${esc(e.note)}</span>` : ''}</td>
            <td class="pts">${e.points >= 0 ? '+' : ''}${esc(String(e.points))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="karma-note">Points come from reactions <b>others</b> give your posts and comments. Never from portfolio value or returns.</div>
    </div>

    <div class="card karma-card">
      <div class="section-label">Tiers</div>
      <div class="karma-tiers">
        ${k.tiers.map((t) => `<div class="karma-tier-row"><span class="tier-chip tier-${esc(t.name.toLowerCase().replace(/\\s+/g, '-'))}">${esc(t.name)}</span><span class="karma-tier-min">${esc(String(t.min))}+ karma</span></div>`).join('')}
      </div>
    </div>

    <div class="card karma-card">
      <div class="section-label">Anti-gaming</div>
      <ul class="karma-rules">${k.antiGaming.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>

    <div class="card karma-card">
      <div class="section-label">Changelog</div>
      <div class="karma-changelog">${k.changelog.map((c) => `<div class="karma-cl-row"><span class="karma-cl-date">${esc(c.date)}</span><span>${esc(c.note)}</span></div>`).join('')}</div>
      <div class="karma-note">Weight changes are always dated here — never silent.</div>
    </div>
    <div class="disclaimer" style="margin-top:14px">Recognition ranks engagement, never money (#9). Maven track records live on maven profiles, as percentages only.</div>
  </section>`;
}

/* ---------------- render: Services & Products Hub (EP-03, percent-only, #4/#8) ---------------- */
function renderHub() {
  const hub = state.hub ?? HUB_FALLBACK;
  const experts = hub.experts ?? [];
  const services = hub.services ?? [];
  const guides = hub.guides ?? [];
  const bookings = state.hubBookings ?? [];
  const nameOf = (id) => experts.find((e) => e.id === id)?.name ?? id;
  const svcTitleOf = (id) => services.find((s) => s.id === id)?.title ?? id;

  const expertCard = (e) => `
    <div class="hub-expert">
      <div class="hub-expert-top">
        <span class="hub-av" style="background:${esc(e.color || '#4A5568')}">${esc(e.initials || '–')}</span>
        <div class="hub-expert-id">
          <div class="hub-expert-name">${esc(e.name)} <span class="hub-flair">✓ ${esc(e.flair || 'Verified')}</span></div>
          ${e.credential ? `<div class="hub-cred">${esc(e.credential)}</div>` : ''}
        </div>
        ${typeof e.trackRecordPct === 'number' ? `<div class="hub-track ${e.trackRecordPct < 0 ? 'neg' : 'pos'}"><div class="hub-track-v">${fmtPct(e.trackRecordPct)}</div><div class="hub-track-l">track record</div></div>` : ''}
      </div>
      ${e.tagline ? `<div class="hub-tagline">${esc(e.tagline)}</div>` : ''}
      <div class="hub-chips">
        ${(e.specialties || []).map((s) => `<span class="hub-chip">${esc(s)}</span>`).join('')}
        ${(e.corridors || []).map((c) => `<span class="hub-chip corridor">${esc(c)}</span>`).join('')}
      </div>
      <div class="hub-expert-foot">${esc(String(e.servicesCount || 0))} service${e.servicesCount === 1 ? '' : 's'} · <a class="hub-link" data-action="go" data-to="maven/${esc(e.id)}">View track record →</a></div>
    </div>`;

  const serviceRow = (s) => `
    <div class="hub-service">
      <div class="hub-service-main">
        <div class="hub-service-title">${esc(s.title)}</div>
        <div class="hub-service-meta">${esc(nameOf(s.expertId))} · ${esc(String(s.durationMin))} min · ${esc(s.format === 'chat' ? 'chat' : 'video')}</div>
      </div>
      <span class="hub-tier tier-${esc(String(s.priceTier).toLowerCase())}">${esc(s.priceTier)}</span>
      <button class="btn btn-sm hub-book" data-action="hub-book" data-svc="${esc(s.id)}">Request</button>
    </div>`;

  const guideRow = (g) => `
    <div class="hub-guide">
      <div class="hub-guide-title">${esc(g.title)}</div>
      <div class="hub-guide-sum">${esc(g.summary || '')}</div>
      <div class="hub-guide-meta">${(g.tags || []).map((t) => `<span class="hub-chip">${esc(t)}</span>`).join('')} <span class="hub-guide-by">by ${esc(nameOf(g.author) || g.author)}</span></div>
    </div>`;

  return `
  <section class="hub-page">
    <div class="hub-head">
      <h1 class="hub-h1">Experts &amp; services</h1>
      <p class="hub-sub">Verified mavens, their services, and canonical guides distilled from the community's best answers. Track records are shown as percentages only — never dollar amounts.</p>
    </div>

    <div class="section-label">Verified experts</div>
    <div class="hub-experts">${experts.length ? experts.map(expertCard).join('') : '<div class="hub-empty">No experts listed yet.</div>'}</div>

    <div class="section-label" style="margin-top:20px">Services</div>
    <div class="card hub-services">${services.length ? services.map(serviceRow).join('') : '<div class="hub-empty">No services yet.</div>'}</div>

    ${bookings.length ? `<div class="section-label" style="margin-top:20px">Your booking requests</div>
    <div class="card hub-bookings">${bookings.map((b) => `<div class="hub-booking"><span>${esc(svcTitleOf(b.serviceId))}</span><span class="hub-booking-status">${esc(b.status)}</span></div>`).join('')}</div>` : ''}

    <div class="section-label" style="margin-top:20px">Canonical guides</div>
    <div class="hub-guides">${guides.length ? guides.map(guideRow).join('') : '<div class="hub-empty">No guides yet.</div>'}</div>

    <div class="disclaimer" style="margin-top:16px">Educational only — not investment advice. Expert track records are percentages, never dollar values (#4/#8); experts are ranked by verification, never by returns (#9).</div>
  </section>`;
}

function renderRail() {
  if (exp('rail') === 'B') return '';
  const common = state.boot.communities?.find((c) => c.type === 'common');
  return `
  <aside class="rail">
    <div class="card">
      <div class="comm-title">${esc(common?.name ?? 'US Investment')}</div>
      <div class="comm-desc">${esc(common?.desc ?? '')}</div>
      <div class="comm-stats">
        <span><b>${esc(String(common?.members?.toLocaleString?.() ?? ''))}</b> <span style="color:var(--dim)">members</span></span>
        <span style="display:flex;align-items:center;gap:5px"><span class="dot" style="margin:0"></span><b>${esc(String(common?.online ?? ''))}</b> <span style="color:var(--dim)">online now</span></span>
      </div>
    </div>
    <div class="card">
      <div class="section-label">Mavens in this community</div>
      ${(state.boot.mavens ?? []).map((m) => `
        <div class="maven-row">
          ${avatar(m, 34, '', 'open-maven')}
          <div class="who">
            <div class="n" data-action="open-maven" data-user="${esc(m.id)}">${esc(m.name)} <span class="badge badge-maven" style="font-size:9px;padding:0 5px">✓</span></div>
            <div class="c">${esc(m.credential ?? '')}</div>
          </div>
          <span class="maven-row-cta" data-action="open-maven" data-user="${esc(m.id)}">Track record →</span>
        </div>`).join('')}
      <div class="foot-note">Performance is percent-only — Monthly / Yearly / Overall. Asset value is never shown.</div>
    </div>
    ${topContributorsCard()}
    ${calendarPanel({ mod: !!state.me?.isModerator, compact: true })}
  </aside>`;
}

function renderFeed() {
  const spaceName = state.space === 'all' ? 'All posts' : (state.boot.spaces?.find((s) => s.id === state.space)?.name ?? state.space);
  const commonName = state.boot.communities?.find((c) => c.type === 'common')?.name ?? 'US Investment';
  const q = state.search.trim().toLowerCase();
  const posts = q ? state.posts.filter((p) => (p.title + ' ' + p.body + ' ' + p.author.name).toLowerCase().includes(q)) : state.posts;
  return `
  <div class="main-grid ${exp('rail') === 'B' ? 'no-rail' : ''}">
    <div class="feed-col ${exp('density') === 'B' ? 'compact' : ''}">
      ${renderComposer()}
      <div class="feed-sort" role="tablist" aria-label="Sort feed">
        <button class="feed-sort-tab ${state.feedSort === 'popular' ? 'on' : ''}" data-action="feed-sort" data-sort="popular" role="tab" aria-selected="${state.feedSort === 'popular'}">▲ Popular</button>
        <button class="feed-sort-tab ${state.feedSort === 'new' ? 'on' : ''}" data-action="feed-sort" data-sort="new" role="tab" aria-selected="${state.feedSort === 'new'}">New</button>
      </div>
      <div class="feed-head">
        <span class="t">${esc(spaceName)}</span>
        <span class="s">${state.space === 'all' ? (state.feedSort === 'popular' ? `Most engaged across ${esc(commonName)}` : `Latest across ${esc(commonName)}`) : `Space in ${esc(commonName)} · ${state.feedSort === 'popular' ? 'most engaged' : 'latest first'}`}${q ? ` · filtered by “${esc(q)}”` : ''}</span>
      </div>
      ${posts.length ? posts.map(postCard).join('') : `
        <div class="card empty"><div class="t">Nothing here yet</div><div class="d">Be the first — the composer is right above.</div></div>`}
      <div class="disclaimer">Community content is peer + expert discussion — not investment, tax, or legal advice.</div>
    </div>
    ${renderRail()}
  </div>`;
}

/* ---------------- render: communities ---------------- */
function renderCommunities() {
  const me = state.me;
  const country = state.boot.countries?.find((c) => c.code === me.country);
  const typeBadge = { common: ['COMMON · FREE', 'badge-common'], public: ['PUBLIC', 'badge-public'], private: ['PRIVATE', 'badge-private'] };
  const commColor = { common: 'var(--teal)', public: '#4A5568', private: 'var(--saffron)' };
  return `
  <div class="main-grid ${exp('rail') === 'B' ? 'no-rail' : ''}">
    <div style="min-width:0">
      <div style="padding:2px 4px 12px">
        <div class="page-title">Communities in ${esc(country?.name ?? me.country)}</div>
        <div class="page-sub">Join what fits. Private communities take requests or invites. Switch country from the top bar.</div>
      </div>
      <div class="comm-list">
        ${(state.boot.communities ?? []).map((c) => {
          const [label, cls] = typeBadge[c.type];
          const initials = c.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
          const joinLabel = c.joined ? 'Joined ✓' : c.type === 'private' ? (c.requested ? 'Requested…' : 'Request to join') : 'Join';
          const joinCls = c.joined || c.requested ? 'btn-ghost' : 'btn-primary';
          return `
          <div class="card comm-card">
            <div class="comm-avatar" style="background:${commColor[c.type]}">${esc(initials)}</div>
            <div class="mid">
              <div class="name-row"><span class="n">${esc(c.name)}</span><span class="badge ${cls}">${label}</span></div>
              <div class="desc">${esc(c.desc)}</div>
              <div class="stats">${c.members.toLocaleString()} members · ${c.online} online now</div>
            </div>
            <button class="btn ${joinCls}" data-action="join-community" data-community="${esc(c.id)}" ${c.joined || c.requested ? 'disabled style="cursor:default"' : ''}>${joinLabel}</button>
          </div>`;
        }).join('')}
      </div>
    </div>
    ${exp('rail') === 'B' ? '' : `
    <aside class="rail">
      <div class="card">
        <div class="section-label">Why trust DesiSquare</div>
        <div style="font-size:12.5px;color:var(--body);line-height:1.65;margin-top:8px">Pseudonymous by default — phone numbers never shown. Public-first answers, moderated by DesiSquare. The maven trust layer (tracked records, karma) arrives in Phase 2.</div>
      </div>
    </aside>`}
  </div>`;
}

/* ---------------- render: post detail ---------------- */
function renderPostDetail() {
  const post = state.post;
  if (!post) return '<div class="card empty"><div class="t">Post not found</div></div>';
  const a = post.author;
  const me = state.me;
  return `
  <div class="detail">
    <button class="back-link" data-action="go" data-to="feed">← Back to feed</button>
    <div class="card detail-card">
      <div class="post-head">
        ${avatar(a, 34)}
        <div class="who">
          <div class="line">
            <span class="name" data-action="open-profile" data-user="${esc(a.id)}">${esc(a.name)}</span>
            ${karmaChip(a)}
            ${authorBadges(a)}
            ${post.via === 'whatsapp' ? '<span class="badge badge-wa">via WhatsApp</span>' : ''}
          </div>
          <div class="meta">${esc(post.spaceName)} · ${esc(post.timeAgo)}${a.credential ? ` · ${esc(a.credential)}` : ''}</div>
        </div>
        <div style="position:relative">
          <button class="flag-btn" title="Flag with a reason" data-action="toggle-flag" data-post="${esc(post.id)}">⋯</button>
          ${flagMenu(post)}
        </div>
      </div>
      <h1 class="detail-title">${esc(post.title)}</h1>
      <div class="detail-body">${esc(post.bodyFull)}</div>
      ${post.myFlag ? `<div class="post-flagged-note" style="margin-top:8px">Flagged as “${esc(post.myFlag)}” — sent privately to the review queue.</div>` : ''}
      <div class="detail-rx">${reactionPills(post, 'detail')}</div>
    </div>
    <div class="comments-head">${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${(post.comments ?? []).map((c) => `
        <div class="card comment-card">
          <div class="comment-head">
            ${avatar(c.author, 28)}
            <span class="n">${esc(c.author.name)}</span>
            ${c.author.isMaven ? '<span class="badge badge-maven" style="font-size:10px;padding:1px 6px">MAVEN ✓</span>' : ''}
            <span class="t">${esc(c.timeAgo)}</span>
          </div>
          <div class="comment-text">${esc(c.text)}</div>
        </div>`).join('')}
    </div>
    <div class="card reply-bar">
      <span class="avatar" style="width:30px;height:30px;background:${esc(me.color)};font-size:11px">${esc(me.initials)}</span>
      <input class="reply-input" id="reply-input" placeholder="Reply publicly — the next person with this question will thank you" value="${esc(state.reply)}" autocomplete="off">
      <button class="btn btn-primary" style="padding:7px 14px;font-size:12.5px" data-action="send-reply" data-post="${esc(post.id)}">Reply</button>
    </div>
  </div>`;
}

/* ---------------- render: profile ---------------- */
function renderPortfolioCard(p, isSelf) {
  if (!p) return '';
  if (p.view === 'private') {
    return `
    <div class="card portfolio-card">
      <div class="section-label">Portfolio</div>
      <div style="font-size:12.5px;color:var(--dim);margin-top:8px">This member keeps their portfolio private — the default on DesiSquare.</div>
    </div>`;
  }
  if (p.view === 'public') {
    return `
    <div class="card portfolio-card">
      <div class="row-top"><span class="section-label" style="flex:1">Portfolio · allocation</span><span class="badge badge-verified">SHARED</span></div>
      <div style="margin-top:10px;border-top:1px solid var(--wash)">
        ${p.holdings.map((h) => `
          <div class="holding-row"><span class="t">${esc(h.t)}</span><span class="bar"><div style="width:${Number(h.pc)}%"></div></span><span class="pc">${Number(h.pc)}%</span></div>`).join('')}
      </div>
      <div class="portfolio-note">Allocation % only — dollar values stay private. Powered by Ghostfolio.</div>
    </div>`;
  }
  // owner view
  const ytdUp = p.ytd >= 0;
  return `
  <div class="card portfolio-card">
    <div class="row-top">
      <span class="section-label" style="flex:1">My portfolio</span>
      <button class="toggle ${p.public ? 'on' : ''}" data-action="toggle-portfolio">${p.public ? 'Public' : 'Private'}</button>
    </div>
    <div class="portfolio-value">$${Number(p.value).toLocaleString()}</div>
    <div class="portfolio-ytd ${ytdUp ? 'up' : 'down'}">${ytdUp ? '+' : ''}${p.ytd}% YTD <span class="note">· manual entries</span></div>
    <div style="margin-top:12px;border-top:1px solid var(--wash)">
      ${p.holdings.map((h) => `
        <div class="holding-row"><span class="t">${esc(h.t)}</span><span class="bar"><div style="width:${Number(h.pc)}%"></div></span><span class="pc">${Number(h.pc)}%</span></div>`).join('')}
    </div>
    <div class="portfolio-note">
      ${p.public ? 'Visible on your profile — allocation % only, dollars stay private.' : 'Only you can see this.'}
      ${p.ghostfolio ? ` Ghostfolio account <b>${esc(p.ghostfolio.accountId ?? '')}</b> · ${esc(p.ghostfolio.source ?? '')}.` : ''}
    </div>
    <button class="btn ${p.ssoAvailable ? 'btn-primary' : 'btn-quiet'}" style="width:100%;margin-top:10px" data-action="open-ghostfolio">
      ${p.ssoAvailable ? 'Open in Ghostfolio →' : 'Open in Ghostfolio (start POC services)'}
    </button>
  </div>`;
}

function renderProfile() {
  const pr = state.profile;
  if (!pr) return '';
  const p = pr.profile;
  const isSelf = p.id === state.me.id;
  const tab = state.profileTab;
  const rows = tab === 'posts'
    ? pr.posts.map((post) => `
      <div class="card activity-row">
        <div class="top"><span class="tag">POST</span><span class="when">${esc(post.timeAgo)} · ${esc(post.spaceName)}</span>
          ${post.via === 'whatsapp' ? '<span class="badge badge-wa">via WhatsApp</span>' : ''}</div>
        <div class="text" data-action="open-post" data-post="${esc(post.id)}">${esc(post.title)}</div>
        <div class="sub">${post.commentCount} comments · ${Object.values(post.reactions).reduce((n, r) => n + r.n, 0)} reactions</div>
      </div>`)
    : pr.comments.map((c) => `
      <div class="card activity-row">
        <div class="top"><span class="tag">COMMENT</span><span class="when">${esc(c.timeAgo)} · on “${esc(c.postTitle)}”</span></div>
        <div class="text" data-action="open-post" data-post="${esc(c.postId)}">${esc(c.text)}</div>
      </div>`);
  return `
  <div class="profile-grid ${exp('rail') === 'B' && !pr.portfolio ? 'no-rail' : ''}">
    <div style="min-width:0">
      <div class="card profile-head">
        <span class="avatar" style="width:52px;height:52px;background:${esc(p.color)};font-size:18px">${esc(p.initials)}</span>
        <div class="who">
          <div class="name-row">
            <span class="n">${esc(p.name)}</span>
            ${karmaChip(p)}
            ${tierChip(p)}
            ${authorBadges(p)}
            ${!p.isMaven && !p.isModerator && !p.isSeeker ? '<span class="badge badge-seeker">PEER</span>' : ''}
            ${p.desiVerified ? '<span class="badge badge-verified">DESI-VERIFIED ✓</span>' : ''}
          </div>
          <div class="sub">Pseudonymous · phone hidden · member since ${esc(p.memberSince)}</div>
        </div>
        <div class="stat"><div class="v">${p.reactionsReceived}</div><div class="l">reactions received</div></div>
      </div>
      <div class="profile-tabs">
        <button class="chip ${tab === 'posts' ? 'on' : ''}" data-action="profile-tab" data-tab="posts">My posts</button>
        <button class="chip ${tab === 'comments' ? 'on' : ''}" data-action="profile-tab" data-tab="comments">My comments</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${rows.length ? rows.join('') : '<div class="card empty"><div class="t">Nothing yet</div><div class="d">Posts and comments will land here.</div></div>'}
      </div>
    </div>
    <aside class="rail" style="display:flex">
      ${renderPortfolioCard(pr.portfolio, isSelf)}
    </aside>
  </div>`;
}

/* ---------------- render: settings ---------------- */
function renderSettings() {
  const me = state.me;
  return `
  <div class="settings">
    <div style="padding:2px 4px 12px">
      <div class="page-title">Settings</div>
      <div class="page-sub">Channels, privacy and verification. Your phone number is never shown to members.</div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="dot" style="margin:0;width:8px;height:8px"></span>
        <span style="font-size:14px;font-weight:700">WhatsApp</span>
        <span style="font-size:12px;color:var(--good);font-weight:600">${me.waLinked ? 'connected' : 'not linked'}</span>
      </div>
      <div style="font-size:12.5px;color:var(--dim);margin-top:4px">${me.waLinked ? 'Linked group: <b style="color:var(--ink)">US Investment · Community Chat</b> · number verified, hidden' : 'Demo accounts quiet_lotus, dallas_desi, quant_aunty and first_gen_saver come pre-linked.'}</div>
      <div class="setting-row">
        <div><div class="t">Mirror my group messages to the feed</div><div class="d">Posted under your pseudonym, phone hidden. Consent required — honored within 60 s.</div></div>
        <button class="toggle ${me.waConsentMirror ? 'on' : ''}" data-action="toggle-setting" data-key="waConsentMirror">${me.waConsentMirror ? 'On' : 'Off'}</button>
      </div>
      <div class="setting-row">
        <div><div class="t">WhatsApp notifications</div><div class="d">Replies and mentions, straight to your chat.</div></div>
        <button class="toggle ${me.waNotifs ? 'on' : ''}" data-action="toggle-setting" data-key="waNotifs">${me.waNotifs ? 'On' : 'Off'}</button>
      </div>
    </div>
    <div class="card">
      <div style="font-size:14px;font-weight:700">Privacy</div>
      <div class="setting-row">
        <div><div class="t">Display name</div><div class="d">Pseudonymous by default — never auto-derived from your email or phone.</div></div>
        <span style="border:1px solid var(--hairline);border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;background:#FAFAF8">${esc(me.name)}</span>
      </div>
      <div class="setting-row">
        <div><div class="t">Portfolio visibility</div><div class="d">Public portfolios build trust; private is the default. Public = allocation % only.</div></div>
        <button class="toggle ${me.portfolioPublic ? 'on' : ''}" data-action="toggle-setting" data-key="portfolioPublic">${me.portfolioPublic ? 'Public' : 'Private'}</button>
      </div>
    </div>
    <div class="card">
      <div style="font-size:14px;font-weight:700">Verification</div>
      <div style="display:flex;flex-direction:column;gap:9px;margin-top:11px">
        <div class="check-row"><span class="ok">✓</span><span>Email verified · phone used internally only, never displayed</span></div>
        <div class="check-row"><span class="ok">✓</span><span>Desi check passed — invited by an existing member</span></div>
      </div>
    </div>
  </div>`;
}

/* ---------------- render: review queue (structured flags + posting penalties) ---------------- */
// Normalise the reason to the product's two headline categories where it maps cleanly.
function reviewReasonLabel(r) {
  const s = String(r ?? '');
  if (/market/i.test(s)) return 'Self-Marketing';
  if (/mislead/i.test(s)) return 'Misleading';
  return s || 'Flagged';
}

function flagCard(q) {
  // Accept both the flat contract ({author, space, age, quote}) and the nested post shape.
  const author = q.author ?? q.post?.author?.name ?? q.post?.author?.id ?? 'unknown';
  const space = q.space ?? q.post?.spaceName ?? '';
  const age = q.age ?? q.timeAgo ?? '';
  const quote = q.quote ?? q.post?.body ?? '';
  const flags = q.flagCount ?? (q.flaggedBy?.length ?? q.flags?.length ?? 0);
  const reason = reviewReasonLabel(q.reason);
  const isMarket = /market/i.test(q.reason ?? '');
  const status = q.status ?? 'pending';
  return `
  <div class="card flag-card">
    <div class="flag-card-top">
      <span class="flag-reason ${isMarket ? 'reason-market' : 'reason-mislead'}">${esc(reason)}</span>
      <span class="flag-who">@${esc(author)} · in ${esc(space)} · ${esc(age)}</span>
      <span class="flag-count">${flags} ${flags === 1 ? 'flag' : 'flags'}</span>
    </div>
    <div class="flag-quote">“${esc(quote)}”</div>
    ${status === 'pending' ? `
    <div class="flag-actions">
      <button class="btn btn-danger" data-action="review-penalty" data-id="${esc(q.id)}" data-act="remove" data-author="${esc(author)}">Remove + ban posting 3 days</button>
      <button class="btn btn-quiet" data-action="review-penalty" data-id="${esc(q.id)}" data-act="dismiss">Dismiss flags</button>
    </div>` : `
    <div class="flag-resolution ${status === 'removed' ? 'removed' : 'dismissed'}">
      ${status === 'removed' ? `Removed · @${esc(author)} banned from posting for 3 days` : 'Dismissed · content kept'}
    </div>`}
  </div>`;
}

function renderReview() {
  const items = state.review?.items ?? [];
  return `
  <div class="review">
    <div style="padding:2px 4px 12px">
      <div class="page-title">Review queue</div>
      <div class="page-sub">Members' private flags land here — Self-Marketing, Misleading and more. Nothing below is ever public. Removing a post also bans its author from posting for 3 days.</div>
    </div>
    ${items.length ? items.map(flagCard).join('') : '<div class="card empty"><div class="t">Queue clear ✓</div><div class="d">No flagged content awaiting review.</div></div>'}
    <div class="review-cal">
      ${calendarPanel({ mod: true, compact: false })}
    </div>
  </div>`;
}

/* ---------------- render: A/B lab ---------------- */
function renderLab() {
  if (!state.ui.lab) return '';
  const cat = state.boot.experimentsCatalog ?? {};
  const themes = state.boot.themesCatalog ?? {};
  const currentTheme = state.me?.theme ?? 'warm';
  return `
  <div class="lab-overlay" data-action="close-lab">
    <div class="card lab" data-stop="1">
      <h2>🧪 A/B Lab &amp; Themes</h2>
      <div class="sub">Contested design calls, shipped as live experiments — plus four alternate skins. Pick anything; it applies instantly and sticks to your account.</div>
      ${Object.entries(cat).map(([key, ex]) => `
        <div class="lab-exp">
          <div class="q">${esc(ex.label)} — ${esc(ex.question)}</div>
          <div class="lab-choices">
            ${['A', 'B'].map((v) => `
              <button class="lab-choice ${exp(key) === v ? 'on' : ''}" data-action="pick-variant" data-key="${esc(key)}" data-variant="${v}">
                <div class="variant">VARIANT ${v}${v === 'A' ? ' · CONTRACT DEFAULT' : ''}</div>
                <div class="n">${esc(ex[v].name)}</div>
                <div class="b">${esc(ex[v].blurb)}</div>
              </button>`).join('')}
          </div>
        </div>`).join('')}
      <div class="lab-exp">
        <div class="q">Theme — pick a skin. Same anatomy, four moods (Theme Options 1a–1d).</div>
        <div class="theme-grid">
          ${Object.entries(themes).map(([id, t]) => `
            <button class="theme-card ${currentTheme === id ? 'on' : ''}" data-action="pick-theme" data-theme="${esc(id)}">
              <div class="swatches">${(t.swatches ?? []).map((c) => `<span class="sw" style="background:${esc(c)}"></span>`).join('')}</div>
              <div class="tag">${esc(t.tag)}</div>
              <div class="n">${esc(t.name)}</div>
              <div class="b">${esc(t.blurb)}</div>
            </button>`).join('')}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" data-action="close-lab">Done</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- render: demo drawer ---------------- */
function renderDemo() {
  const fab = `<button class="demo-fab" data-action="toggle-demo">${state.ui.demo ? '× Close demo' : '▶ Demo'}</button>`;
  if (!state.ui.demo) return fab;
  const d = state.demo;
  const wiring = d ? [
    ['wa-bridge (Script 1)', d.integrations.waBridge],
    ['gf-provisioner (Script 2)', d.integrations.gfProvisioner],
    ['Ghostfolio', d.integrations.ghostfolio],
    ['Discourse', d.integrations.discourse],
  ] : [];
  return `${fab}
  <div class="card demo-drawer">
    <h3>Demo driver</h3>
    <div class="sub">Drive the POC live. Everything below uses the real services when they're running — and honest fallbacks when they're not.</div>
    <div class="demo-section">
      <div class="section-label">POC wiring</div>
      ${d ? wiring.map(([name, s]) => `
        <div class="wiring-row">
          <span class="dot-state ${s.reachable ? 'up' : 'down'}"></span>
          <span>${esc(name)}</span>
          <span class="mode">${s.reachable ? `up${s.mode ? ` · ${esc(s.mode)}` : ''}` : 'not running'}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--dim)">Loading…</div>'}
      <button class="btn btn-quiet" style="margin-top:8px;font-size:12px;padding:6px 12px" data-action="demo-refresh">↻ Re-probe</button>
    </div>
    <div class="demo-section">
      <div class="section-label">Inject a WhatsApp group message</div>
      <div style="font-size:11.5px;color:var(--dim);margin:4px 0 8px">Simulates a member posting in the linked group. Watch it land in the feed labelled “via WhatsApp”.</div>
      <select id="demo-wa-user" class="input" style="width:100%;margin-bottom:8px">
        ${(d?.waMappings ?? []).map((m) => `<option value="${esc(m.userId)}">${esc(m.userId)} (consented member)</option>`).join('')}
      </select>
      <textarea id="demo-wa-text" class="input" style="width:100%;min-height:56px;resize:vertical" placeholder="e.g. Anyone compared FCNR rates at ICICI vs HDFC this month?"></textarea>
      <button class="btn btn-primary" style="width:100%;margin-top:8px" data-action="demo-wa-send">Send from WhatsApp →</button>
    </div>
    <div class="demo-section">
      <div class="section-label">Ghostfolio provisioning</div>
      <div style="font-size:11.5px;color:var(--dim);margin:4px 0 8px">Simulate a brand-new member signup → exactly one Ghostfolio account (webhook fired twice to prove idempotency).</div>
      <button class="btn btn-ghost" style="width:100%" data-action="demo-signup">Simulate signup + provision</button>
    </div>
    <div class="demo-section">
      <div class="section-label">Recent integration events</div>
      <div class="demo-log">${(d?.events ?? []).slice(0, 12).map((e) => `<div>· ${esc(e.kind)} ${esc(JSON.stringify(e.detail ?? {}))}</div>`).join('') || 'No events yet.'}</div>
    </div>
    <div class="demo-section" style="display:flex;gap:8px">
      <button class="btn btn-quiet" style="flex:1;font-size:12px" data-action="demo-reset">Reset demo data</button>
    </div>
  </div>`;
}

/* ---------------- render: search (Reddit-style) ---------------- */
// The search payload lets `author` be a plain name or an author card, and `reactions` a
// number or the {key:{n}} map used elsewhere — normalise both here so one renderer covers all.
function authorName(a) { return typeof a === 'string' ? a : (a?.name ?? '—'); }
function authorId(a) { return typeof a === 'string' ? a : (a?.id ?? a?.name ?? ''); }
function reactionTotal(r) {
  if (typeof r === 'number') return r;
  if (r && typeof r === 'object') return Object.values(r).reduce((n, v) => n + (typeof v === 'number' ? v : (v?.n ?? 0)), 0);
  return 0;
}

function searchPostCard(p) {
  return `
  <article class="card sr-post" data-action="open-post" data-post="${esc(p.id)}">
    <div class="sr-post-meta">${esc(p.space ?? '')}${p.author != null ? ` · ${esc(authorName(p.author))}` : ''}${p.age ? ` · ${esc(p.age)}` : ''}</div>
    <div class="sr-post-title">${esc(p.title)}</div>
    ${p.snippet ? `<div class="sr-post-snip">${esc(p.snippet)}</div>` : ''}
    <div class="sr-post-foot">${reactionTotal(p.reactions)} reactions · ${p.commentCount ?? 0} ${(p.commentCount === 1) ? 'comment' : 'comments'}</div>
  </article>`;
}

function searchCommentCard(c) {
  return `
  <article class="card sr-comment" data-action="open-post" data-post="${esc(c.postId)}">
    <div class="sr-post-meta">Comment${c.author != null ? ` by ${esc(authorName(c.author))}` : ''}${c.age ? ` · ${esc(c.age)}` : ''} · on “${esc(c.postTitle ?? '')}”</div>
    <div class="sr-post-snip">${esc(c.snippet ?? '')}</div>
  </article>`;
}

function searchProfileCard(pr) {
  const initials = String(pr.name ?? '?').split(/[_\s]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'DS';
  const dest = pr.isMaven ? 'open-maven' : 'open-profile';
  return `
  <article class="card sr-profile">
    <span class="avatar" style="width:40px;height:40px;background:${esc(pr.color ?? '#4A5568')};font-size:14px;cursor:pointer" data-action="${dest}" data-user="${esc(pr.id)}">${esc(initials)}</span>
    <div class="sr-profile-mid">
      <div class="sr-profile-name" data-action="${dest}" data-user="${esc(pr.id)}">${esc(pr.name)}
        ${karmaChip(pr)}
        ${pr.isMaven ? '<span class="badge badge-maven">MAVEN ✓</span>' : ''}
        ${pr.isModerator ? '<span class="badge badge-mod">MOD</span>' : ''}
      </div>
      <div class="sr-profile-sub">${esc(pr.credential || (pr.isMaven ? 'Credential-verified maven' : 'Member'))}${pr.corridor ? ` · ${esc(pr.corridor)}` : ''}</div>
    </div>
    <button class="btn btn-ghost sr-profile-cta" data-action="${dest}" data-user="${esc(pr.id)}">${pr.isMaven ? 'Track record →' : 'View →'}</button>
  </article>`;
}

function searchCommunityCard(c, compact = false) {
  const initials = String(c.name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return `
  <div class="card sr-comm ${compact ? 'compact' : ''}">
    <div class="sr-comm-avatar">${esc(initials)}</div>
    <div class="sr-comm-mid" data-action="go" data-to="communities">
      <div class="sr-comm-name">${esc(c.name)}</div>
      <div class="sr-comm-desc">${esc(c.description ?? '')}</div>
      <div class="sr-comm-stats">${Number(c.members ?? 0).toLocaleString()} members</div>
    </div>
    <button class="btn ${c.joined ? 'btn-ghost' : 'btn-primary'} sr-comm-cta" data-action="search-join" data-community="${esc(c.id)}" ${c.joined ? 'disabled style="cursor:default"' : ''}>${c.joined ? 'Joined ✓' : 'Join'}</button>
  </div>`;
}

function renderSearch() {
  const d = state.searchData;
  const q = state.search.trim();
  if (!d) return `<div class="search-page"><div class="card empty"><div class="t">Searching…</div></div></div>`;
  const counts = d.counts ?? { all: 0, posts: 0, communities: 0, comments: 0, profiles: 0 };
  const tabs = [
    ['all', 'All', counts.all],
    ['posts', 'Posts', counts.posts],
    ['communities', 'Communities', counts.communities],
    ['comments', 'Comments', counts.comments],
    ['profiles', 'Profiles', counts.profiles],
  ];
  const tab = state.searchTab;
  const posts = d.posts ?? [], comms = d.communities ?? [], comments = d.comments ?? [], profiles = d.profiles ?? [];

  let column = '';
  if (!q) {
    column = `<div class="card empty"><div class="t">Search DesiSquare</div><div class="d">Try a ticker (VOO), a topic (FEMA, 401k, FCNR), a community, or a member’s pseudonym.</div></div>`;
  } else if ((counts.all ?? 0) === 0) {
    column = `<div class="card empty"><div class="t">No results for “${esc(q)}”</div><div class="d">Tips: check spelling, try a broader term, or search a ticker like VOO. People and communities are searchable too.</div></div>`;
  } else if (tab === 'posts') {
    column = posts.length ? posts.map(searchPostCard).join('') : `<div class="card empty"><div class="t">No posts match</div></div>`;
  } else if (tab === 'communities') {
    column = comms.length ? comms.map((c) => searchCommunityCard(c)).join('') : `<div class="card empty"><div class="t">No communities match</div></div>`;
  } else if (tab === 'comments') {
    column = comments.length ? comments.map(searchCommentCard).join('') : `<div class="card empty"><div class="t">No comments match</div></div>`;
  } else if (tab === 'profiles') {
    column = profiles.length ? profiles.map(searchProfileCard).join('') : `<div class="card empty"><div class="t">No people match</div></div>`;
  } else { // all — best-match blend, mirroring Reddit's blended results page
    const parts = [];
    if (profiles.length) parts.push(`<div class="sr-group-label">People</div>${profiles.slice(0, 3).map(searchProfileCard).join('')}`);
    if (comms.length) parts.push(`<div class="sr-group-label">Communities</div>${comms.slice(0, 3).map((c) => searchCommunityCard(c, true)).join('')}`);
    if (posts.length) parts.push(`<div class="sr-group-label">Posts</div>${posts.map(searchPostCard).join('')}`);
    if (comments.length) parts.push(`<div class="sr-group-label">Comments</div>${comments.slice(0, 5).map(searchCommentCard).join('')}`);
    column = parts.join('');
  }

  return `
  <div class="search-page">
    <div class="search-head">
      <div class="page-title">${q ? `Search results for “${esc(q)}”` : 'Search'}</div>
      <div class="page-sub">${q ? `${counts.all ?? 0} result${(counts.all === 1) ? '' : 's'} across posts, communities, comments and people` : 'Find posts, communities, comments and members.'}</div>
    </div>
    <div class="search-grid">
      <div class="search-main" style="min-width:0">
        <div class="search-tabs">
          ${tabs.map(([id, label, n]) => `<button class="search-tab ${tab === id ? 'on' : ''}" data-action="search-tab" data-tab="${id}">${label}<span class="n">${n ?? 0}</span></button>`).join('')}
        </div>
        <div class="search-results">${column}</div>
      </div>
      <aside class="search-rail">
        <div class="card">
          <div class="section-label">Communities</div>
          ${comms.length ? comms.map((c) => searchCommunityCard(c, true)).join('') : `<div style="font-size:12.5px;color:var(--dim);margin-top:8px">No matching communities.</div>`}
        </div>
      </aside>
    </div>
  </div>`;
}

/* ---------------- render: maven detail (eToro-style, PERCENT ONLY) ---------------- */
// Every value on this surface is a percent or a unitless index (100 at inception). A currency
// symbol must never appear here — the leak-sweep + browser assertion both check for /\$\d/.
function barChart(items, getVal, getLabel) {
  // Signed bar chart: a zero baseline, positive returns grow UP, negative returns grow
  // DOWN on the opposite side. The baseline sits proportionally between the two extremes
  // so an all-positive (or all-negative) series still uses the full height, while a mixed
  // series shows losses mirrored below the line. Values stay percent-only (constraint #8).
  const vals = items.map((it) => Number(getVal(it)) || 0);
  const posMax = Math.max(0, ...vals);            // largest gain (0 if none positive)
  const negMax = Math.max(0, ...vals.map((v) => -v)); // magnitude of largest loss
  const total = Math.max(1e-9, posMax + negMax);
  const posFrac = (posMax / total) * 100;         // share of the track above the baseline
  const negFrac = (negMax / total) * 100;         // share below the baseline
  return `<div class="mv-bars mv-bars-signed">${items.map((it) => {
    const v = Number(getVal(it)) || 0;
    const cls = pctClass(v);
    const posH = posMax > 0 && v > 0 ? Math.max(4, Math.round((v / posMax) * 100)) : 0;
    const negH = negMax > 0 && v < 0 ? Math.max(4, Math.round((-v / negMax) * 100)) : 0;
    return `<div class="mv-bar-col">
      <div class="mv-bar-track">
        <div class="mv-bar-zone mv-bar-zone-pos" style="flex-basis:${posFrac.toFixed(2)}%">
          ${v >= 0 ? `<div class="mv-bar-val ${cls}">${fmtPct(v)}</div>${v > 0 ? `<div class="mv-bar ${cls} up" style="height:${posH}%"></div>` : ''}` : ''}
        </div>
        <div class="mv-bar-baseline"></div>
        <div class="mv-bar-zone mv-bar-zone-neg" style="flex-basis:${negFrac.toFixed(2)}%">
          ${v < 0 ? `<div class="mv-bar ${cls} down" style="height:${negH}%"></div><div class="mv-bar-val ${cls}">${fmtPct(v)}</div>` : ''}
        </div>
      </div>
      <div class="mv-bar-label">${esc(getLabel(it))}</div>
    </div>`;
  }).join('')}</div>`;
}

function lineChartSVG(series) {
  const pts = (series ?? []).map((s, i) => ({ i, v: Number(s.index) || 0, date: s.date }));
  if (pts.length < 2) return `<div style="font-size:12.5px;color:var(--dim)">Not enough history to chart yet.</div>`;
  const W = 640, H = 220, PAD = 8;
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const x = (i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${(H - PAD).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD).toFixed(1)} Z`;
  const last = pts[pts.length - 1].v, first = pts[0].v;
  const up = last >= first;
  const stroke = up ? 'var(--good)' : 'var(--bad)';
  // baseline at index 100 (inception) when it falls within range
  const baseY = (min <= 100 && max >= 100) ? y(100) : null;
  return `
  <svg class="mv-line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Percent index over time">
    <defs><linearGradient id="mvfill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${up ? 'var(--good-tint)' : 'var(--bad-tint)'}"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient></defs>
    ${baseY != null ? `<line x1="${PAD}" y1="${baseY.toFixed(1)}" x2="${W - PAD}" y2="${baseY.toFixed(1)}" stroke="var(--hairline)" stroke-dasharray="4 4"/>` : ''}
    <path d="${area}" fill="url(#mvfill)"/>
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function renderMaven() {
  const mv = state.maven;
  if (!mv) return `<div class="mv"><div class="card empty"><div class="t">Loading track record…</div></div></div>`;
  const { perf, info } = mv;
  const o = perf.overall ?? {};
  const followers = perf.followers ?? info.followers ?? mv.reactionsReceived ?? 0;
  const initials = info.initials ?? String(info.name ?? '?').slice(0, 2).toUpperCase();
  const color = info.color ?? '#0F766E';
  const tab = state.mavenTab;
  const tabs = [['overview', 'Overview'], ['stats', 'Stats'], ['portfolio', 'Portfolio'], ['chart', 'Chart']];

  // --- Overview ---
  let body = '';
  if (tab === 'overview') {
    const tiles = [
      ['Return YTD', o.ytdPct], ['Return 2Y', o.twoYearPct],
      ['Cumulative', o.cumulativePct], ['Annualized', o.annualizedPct],
    ];
    const softTiles = [
      ['Profitable weeks', o.profitableWeeksPct, true], ['Avg risk score', o.riskScore, false],
    ];
    body = `
    <div class="mv-section">
      <div class="mv-section-head">Performance by year</div>
      ${barChart(perf.yearly ?? [], (it) => it.pct, (it) => it.year)}
    </div>
    <div class="mv-tiles">
      ${tiles.map(([l, v]) => `<div class="mv-tile"><div class="mv-tile-v ${pctClass(v)}">${fmtPct(v)}</div><div class="mv-tile-l">${l}</div></div>`).join('')}
      ${softTiles.map(([l, v, isPct]) => `<div class="mv-tile"><div class="mv-tile-v">${isPct ? `${Number(v ?? 0).toFixed(0)}%` : (Number(v ?? 0).toFixed(1))}</div><div class="mv-tile-l">${l}</div></div>`).join('')}
    </div>
    <div class="mv-section">
      <div class="mv-section-head">About</div>
      <div class="mv-about">${esc(info.bio || `${info.name} is a credential-verified DesiSquare maven${info.credential ? ` — ${info.credential}` : ''}. Track record is published as percentage returns only; absolute portfolio value is never shown.`)}</div>
    </div>
    <div class="mv-section">
      <div class="mv-section-head">Recently traded</div>
      <div class="mv-trades">
        ${(perf.recent ?? []).length ? (perf.recent).map((t) => `
          <div class="mv-trade">
            <span class="mv-trade-tkr">${esc(t.ticker)}</span>
            <span class="mv-side ${String(t.side).toUpperCase() === 'SELL' ? 'sell' : 'buy'}">${esc(String(t.side).toUpperCase())}</span>
            <span class="mv-trade-at">${esc(shortDate(t.at))}</span>
            <span class="mv-trade-pl ${pctClass(t.plPct)}">${fmtPct(t.plPct)}</span>
          </div>`).join('') : '<div style="font-size:12.5px;color:var(--dim)">No recent trades disclosed.</div>'}
      </div>
      <div class="mv-note">P/L shown as percent per position — never a dollar amount.</div>
    </div>`;
  } else if (tab === 'stats') {
    // Monthly-returns heat table: rows = years, cols = Jan…Dec.
    const byYear = {};
    for (const m of (perf.monthly ?? [])) {
      const [yy, mm] = String(m.ym).split('-');
      const yr = Number(yy), mi = Number(mm) - 1;
      if (!Number.isFinite(yr) || mi < 0 || mi > 11) continue;
      (byYear[yr] ??= Array(12).fill(null))[mi] = Number(m.pct);
    }
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
    const yearTotal = (arr) => arr.reduce((n, v) => n + (v ?? 0), 0);
    body = `
    <div class="mv-section">
      <div class="mv-section-head">Monthly returns</div>
      <div class="mv-heat-wrap">
        <table class="mv-heat">
          <thead><tr><th>Year</th>${MONTHS.map((m) => `<th>${m}</th>`).join('')}<th>Year</th></tr></thead>
          <tbody>
            ${years.map((yr) => `<tr><td class="mv-heat-yr">${yr}</td>${byYear[yr].map((v) => v == null ? '<td class="mv-heat-cell empty">·</td>' : `<td class="mv-heat-cell ${pctClass(v)}">${fmtPct(v)}</td>`).join('')}<td class="mv-heat-cell ${pctClass(yearTotal(byYear[yr]))} tot">${fmtPct(yearTotal(byYear[yr]))}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="mv-note">Green ≥ 0, red &lt; 0. Percentages only — no balances.</div>
    </div>
    <div class="mv-section">
      <div class="mv-section-head">Monthly performance</div>
      ${barChart((perf.monthly ?? []).slice(-12), (it) => it.pct, (it) => MONTHS[(Number(String(it.ym).split('-')[1]) - 1) | 0] ?? '')}
    </div>`;
  } else if (tab === 'portfolio') {
    const alloc = perf.allocation ?? [];
    const sum = alloc.reduce((n, a) => n + (Number(a.pct) || 0), 0);
    body = `
    <div class="mv-section">
      <div class="mv-section-head">Allocation</div>
      <div class="mv-alloc">
        ${alloc.map((a) => `
          <div class="mv-alloc-row">
            <span class="mv-alloc-label">${esc(a.label)}</span>
            <span class="mv-alloc-bar"><div style="width:${Math.min(100, Number(a.pct) || 0)}%"></div></span>
            <span class="mv-alloc-pc">${(Number(a.pct) || 0).toFixed(1)}%</span>
          </div>`).join('')}
      </div>
      <div class="mv-note">Allocation percentages (≈ ${sum.toFixed(0)}% total) — position sizes and dollar values are never shown.</div>
    </div>`;
  } else { // chart
    const series = perf.series ?? [];
    const last = series.length ? Number(series[series.length - 1].index) : 100;
    const first = series.length ? Number(series[0].index) : 100;
    const chg = first ? ((last - first) / first) * 100 : 0;
    body = `
    <div class="mv-section">
      <div class="mv-chart-head">
        <div>
          <div class="mv-chart-idx">${last.toFixed(1)}<span class="mv-chart-idx-unit"> index</span></div>
          <div class="mv-chart-sub">Percent index · 100 at inception</div>
        </div>
        <div class="mv-chart-chg ${pctClass(chg)}">${fmtPct(chg)}</div>
      </div>
      ${lineChartSVG(series)}
      <div class="mv-note">A unitless percent index — starts at 100 the day the linked portfolio was verified. No currency, ever.</div>
    </div>`;
  }

  return `
  <div class="mv">
    <button class="back-link" data-action="go" data-to="feed">← Back</button>
    <div class="card mv-head">
      <span class="avatar" style="width:60px;height:60px;background:${esc(color)};font-size:22px">${esc(initials)}</span>
      <div class="mv-head-mid">
        <div class="mv-head-name">${esc(info.name)} <span class="badge badge-maven">MAVEN ✓</span> <span class="badge badge-verified">VERIFIED</span></div>
        <div class="mv-head-cred">${esc(info.credential || 'Credential-verified maven')}</div>
        <div class="mv-head-followers"><b>${Number(followers).toLocaleString()}</b> followers</div>
      </div>
      <div class="mv-head-hero">
        <div class="mv-hero-v ${pctClass(o.cumulativePct)}">${fmtPct(o.cumulativePct)}</div>
        <div class="mv-hero-l">cumulative return</div>
      </div>
    </div>
    <div class="mv-ribbon">✓ Verified via linked portfolio · percent-only — asset value is never shown</div>
    <div class="mv-tabs">
      ${tabs.map(([id, label]) => `<button class="mv-tab ${tab === id ? 'on' : ''}" data-action="maven-tab" data-tab="${id}">${label}</button>`).join('')}
    </div>
    ${body}
    <div class="disclaimer">Past performance is not a guarantee of future results. Educational only — not investment advice.</div>
  </div>`;
}

/* ---------------- render: admin ---------------- */
function adminNum(overview, keys, fallback) {
  for (const k of keys) { const v = overview?.[k]; if (typeof v === 'number') return v; }
  return fallback;
}
function adminInitials(u) {
  if (u.initials) return u.initials;
  const src = String(u.name ?? u.id ?? 'DS');
  const parts = src.split(/[_\s]+/).filter(Boolean);
  const ini = parts.map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return ini || src.slice(0, 2).toUpperCase() || 'DS';
}

function renderAdmin() {
  const a = state.admin;
  if (!a) return `<div class="admin"><div class="card empty"><div class="t">Loading admin…</div></div></div>`;
  const ov = a.overview ?? {};
  const users = a.users ?? [];
  const spaces = state.boot.spaces ?? [];
  const tiles = [
    ['Members', adminNum(ov, ['users', 'userCount', 'members', 'totalUsers'], users.length)],
    ['Posts', adminNum(ov, ['posts', 'postCount', 'totalPosts'], null)],
    ['Pending flags', adminNum(ov, ['pendingFlags', 'flags', 'pending', 'queue'], null)],
    ['Communities', adminNum(ov, ['communities', 'communityCount'], (state.boot.communities ?? []).length)],
  ];
  const roleOf = (u) => ({
    maven: u.isMaven ?? (u.groups ?? []).includes('mavens'),
    moderator: u.isModerator ?? (u.groups ?? []).includes('moderators'),
    admin: u.isAdmin ?? (u.groups ?? []).includes('admins'),
  });
  const roleBtn = (u, role, has, label) => `<button class="btn ${has ? 'btn-quiet' : 'btn-ghost'} admin-role-btn" data-action="admin-role" data-user="${esc(u.id)}" data-role="${role}" data-label="${label}" data-act="${has ? 'revoke' : 'grant'}">${has ? `Revoke ${label}` : `Make ${label}`}</button>`;

  return `
  <div class="admin">
    <div style="padding:2px 4px 12px">
      <div class="page-title">Admin panel</div>
      <div class="page-sub">Members, roles and spaces. Role grants are logged; performance data is never editable here (percent-only, by design).</div>
    </div>
    <div class="admin-tiles">
      ${tiles.map(([l, v]) => `<div class="card admin-tile"><div class="admin-tile-v">${v == null ? '—' : Number(v).toLocaleString()}</div><div class="admin-tile-l">${l}</div></div>`).join('')}
    </div>
    <div class="card admin-block">
      <div class="admin-block-head"><span>Members &amp; roles</span><span class="admin-count">${users.length} member${users.length === 1 ? '' : 's'}</span></div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Member</th><th>Roles</th><th>Grant / revoke</th></tr></thead>
          <tbody>
            ${users.map((u) => {
              const r = roleOf(u);
              return `<tr>
                <td>
                  <div class="admin-user">
                    <span class="avatar" style="width:28px;height:28px;background:${esc(u.color ?? '#4A5568')};font-size:10px">${esc(adminInitials(u))}</span>
                    <span class="admin-user-name">${esc(u.name ?? u.id)}</span>
                  </div>
                </td>
                <td>
                  <div class="admin-badges">
                    ${r.maven ? '<span class="badge badge-maven">MAVEN ✓</span>' : ''}
                    ${r.moderator ? '<span class="badge badge-mod">MOD</span>' : ''}
                    ${r.admin ? '<span class="badge badge-verified">ADMIN</span>' : ''}
                    ${!r.maven && !r.moderator && !r.admin ? '<span class="badge badge-seeker">MEMBER</span>' : ''}
                  </div>
                </td>
                <td>
                  <div class="admin-actions">
                    ${roleBtn(u, 'mavens', r.maven, 'maven')}
                    ${roleBtn(u, 'moderators', r.moderator, 'mod')}
                    ${roleBtn(u, 'admins', r.admin, 'admin')}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card admin-block">
      <div class="admin-block-head"><span>Spaces</span><span class="admin-count">${spaces.length}</span></div>
      <div class="admin-spaces">
        ${spaces.map((s) => `
          <div class="admin-space-row ${s.archived ? 'archived' : ''}">
            <span class="admin-space-name">${esc(s.name)}${s.archived ? ' <span class="badge badge-seeker">ARCHIVED</span>' : ''}</span>
            <span class="admin-space-count">${s.count ?? 0} posts</span>
            <button class="btn btn-ghost admin-space-btn" data-action="admin-space-rename" data-space="${esc(s.id)}" data-name="${esc(s.name)}">Rename</button>
            <button class="btn btn-quiet admin-space-btn" data-action="admin-space-archive" data-space="${esc(s.id)}" data-archived="${s.archived ? '1' : '0'}">${s.archived ? 'Restore' : 'Archive'}</button>
          </div>`).join('')}
      </div>
      <div class="admin-space-add">
        <input id="admin-new-space" class="input" placeholder="New space name…" value="${esc(state.newSpace)}" autocomplete="off">
        <button class="btn btn-primary" data-action="admin-space-add">Add space</button>
      </div>
    </div>
    <div class="card admin-block admin-links">
      <span>Moderation</span>
      <button class="btn btn-ghost" data-action="go" data-to="review">Open review queue →</button>
    </div>
  </div>`;
}

/* ---------------- root render ---------------- */
function render() {
  if (!state.me) {
    $app.innerHTML = renderLanding();
    return;
  }
  const r = state.route.name;
  let main = '';
  if (r === 'feed') main = renderFeed();
  else if (r === 'post') main = renderPostDetail();
  else if (r === 'communities') main = renderCommunities();
  else if (r === 'u' || r === 'me') main = renderProfile();
  else if (r === 'settings') main = renderSettings();
  else if (r === 'review') main = state.me.isModerator ? renderReview() : renderFeed();
  else if (r === 'search') main = renderSearch();
  else if (r === 'maven') main = renderMaven();
  else if (r === 'admin') main = state.me.isAdmin ? renderAdmin() : renderFeed();
  else if (r === 'karma') main = renderKarma();
  else if (r === 'hub') main = renderHub();
  else main = renderFeed();

  $app.innerHTML = `
    ${renderTopbar()}
    <div class="shell">
      ${renderSidebar()}
      <main>${main}</main>
    </div>
    ${renderLab()}
    ${renderDemo()}
  `;
}

/* ---------------- actions ---------------- */
const actions = {
  'toggle-signin': () => { state.ui.signin = !state.ui.signin; render(); },
  'auth-mode': (el) => { state.authMode = el.dataset.mode; state.authError = ''; render(); },
  'register': async () => {
    const email = document.getElementById('reg-email')?.value.trim() ?? '';
    const username = document.getElementById('reg-username')?.value.trim() ?? '';
    const password = document.getElementById('reg-password')?.value ?? '';
    state.authError = '';
    if (!email || !username || !password) { state.authError = 'Email, username and password are all required.'; render(); return; }
    if (password.length < 8) { state.authError = 'Password must be at least 8 characters.'; render(); return; }
    try {
      const { me } = await api('/api/register', { method: 'POST', body: { email, username, password } });
      state.me = me;
      state.authError = '';
      await refreshBootstrap();
      nav('#/feed');
      await loadRouteData();
      render();
      toast(`Welcome, ${me.name} — your account is ready`);
    } catch (err) {
      state.authError = err.message || 'Could not create your account.';
      render();
    }
  },
  'signin-password': async () => {
    const username = document.getElementById('login-username')?.value.trim() ?? '';
    const password = document.getElementById('login-password')?.value ?? '';
    state.authError = '';
    if (!username || !password) { state.authError = 'Enter your username and password.'; render(); return; }
    try {
      const { me } = await api('/api/session', { method: 'POST', body: { username, password } });
      state.me = me;
      state.authError = '';
      await refreshBootstrap();
      nav('#/feed');
      await loadRouteData();
      render();
      toast(`Signed in as ${me.name}`);
    } catch (err) {
      state.authError = err.message || 'Could not sign you in.';
      render();
    }
  },
  'demo-signin': async (el) => {
    const { me } = await api('/api/session', { method: 'POST', body: { mode: 'demo', userId: el.dataset.user } });
    state.me = me;
    await refreshBootstrap();
    nav('#/feed');
    await loadRouteData();
    render();
    toast(`Signed in as ${me.name}`);
  },
  'join-invite': async () => {
    const code = document.getElementById('invite-code')?.value ?? '';
    const pseudonym = document.getElementById('invite-name')?.value ?? '';
    try {
      const { me } = await api('/api/session', { method: 'POST', body: { mode: 'invite', code, pseudonym } });
      state.me = me;
      await refreshBootstrap();
      nav('#/feed');
      await loadRouteData();
      render();
      toast(`Welcome, ${me.name} — your Ghostfolio account is being provisioned`);
    } catch (err) { toast(err.message); }
  },
  'request-join': async () => {
    const voucher = document.getElementById('voucher')?.value ?? '';
    await api('/api/session', { method: 'POST', body: { mode: 'request', voucher } });
    toast('Request sent — a moderator will review it (your number stays hidden)');
  },
  'sign-out': async () => {
    await api('/api/session', { method: 'DELETE' });
    state.me = null; state.ui.menu = false; state.ui.signin = false;
    await refreshBootstrap();
    state.teaser = await apiSafe('/api/teaser', TEASER_FALLBACK);
    render();
  },
  'go': async (el) => {
    state.ui.menu = false; state.ui.country = false;
    const target = `#/${el.dataset.to}`;
    // Same route → hashchange won't fire, so close the menus and re-render here.
    if (location.hash === target) render();
    else nav(target);
  },
  'toggle-menu': () => { state.ui.menu = !state.ui.menu; state.ui.country = false; render(); },
  'toggle-country': () => { state.ui.country = !state.ui.country; state.ui.menu = false; render(); },
  'toggle-lab': () => { state.ui.lab = !state.ui.lab; render(); },
  'close-lab': () => { state.ui.lab = false; render(); },
  'toggle-demo': async () => {
    state.ui.demo = !state.ui.demo;
    render();
    if (state.ui.demo) { state.demo = await api('/api/demo/status'); render(); }
  },
  'demo-refresh': async () => { state.demo = await api('/api/demo/status'); render(); toast('Wiring re-probed'); },
  'pick-country': async (el) => {
    const { me } = await api('/api/me/settings', { method: 'PUT', body: { country: el.dataset.code } });
    state.me = me;
    state.ui.country = false;
    await refreshBootstrap();
    nav('#/communities');
    render();
    toast(`Home base: ${state.boot.countries.find((c) => c.code === el.dataset.code)?.name ?? el.dataset.code}`);
  },
  'pick-space': async (el) => {
    state.space = el.dataset.space;
    if (state.route.name !== 'feed') { nav('#/feed'); return; }
    await loadRouteData();
    render();
  },
  'open-composer': () => { state.ui.composer = true; render(); document.getElementById('draft-title')?.focus(); },
  'close-composer': () => { state.ui.composer = false; render(); },
  'pick-draft-space': (el) => { captureDraft(); state.draft.space = el.dataset.space; render(); },
  'submit-post': async () => {
    captureDraft();
    if (!state.draft.title.trim()) { toast('Give it a title first'); return; }
    if (state.ui.sending) return; // in-flight guard against double-submit
    state.ui.sending = true;
    try {
      await api('/api/posts', { method: 'POST', body: state.draft });
      const spaceName = state.boot.spaces.find((s) => s.id === state.draft.space)?.name ?? 'the community';
      state.draft = { title: '', body: '', space: 'help' };
      state.ui.composer = false;
      state.space = 'all';
      await loadRouteData();
      render();
      toast(`Posted to ${spaceName}`);
    } catch (err) { toast(err.message); }
    finally { state.ui.sending = false; }
  },
  'open-post': (el) => { nav(`#/post/${encodeURIComponent(el.dataset.post)}`); },
  'open-profile': (el) => { nav(`#/u/${encodeURIComponent(el.dataset.user)}`); },
  'open-maven': (el) => { nav(`#/maven/${encodeURIComponent(el.dataset.user)}`); },
  'maven-tab': (el) => { state.mavenTab = el.dataset.tab; render(); },
  'hub-book': async (el) => {
    const svc = el.dataset.svc;
    try {
      await api('/api/hub/bookings', { method: 'POST', body: { serviceId: svc } });
      const bk = await apiSafe('/api/hub/bookings', { bookings: state.hubBookings ?? [] });
      state.hubBookings = bk.bookings ?? [];
      render();
      toast('Booking request sent — the expert will follow up in the community.');
    } catch (err) { toast(err.message); }
  },
  'search-tab': (el) => { state.searchTab = el.dataset.tab; render(); },
  'search-join': async (el) => {
    const id = el.dataset.community;
    try {
      const { status } = await api(`/api/communities/${encodeURIComponent(id)}/join`, { method: 'POST' });
      const c = state.searchData?.communities?.find((x) => x.id === id);
      if (c && status !== 'requested') c.joined = true;
      await refreshBootstrap();
      render();
      toast(status === 'requested' ? 'Request sent to the moderators' : `Joined ${c?.name ?? 'community'}`);
    } catch (err) { toast(err.message); }
  },
  'admin-role': async (el) => {
    const { user: id, role, act, label } = el.dataset;
    try {
      await api(`/api/admin/users/${encodeURIComponent(id)}/role`, { method: 'POST', body: { role, action: act } });
      await loadRouteData();
      render();
      toast(`${act === 'grant' ? 'Granted' : 'Revoked'} ${label ?? role} — ${id}`);
    } catch (err) { toast(err.message); }
  },
  'admin-space-add': async () => {
    const name = document.getElementById('admin-new-space')?.value.trim() ?? '';
    if (!name) { toast('Name the space first'); return; }
    try {
      await api('/api/admin/spaces', { method: 'POST', body: { name } });
      state.newSpace = '';
      await refreshBootstrap();
      render();
      toast(`Space “${name}” added`);
    } catch (err) { toast(err.message); }
  },
  'admin-space-rename': async (el) => {
    const id = el.dataset.space;
    const next = window.prompt('Rename space', el.dataset.name);
    if (next == null || !next.trim()) return;
    try {
      await api(`/api/admin/spaces/${encodeURIComponent(id)}`, { method: 'PUT', body: { name: next.trim() } });
      await refreshBootstrap();
      render();
      toast('Space renamed');
    } catch (err) { toast(err.message); }
  },
  'admin-space-archive': async (el) => {
    const id = el.dataset.space;
    const archived = el.dataset.archived !== '1';
    try {
      await api(`/api/admin/spaces/${encodeURIComponent(id)}`, { method: 'PUT', body: { archived, action: archived ? 'archive' : 'restore' } });
      await refreshBootstrap();
      render();
      toast(archived ? 'Space archived' : 'Space restored');
    } catch (err) { toast(err.message); }
  },
  'react': async (el) => {
    const { post: postId, type, context } = el.dataset;
    const list = context === 'detail' ? [state.post] : state.posts;
    const post = list.find((p) => p && p.id === postId);
    if (post) { // optimistic
      const r = post.reactions[type];
      r.on = !r.on;
      r.n += r.on ? 1 : -1;
      render();
      if (r.on) toast(`+1 ${type[0].toUpperCase()}${type.slice(1)}`);
    }
    try {
      const { reactions } = await api(`/api/posts/${encodeURIComponent(postId)}/react`, { method: 'POST', body: { type } });
      if (post) { post.reactions = reactions; render(); }
    } catch { /* optimistic state stands corrected on next load */ }
  },
  'toggle-flag': (el) => {
    state.ui.flagFor = state.ui.flagFor === el.dataset.post ? null : el.dataset.post;
    render();
  },
  'flag': async (el) => {
    const { post: postId, reason } = el.dataset;
    state.ui.flagFor = null;
    await api(`/api/posts/${encodeURIComponent(postId)}/flag`, { method: 'POST', body: { reason } });
    const apply = (p) => { if (p && p.id === postId) p.myFlag = reason; };
    state.posts.forEach(apply); apply(state.post);
    render();
    toast(`Flagged as ${reason} — sent to the review queue`);
  },
  'send-reply': async (el) => {
    const text = document.getElementById('reply-input')?.value ?? '';
    if (!text.trim() || state.ui.sending) return; // in-flight guard: Enter twice ≠ two comments
    state.ui.sending = true;
    try {
      const { post } = await api(`/api/posts/${encodeURIComponent(el.dataset.post)}/comments`, { method: 'POST', body: { text } });
      state.post = post;
      state.reply = '';
      render();
      toast('Reply posted');
    } finally { state.ui.sending = false; }
  },
  'join-community': async (el) => {
    const id = el.dataset.community;
    const { status } = await api(`/api/communities/${encodeURIComponent(id)}/join`, { method: 'POST' });
    await refreshBootstrap();
    render();
    const c = state.boot.communities.find((x) => x.id === id);
    toast(status === 'requested' ? `Request sent to ${c?.name} moderators` : `Welcome to ${c?.name}`);
  },
  'profile-tab': (el) => { state.profileTab = el.dataset.tab; render(); },
  'toggle-portfolio': async () => {
    const { me } = await api('/api/me/settings', { method: 'PUT', body: { portfolioPublic: !state.me.portfolioPublic } });
    state.me = me;
    if (state.route.name === 'me' || state.route.name === 'u') await loadRouteData();
    render();
    toast(me.portfolioPublic ? 'Portfolio is now public — allocation % only' : 'Portfolio is now private');
  },
  'toggle-setting': async (el) => {
    const key = el.dataset.key;
    const { me } = await api('/api/me/settings', { method: 'PUT', body: { [key]: !state.me[key] } });
    state.me = me;
    render();
    const labels = {
      waConsentMirror: me.waConsentMirror ? 'WhatsApp mirroring on — synced to the bridge' : 'WhatsApp mirroring off — honored within 60 s',
      waNotifs: me.waNotifs ? 'WhatsApp notifications on' : 'WhatsApp notifications off',
      portfolioPublic: me.portfolioPublic ? 'Portfolio is now public — allocation % only' : 'Portfolio is now private',
    };
    toast(labels[key] ?? 'Saved');
  },
  'open-ghostfolio': async () => {
    const { url, hint } = await api('/api/me/portfolio/sso', { method: 'POST' });
    if (url) { window.open(url, '_blank'); toast('Opening Ghostfolio — signed in with one click'); }
    else toast(hint ?? 'Ghostfolio is not running');
  },
  'pick-variant': async (el) => {
    const { key, variant } = el.dataset;
    const { experiments } = await api('/api/me/experiments', { method: 'PUT', body: { [key]: variant } });
    state.me.experiments = experiments;
    render();
    const ex = state.boot.experimentsCatalog[key];
    toast(`${ex.label}: ${ex[variant].name}`);
  },
  'pick-theme': async (el) => {
    const id = el.dataset.theme;
    applyTheme(id); // optimistic — the skin swaps instantly
    const { theme } = await api('/api/me/theme', { method: 'PUT', body: { theme: id } });
    if (state.me) state.me.theme = theme;
    applyTheme(theme);
    render();
    toast(`Theme: ${state.boot.themesCatalog?.[theme]?.name ?? theme}`);
  },
  'review-act': async (el) => {
    await api(`/api/review-queue/${encodeURIComponent(el.dataset.id)}`, { method: 'POST', body: { action: el.dataset.act } });
    state.review = await api('/api/review-queue');
    await refreshMe();
    render();
    toast(el.dataset.act === 'remove' ? 'Post removed from the feed' : 'Flags dismissed');
  },
  // Structured posting penalties. Remove also bans the author from posting for 3 days.
  'review-penalty': async (el) => {
    const { id, act, author } = el.dataset;
    await api(`/api/review-queue/${encodeURIComponent(id)}/${act}`, {
      method: 'POST',
      body: act === 'remove' ? { banDays: 3 } : {},
    });
    state.review = await api('/api/review-queue');
    await refreshMe();
    render();
    toast(act === 'remove' ? `Removed · @${author} banned from posting for 3 days` : 'Dismissed · content kept');
  },
  'feed-sort': async (el) => {
    const sort = el.dataset.sort;
    if (sort === state.feedSort) return;
    state.feedSort = sort;
    render(); // instant tab feedback; no full page reload
    await loadRouteData(); // refetch with the new sort
    render();
  },
  'teaser-gate': (el) => {
    // A teaser card never opens the full thread — it opens the join/register gate (#7-A).
    state.authMode = 'register';
    state.ui.joinGate = true;
    state.ui.signin = false;
    state.authError = '';
    render();
    document.querySelector('.landing-auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('reg-email')?.focus();
  },
  'toggle-cal-add': () => { state.ui.calAdd = !state.ui.calAdd; render(); },
  'cal-add': async () => {
    const v = (id) => document.getElementById(id)?.value ?? '';
    const title = v('cal-f-title').trim();
    if (!title) { toast('Give the event a title'); return; }
    const body = {
      title,
      date: v('cal-f-date') || new Date().toISOString().slice(0, 10),
      kind: v('cal-f-kind').trim() || 'Session',
      host: v('cal-f-host').trim() || state.me.name,
      scope: v('cal-f-scope').trim() || 'US Investment',
    };
    // Optimistic local add (keeps the demo whole if the calendar endpoint isn't live yet).
    const ev = { id: `evx_${Date.now()}`, ...body };
    const next = [...calEvents(), ev].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    state.calendar = { events: next };
    state.ui.calAdd = false;
    render();
    toast(`Event added — ${title}`);
    try {
      await api('/api/calendar', { method: 'POST', body });
      const fresh = await apiSafe('/api/calendar', null);
      if (fresh) { state.calendar = fresh; render(); }
    } catch { /* backend not live yet — optimistic add stands */ }
  },
  'cal-remove': async (el) => {
    const id = el.dataset.id;
    state.calendar = { events: calEvents().filter((e) => e.id !== id) };
    render();
    toast('Event removed');
    try { await api(`/api/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* optimistic */ }
  },
  'demo-wa-send': async () => {
    const userId = document.getElementById('demo-wa-user')?.value;
    const text = document.getElementById('demo-wa-text')?.value ?? '';
    if (!text.trim()) { toast('Type a message first'); return; }
    const result = await api('/api/demo/wa-inbound', { method: 'POST', body: { userId, text } });
    // wa-bridge path posts back asynchronously through /posts.json — give it a beat.
    await new Promise((r) => setTimeout(r, 600));
    state.space = 'all';
    if (state.route.name !== 'feed') nav('#/feed');
    await loadRouteData();
    state.demo = await api('/api/demo/status');
    render();
    toast(result.path === 'wa-bridge'
      ? `Mirrored through the real wa-bridge in ${result.ms} ms — well under the 60 s promise`
      : `Mirrored (built-in fallback) in ${result.ms} ms — start wa-bridge for the full loop`);
  },
  'demo-signup': async () => {
    const r = await api('/api/demo/signup', { method: 'POST' });
    state.demo = await api('/api/demo/status');
    render();
    toast(`${r.userId}: first webhook → ${r.first}, re-fire → ${r.second} (no duplicate)`);
  },
  'demo-reset': async () => {
    await api('/api/demo/reset', { method: 'POST' });
    location.hash = '#/feed';
    location.reload();
  },
};

function captureDraft() {
  state.draft.title = document.getElementById('draft-title')?.value ?? state.draft.title;
  state.draft.body = document.getElementById('draft-body')?.value ?? state.draft.body;
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    // click-away closes menus
    if (!e.target.closest('.menu') && !e.target.closest('.flag-menu') && (state.ui.menu || state.ui.country || state.ui.flagFor)) {
      state.ui.menu = false; state.ui.country = false; state.ui.flagFor = null;
      render();
    }
    return;
  }
  if (el.dataset.stop) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  // Clicking inside the lab card must not trigger the overlay's close action —
  // but the explicit Done button (also close-lab) always works.
  if (el.classList.contains('lab-overlay') && e.target.closest('[data-stop]')) return;
  try { await fn(el); } catch (err) { if (err.message !== 'unauthorized') toast(err.message); }
});

let searchDebounce = null;
function scheduleLiveSearch() {
  clearTimeout(searchDebounce);
  const q = state.search;
  searchDebounce = setTimeout(async () => {
    if (state.route.name !== 'search') return;
    const query = q.trim();
    // Keep the URL honest for deep-linking without a reload (replaceState won't refire hashchange).
    const target = query ? `#/search/${encodeURIComponent(query)}` : '#/search';
    if (location.hash !== target) { history.replaceState(null, '', target); state.route = { name: 'search', param: query }; }
    try {
      state.searchData = query
        ? await api(`/api/search?q=${encodeURIComponent(query)}&tab=${encodeURIComponent(state.searchTab)}`)
        : { q: '', counts: { all: 0, posts: 0, communities: 0, comments: 0, profiles: 0 }, posts: [], communities: [], comments: [], profiles: [] };
    } catch (err) { if (err.message !== 'unauthorized') toast(err.message); return; }
    const live = document.getElementById('search');
    const pos = live ? live.selectionStart : null;
    render();
    const el = document.getElementById('search');
    if (el) { el.focus(); if (pos != null) el.setSelectionRange(pos, pos); }
  }, 240);
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    state.search = e.target.value;
    if (state.route.name === 'feed') {
      // re-render but keep focus + caret
      const pos = e.target.selectionStart;
      render();
      const el = document.getElementById('search');
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    } else if (state.route.name === 'search') {
      scheduleLiveSearch();
    }
  }
  if (e.target.id === 'reply-input') state.reply = e.target.value;
  if (e.target.id === 'draft-title' || e.target.id === 'draft-body') captureDraft();
  if (e.target.id === 'admin-new-space') state.newSpace = e.target.value;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'reply-input') {
    document.querySelector('[data-action="send-reply"]')?.click();
  }
  if (e.key === 'Enter' && e.target.id === 'invite-code') {
    document.querySelector('[data-action="join-invite"]')?.click();
  }
  if (e.key === 'Enter' && e.target.id === 'search') {
    const q = state.search.trim();
    if (q) nav(`#/search/${encodeURIComponent(q)}`);
  }
  if (e.key === 'Enter' && (e.target.id === 'reg-password' || e.target.id === 'reg-username' || e.target.id === 'reg-email')) {
    document.querySelector('[data-action="register"]')?.click();
  }
  if (e.key === 'Enter' && (e.target.id === 'login-username' || e.target.id === 'login-password')) {
    document.querySelector('[data-action="signin-password"]')?.click();
  }
  if (e.key === 'Enter' && e.target.id === 'admin-new-space') {
    document.querySelector('[data-action="admin-space-add"]')?.click();
  }
  if (e.key === 'Escape') {
    // Only re-render if something was actually open — otherwise Escape while typing would
    // needlessly rebuild the app and drop the caret.
    if (state.ui.lab || state.ui.menu || state.ui.country || state.ui.flagFor || state.ui.demo) {
      state.ui.lab = false; state.ui.menu = false; state.ui.country = false; state.ui.flagFor = null; state.ui.demo = false;
      render();
    }
  }
});

/* ---------------- boot ---------------- */
// Skin the whole app by stamping [data-theme] on <html> — a pure CSS token swap (styles.css).
function applyTheme(theme) {
  const id = theme && theme !== 'warm' ? theme : '';
  if (id) document.documentElement.setAttribute('data-theme', id);
  else document.documentElement.removeAttribute('data-theme');
}

async function refreshBootstrap() {
  state.boot = await api('/api/bootstrap');
  if (state.boot.me) state.me = state.boot.me;
  applyTheme(state.me?.theme ?? 'warm');
}

async function refreshMe() {
  await refreshBootstrap();
}

(async function boot() {
  try {
    await refreshBootstrap();
  } catch {
    state.boot = { stats: { members: '—', online: '—', mavens: '—', communities: '—' }, demoAccounts: [] };
  }
  parseRoute();
  if (state.me) await loadRouteData();
  else state.teaser = await apiSafe('/api/teaser', TEASER_FALLBACK);
  render();
})();
