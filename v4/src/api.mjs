// Member-facing JSON API for the Phase-1 prototype.
// Enforces the Phase-1 non-negotiables server-side:
//   #1 no phone numbers on any member-facing surface (defensive strip on every write)
//   #3 negative reactions are private-to-queue, positive are the only public sentiment
//   #4 portfolio private by default; public view = allocation % only, never dollar values
//   #7 signed-out users see only the landing page (every member route 401s)
import { json, readJson, parseCookies, newToken, stripPhoneNumbers, timeAgo, HttpError, hashPassword, verifyPassword } from './util.mjs';

const POSITIVE_REACTIONS = ['helpful', 'insightful', 'actionable', 'like'];
const NEGATIVE_REASONS = ['Misleading', 'Low Effort', 'Spam', 'Violation', 'Marketing'];
const EXPERIMENTS = {
  density: {
    label: 'Feed density',
    question: 'How dense should the feed read?',
    A: { name: 'Comfortable cards', blurb: 'Roomy cards with full preview text — the design-contract default.' },
    B: { name: 'Compact rows', blurb: 'Reddit-classic density: tighter rows, more posts per screen.' },
  },
  reactions: {
    label: 'Reaction row',
    question: 'Labeled pills, or quiet counts?',
    A: { name: 'Labeled pills', blurb: 'Emoji + word on every pill. Zero learning curve.' },
    B: { name: 'Quiet counts', blurb: 'Emoji + count only; labels appear on hover. Less chrome.' },
  },
  rail: {
    label: 'Right rail',
    question: 'Context rail or pure focus?',
    A: { name: 'Context rail', blurb: 'Community stats + mavens beside the feed.' },
    B: { name: 'Zen focus', blurb: 'Single column. Nothing beside the conversation.' },
  },
};

// Theme Options 1a–1d + the default. A pure token swap on the client; flip live in the A/B Lab.
const THEMES = {
  warm: { name: 'Warm Paper', tag: 'DEFAULT', blurb: 'Teal on ivory, saffron diamond — the design-contract default.', swatches: ['#F6F5F1', '#0F766E', '#C05621', '#1D1D1F'] },
  midnight: { name: 'Midnight Bazaar', tag: '1A', blurb: 'Dark-first, marigold on charcoal, serif display. Evening browsing.', swatches: ['#16171B', '#E8A33D', '#8FD3A8', '#7A6BC9'] },
  sandalwood: { name: 'Sandalwood & Ink', tag: '1B', blurb: 'Heritage ledger — terracotta + peacock, serif voice. Trust through age.', swatches: ['#F3EDE2', '#B4552D', '#146B5C', '#26201A'] },
  porcelain: { name: 'Porcelain Slate', tag: '1C', blurb: 'Cool fintech-crisp, peacock-blue, densest corners. Scan-and-go.', swatches: ['#F5F6F8', '#0C637C', '#16181D', '#E3F0F4'] },
  haldi: { name: 'Haldi & Rani', tag: '1D', blurb: 'Festival warmth — rani pink + haldi, soft 16px cards. Belonging-first.', swatches: ['#FFF8F2', '#C2185B', '#FBEFC9', '#0F766E'] },
};
const THEME_IDS = Object.keys(THEMES);

const PSEUDONYM_POOL = [
  'masala_margin', 'rupee_rocket', 'ladoo_ledger', 'chai_compound', 'dosa_dividend',
  'bindi_bull', 'samosa_saver', 'mango_market', 'jalebi_yield', 'karma_kettle',
];

export function createApi({ store, integrations, config }) {
  const S = () => store.state;

  // ---------- session helpers ----------
  function currentUser(req) {
    const token = parseCookies(req)[config.cookieName];
    const session = token && S().sessions[token];
    return session ? S().users[session.userId] ?? null : null;
  }

  function startSession(res, userId) {
    const token = newToken();
    S().sessions[token] = { userId, createdAt: Date.now() };
    store.save();
    res.setHeader('set-cookie', `${config.cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`);
  }

  function endSession(req, res) {
    const token = parseCookies(req)[config.cookieName];
    if (token) { delete S().sessions[token]; store.save(); }
    res.setHeader('set-cookie', `${config.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  // ---------- view models (never leak private fields) ----------
  function authorCard(userId, { withKarma = false } = {}) {
    const u = S().users[userId];
    if (!u) return { id: userId, name: userId, initials: '–', color: '#4A5568', isMaven: false, isSeeker: false };
    const card = {
      id: u.id,
      name: u.name,
      initials: u.initials,
      color: u.avatarColor,
      isMaven: u.groups.includes('mavens'),
      isModerator: u.groups.includes('moderators'),
      isSeeker: u.role === 'seeker',
      isBridge: u.role === 'bridge',
      credential: u.groups.includes('mavens') ? u.credential ?? null : null,
    };
    // Karma (engagement-only, #9) is opt-in so the member feed's author chips stay lightweight
    // and the Phase-1 feed carries no karma; profiles/search/leaderboard/me ask for it explicitly.
    if (withKarma) {
      const k = karmaFor(u.id);
      card.karma = k;
      card.tier = tierFor(k);
    }
    return card;
  }

  function myFlagFor(userId, postId) {
    const q = S().reviewQueue.find((item) => item.postId === postId && item.status === 'pending');
    if (!q) return null;
    const mine = q.flags?.find((f) => f.by === userId);
    return mine ? mine.reason : (q.flaggedBy?.includes(userId) ? q.reason : null);
  }

  function postVM(post, viewer, { withComments = false } = {}) {
    const mine = S().reactionsBy[`${viewer.id}:${post.id}`] || {};
    const vm = {
      id: post.id,
      space: post.space,
      spaceName: S().spaces.find((s) => s.id === post.space)?.name ?? post.space,
      author: authorCard(post.author),
      via: post.via,
      createdAt: post.createdAt,
      timeAgo: timeAgo(post.createdAt),
      title: post.title,
      body: post.body,
      commentCount: post.comments.length,
      reactions: Object.fromEntries(POSITIVE_REACTIONS.map((k) => [k, { n: post.reactions[k] ?? 0, on: !!mine[k] }])),
      myFlag: myFlagFor(viewer.id, post.id),
    };
    if (withComments) {
      vm.bodyFull = post.bodyFull;
      vm.comments = post.comments.map((c) => ({
        id: c.id,
        author: authorCard(c.author),
        createdAt: c.createdAt,
        timeAgo: timeAgo(c.createdAt),
        text: c.text,
      }));
    }
    return vm;
  }

  function visiblePosts() {
    return S().posts.filter((p) => !p.removed);
  }

  function communityVM(c, user) {
    return {
      ...c,
      joined: user.joined.includes(c.id),
      requested: user.requested.includes(c.id),
    };
  }

  function meVM(user) {
    return {
      id: user.id,
      name: user.name,
      initials: user.initials,
      color: user.avatarColor,
      role: user.role,
      groups: user.groups,
      credential: user.credential ?? null,
      desiVerified: user.desiVerified,
      memberSince: user.memberSince,
      country: user.country,
      waLinked: user.waLinked,
      waConsentMirror: user.waConsentMirror,
      waNotifs: user.waNotifs,
      portfolioPublic: user.portfolioPublic,
      experiments: user.experiments,
      theme: user.theme ?? 'warm',
      isMaven: user.groups.includes('mavens'),
      isModerator: user.groups.includes('moderators'),
      isAdmin: user.groups.includes('admins'),
      karma: karmaFor(user.id),
      tier: tierFor(karmaFor(user.id)),
      pendingFlags: user.groups.includes('moderators') || user.groups.includes('admins')
        ? S().reviewQueue.filter((q) => q.status === 'pending').length
        : undefined,
    };
  }

  function reactionsReceived(userId) {
    let n = 0;
    for (const p of S().posts) {
      if (p.author === userId) for (const k of POSITIVE_REACTIONS) n += p.reactions[k] ?? 0;
    }
    return n;
  }

  function totalReactions(post) {
    return POSITIVE_REACTIONS.reduce((n, k) => n + (post.reactions[k] ?? 0), 0);
  }

  const isModOrAdmin = (u) => !!u && (u.groups.includes('moderators') || u.groups.includes('admins'));

  // Reddit-style "hot": positive reactions + a heavier weight on genuine discussion (comments).
  // Recency is only a tie-break at the call site (newer wins equal scores).
  function hotScore(post) {
    return totalReactions(post) + 2 * post.comments.length;
  }

  // ---------- karma (ENGAGEMENT ONLY — non-negotiable #9) ----------
  // Karma counts reactions RECEIVED on a member's posts and comments, weighted by reaction type.
  // Portfolio value and % returns can NEVER enter this path — recognition ranks contribution,
  // never money. Accepted answers would add +5 each, but Phase-1 tracks none, so that term is 0.
  const KARMA_WEIGHTS = { actionable: 3, helpful: 3, insightful: 2, like: 1 };
  const KARMA_TIERS = [[10000, 'Luminary'], [2000, 'Anchor'], [500, 'Trusted'], [100, 'Regular'], [0, 'New Arrival']];
  function tierFor(karma) {
    for (const [min, name] of KARMA_TIERS) if (karma >= min) return name;
    return 'New Arrival';
  }
  function karmaFor(userId) {
    let karma = 0;
    for (const p of S().posts) {
      if (p.removed) continue; // moderated-out content grants no karma
      if (p.author === userId) {
        for (const k in KARMA_WEIGHTS) karma += (p.reactions[k] ?? 0) * KARMA_WEIGHTS[k];
      }
      for (const c of p.comments) {
        if (c.author === userId) {
          for (const k in KARMA_WEIGHTS) karma += (c.reactions?.[k] ?? 0) * KARMA_WEIGHTS[k];
        }
      }
    }
    return karma;
  }

  // Public surfaces never show a currency amount (#4/#8). Drop any currency symbol that sits in
  // front of a number so an educational "$10k" reads as "10k" on the signed-out teaser.
  const scrubCurrency = (text) => String(text ?? '').replace(/[$₹£]\s?(?=\d)/g, '');
  function teaserSnippet(text, len = 160) {
    const t = scrubCurrency(String(text ?? '').replace(/\s+/g, ' ').trim());
    return t.length > len ? `${t.slice(0, len - 1).trimEnd()}…` : t;
  }

  // A short excerpt centred on the first occurrence of the query (already phone-stripped at rest).
  function snippet(text, q, len = 140) {
    const t = String(text ?? '');
    const i = t.toLowerCase().indexOf(String(q).toLowerCase());
    if (i < 0) return t.length > len ? `${t.slice(0, len).trimEnd()}…` : t;
    const start = Math.max(0, i - 45);
    const end = Math.min(t.length, i + q.length + 80);
    return `${start > 0 ? '…' : ''}${t.slice(start, end).trim()}${end < t.length ? '…' : ''}`;
  }

  // Admin-only summary. Email appears here (the single admin-scoped exception, story 4/#4);
  // it must never travel through authorCard/meVM which power member surfaces.
  function adminUserSummary(u) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      groups: u.groups,
      credential: u.groups.includes('mavens') ? (u.credential ?? null) : null,
      isMaven: u.groups.includes('mavens'),
      isModerator: u.groups.includes('moderators'),
      isAdmin: u.groups.includes('admins'),
      joined: u.joinedAt ? new Date(u.joinedAt).toISOString() : u.memberSince,
      postCount: S().posts.filter((p) => p.author === u.id).length,
    };
  }

  // ---------- maven performance (PERCENT-ONLY; currency can never enter this path) ----------
  const round = (n, d = 2) => { const f = 10 ** d; return Math.round(n * f) / f; };
  const compoundPct = (pcts) => (pcts.reduce((acc, p) => acc * (1 + p / 100), 1) - 1) * 100;
  const monthStartMs = (ym) => { const [y, m] = String(ym).split('-').map(Number); return Date.UTC(y || 2026, (m || 1) - 1, 1); };

  // A percent index (100 at inception) sampled to ~150 points — NOT a currency series.
  function buildSeries(monthly) {
    const bounds = [100];
    for (const m of monthly) bounds.push(bounds[bounds.length - 1] * (1 + m.pct / 100));
    const seg = Math.max(1, monthly.length);
    const total = 150;
    const startMs = monthStartMs(monthly[0]?.ym ?? `${new Date().getFullYear()}-01`);
    const endMs = monthStartMs(monthly[seg - 1]?.ym ?? `${new Date().getFullYear()}-01`) + 30 * 86_400_000;
    const pts = [];
    for (let i = 0; i < total; i++) {
      const frac = i / (total - 1);
      const t = frac * seg;
      const k = Math.min(seg - 1, Math.floor(t));
      const f = t - k;
      const a = bounds[k];
      const b = bounds[k + 1] ?? bounds[k];
      let idx = a > 0 ? a * Math.pow(b / a, f) : b;
      idx *= 1 + Math.sin(i * 1.7) * 0.0035; // deterministic intra-month wiggle (±0.35%), no RNG
      const ms = startMs + (endMs - startMs) * frac;
      pts.push({ date: new Date(ms).toISOString().slice(0, 10), index: round(idx, 2) });
    }
    return pts;
  }

  // Fallback for a maven credentialed at runtime with no seeded block: a plausible,
  // deterministic monthly stream anchored on their declared YTD. Still percent-only.
  function defaultPerformance(u) {
    const base = ((u.portfolio?.ytd ?? 8) / 12);
    const monthly = [];
    const now = new Date();
    const startY = now.getFullYear() - 1;
    let idx = 0;
    for (let y = startY; y <= now.getFullYear(); y++) {
      for (let mo = 1; mo <= 12; mo++) {
        if (y === now.getFullYear() && mo > now.getMonth() + 1) break;
        monthly.push({ ym: `${y}-${String(mo).padStart(2, '0')}`, pct: round(base + Math.sin(idx * 1.3) * 1.2, 2) });
        idx++;
      }
    }
    return {
      monthly, riskScore: 4, profitableWeeksPct: 60,
      allocation: (u.portfolio?.holdings ?? [{ t: 'Cash', pc: 100 }]).map((h) => ({ label: h.t, pct: h.pc })),
      recent: [],
    };
  }

  function buildPerformance(u) {
    const perf = u.performance ?? defaultPerformance(u);
    const monthly = (perf.monthly ?? []).map((m) => ({ ym: m.ym, pct: round(m.pct, 2) }));
    const seg = Math.max(1, monthly.length);
    const byYear = {};
    for (const m of monthly) (byYear[m.ym.slice(0, 4)] ??= []).push(m.pct);
    const yearly = Object.keys(byYear).sort().map((y) => ({ year: Number(y), pct: round(compoundPct(byYear[y]), 2) }));
    const allPcts = monthly.map((m) => m.pct);
    const cumulativePct = round(compoundPct(allPcts), 2);
    const curYear = String(new Date().getFullYear());
    const overall = {
      cumulativePct,
      annualizedPct: round((Math.pow(1 + cumulativePct / 100, 12 / seg) - 1) * 100, 2),
      ytdPct: round(compoundPct(monthly.filter((m) => m.ym.startsWith(curYear)).map((m) => m.pct)), 2),
      twoYearPct: round(compoundPct(allPcts.slice(-24)), 2),
      profitableWeeksPct: perf.profitableWeeksPct ?? Math.round((monthly.filter((m) => m.pct > 0).length / seg) * 100),
      riskScore: Math.min(7, Math.max(1, perf.riskScore ?? 4)),
    };
    const now = Date.now();
    return {
      overall,
      yearly,
      monthly,
      series: buildSeries(monthly),
      allocation: (perf.allocation ?? []).map((a) => ({ label: a.label, pct: round(a.pct, 1) })),
      recent: (perf.recent ?? []).map((r) => ({
        ticker: r.ticker,
        side: r.side === 'SELL' ? 'SELL' : 'BUY',
        at: new Date(now - (r.daysAgo ?? 0) * 86_400_000).toISOString(),
        plPct: round(r.plPct ?? 0, 2),
      })),
    };
  }

  // Shared internal path for WhatsApp-mirrored posts (used by the Discourse-compat layer
  // AND the built-in demo fallback) so attribution + privacy rules live in one place.
  function createMirroredPost({ username, title, raw }) {
    let author = S().users[username];
    // Consent is the single source of truth here (non-negotiable #5): a member who has NOT
    // consented to mirroring — even if a caller names them — is demoted to guest attribution.
    // The real wa-bridge already gates on its own consent store; this is defense-in-depth so
    // the two stores diverging can never attribute a post to a non-consenting member.
    if (author && author.role !== 'bridge' && !author.waConsentMirror) author = null;
    if (!author) {
      // Unlinked sender -> bridge guest attribution, never a phone number.
      const id = 'wa_guest';
      author = S().users[id] ?? (S().users[id] = {
        id, name: 'WhatsApp guest', email: `${id}@demo.desisquare.local`, avatarColor: '#4A5568',
        initials: 'WA', role: 'bridge', groups: [], desiVerified: false, memberSince: 'Jul 2026',
        waLinked: false, waConsentMirror: false, waNotifs: false, portfolioPublic: false,
        experiments: { density: 'A', reactions: 'A', rail: 'A' }, theme: 'warm', country: 'US', joined: [], requested: [],
        ghostfolio: null,
      });
    }
    const post = {
      id: store.newId('post'),
      space: config.mirrorSpace,
      author: author.id,
      createdAt: Date.now(),
      via: 'whatsapp',
      title: stripPhoneNumbers(title).slice(0, 140) || 'Shared from WhatsApp',
      body: stripPhoneNumbers(raw),
      bodyFull: stripPhoneNumbers(raw),
      reactions: { helpful: 0, insightful: 0, actionable: 0, like: 0 },
      removed: false,
      comments: [],
    };
    S().posts.unshift(post);
    store.save();
    return post;
  }

  // ---------- route table ----------
  // Each entry: [method, pattern, handler(req, res, params, user)]. `auth` wraps member routes.
  const routes = [];
  const route = (method, pattern, handler, { auth = true, mod = false, admin = false } = {}) => {
    const names = [];
    const regex = new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, (m) => { names.push(m.slice(1)); return '([^/]+)'; })}$`);
    routes.push({ method, regex, names, handler, auth, mod, admin });
  };

  // --- session / bootstrap ---
  route('POST', '/api/session', async (req, res) => {
    const body = await readJson(req);
    if (body.mode === 'demo') {
      const user = S().users[body.userId];
      if (!user?.isDemoLogin) return json(res, 403, { error: 'not a demo account' });
      startSession(res, user.id);
      return json(res, 200, { me: meVM(user) });
    }
    if (body.mode === 'invite') {
      const code = String(body.code ?? '').trim().toUpperCase();
      if (!S().inviteCodes.includes(code)) return json(res, 403, { error: 'invalid invite code' });
      const rawName = String(body.pseudonym ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24);
      // Reject an all-digit pseudonym: names must never look like a phone number (#1/#2).
      const safeName = /^\d+$/.test(rawName) ? '' : rawName;
      const name = safeName || PSEUDONYM_POOL[Math.floor(Math.random() * PSEUDONYM_POOL.length)];
      if (S().users[name]) return json(res, 409, { error: 'that pseudonym is taken' });
      const colors = ['#0F766E', '#54428E', '#C05621', '#4A5568', '#5F7D4F', '#8E4256'];
      const user = {
        id: name, name, email: `${name}@demo.desisquare.local`,
        avatarColor: colors[name.length % colors.length],
        initials: name.split(/[_\s]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'DS',
        role: 'peer', groups: [], desiVerified: true, memberSince: 'Jul 2026',
        waLinked: false, waConsentMirror: false, waNotifs: false, portfolioPublic: false,
        experiments: { density: 'A', reactions: 'A', rail: 'A' }, theme: 'warm', country: 'US',
        joined: ['usinv'], requested: [], ghostfolio: null,
        portfolio: { value: 0, ytd: 0, holdings: [{ t: 'Cash', pc: 100 }] },
      };
      S().users[user.id] = user;
      store.save();
      startSession(res, user.id);
      // P1-FR-06: account auto-provisioned on registration (email-verified in demo).
      integrations.provisionGhostfolio(user).catch(() => {});
      return json(res, 200, { me: meVM(user), provisioning: true });
    }
    if (body.mode === 'request') {
      integrations.event('membership_request', { voucher: stripPhoneNumbers(String(body.voucher ?? '')).slice(0, 80) || null });
      return json(res, 200, { status: 'requested' });
    }
    // Registered-account login: username (or email) + password. Demo personas carry no
    // passwordHash, so they can never authenticate here — they stay on the mode:'demo' path.
    if (typeof body.username === 'string' && typeof body.password === 'string') {
      const id = body.username.trim().toLowerCase();
      const acct = S().users[id]
        || Object.values(S().users).find((u) => (u.email || '').toLowerCase() === id);
      if (!acct || !acct.passwordHash || !verifyPassword(body.password, acct.passwordHash)) {
        return json(res, 401, { error: 'invalid username or password' });
      }
      startSession(res, acct.id);
      return json(res, 200, { me: meVM(acct) });
    }
    return json(res, 400, { error: 'unknown mode' });
  }, { auth: false });

  // --- open registration (peer account with a password) ---
  route('POST', '/api/register', async (req, res) => {
    const body = await readJson(req);
    const username = String(body.username ?? '').trim().toLowerCase();
    const email = String(body.email ?? '').trim();
    const password = String(body.password ?? '');
    // Username: pseudonymous handle. Never all-digits (#1: nothing that reads like a number).
    if (!/^[a-z0-9_]{3,20}$/.test(username) || /^\d+$/.test(username)) {
      return json(res, 422, { error: 'username must be 3–20 chars: lowercase letters, numbers or underscore (and not all digits)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(res, 422, { error: 'a valid email is required' });
    }
    if (password.length < 8) {
      return json(res, 422, { error: 'password must be at least 8 characters' });
    }
    // No enumeration: one message whether the username or the email is the collision.
    const emailTaken = Object.values(S().users).some((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (S().users[username] || emailTaken) {
      return json(res, 409, { error: 'username or email already in use' });
    }
    const colors = ['#0F766E', '#54428E', '#C05621', '#4A5568', '#5F7D4F', '#8E4256'];
    const user = {
      id: username, name: username, email,
      passwordHash: hashPassword(password),
      avatarColor: colors[username.length % colors.length],
      initials: username.split(/[_\s]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'DS',
      role: 'peer', groups: [], desiVerified: false, memberSince: 'Jul 2026', joinedAt: Date.now(),
      waLinked: false, waConsentMirror: false, waNotifs: false, portfolioPublic: false,
      experiments: { density: 'A', reactions: 'A', rail: 'A' }, theme: 'warm', country: 'US',
      joined: ['usinv'], requested: [], ghostfolio: null,
      portfolio: { value: 0, ytd: 0, holdings: [{ t: 'Cash', pc: 100 }] },
    };
    S().users[user.id] = user;
    store.save();
    startSession(res, user.id);
    // Parity with invite signup: provision the one Ghostfolio account (idempotent, best-effort).
    integrations.provisionGhostfolio(user).catch(() => {});
    return json(res, 201, { me: meVM(user), provisioning: true });
  }, { auth: false });

  route('DELETE', '/api/session', (req, res) => {
    endSession(req, res);
    return json(res, 200, { status: 'signed_out' });
  }, { auth: false });

  route('GET', '/api/bootstrap', (req, res) => {
    const user = currentUser(req);
    const usinv = S().communities.find((c) => c.id === 'usinv');
    const base = {
      stats: {
        members: usinv.members,
        online: usinv.online,
        mavens: Object.values(S().users).filter((u) => u.groups.includes('mavens')).length,
        communities: S().communities.filter((c) => c.country === 'US').length,
      },
      demoAccounts: Object.values(S().users).filter((u) => u.isDemoLogin).map((u) => ({
        id: u.id, name: u.name, initials: u.initials, color: u.avatarColor,
        label: u.groups.includes('admins') ? 'Admin' : u.groups.includes('moderators') ? 'Moderator' : u.groups.includes('mavens') ? 'Maven' : 'Member',
      })),
      experimentsCatalog: EXPERIMENTS,
      themesCatalog: THEMES,
    };
    if (!user) return json(res, 200, { ...base, me: null });
    return json(res, 200, {
      ...base,
      me: meVM(user),
      countries: S().countries.map((c) => ({
        ...c,
        communityCount: S().communities.filter((x) => x.country === c.code).length,
      })),
      spaces: S().spaces,
      communities: S().communities.filter((c) => c.country === user.country).map((c) => communityVM(c, user)),
      mavens: Object.values(S().users).filter((u) => u.groups.includes('mavens')).map((u) => ({
        ...authorCard(u.id), memberSince: u.memberSince,
      })),
    });
  }, { auth: false });

  // --- feed / posts ---
  // Member-only feed (subscribed members). sort=popular (default, hot ranking) | new (recency).
  route('GET', '/api/feed', (req, res, params, user, query) => {
    const space = query.get('space') || 'all';
    const sort = query.get('sort') === 'new' ? 'new' : 'popular';
    const pool = visiblePosts().filter((p) => space === 'all' || p.space === space);
    if (sort === 'new') {
      const posts = pool
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => ({ ...postVM(p, user), score: hotScore(p) }));
      return json(res, 200, { sort, posts });
    }
    // popular/hot: hotScore desc, newer wins ties; top 3 carry a popRank badge (#n POPULAR).
    const posts = pool
      .sort((a, b) => hotScore(b) - hotScore(a) || b.createdAt - a.createdAt)
      .map((p, i) => {
        const vm = { ...postVM(p, user), score: hotScore(p) };
        if (i < 3) vm.popRank = i + 1;
        return vm;
      });
    return json(res, 200, { sort, posts });
  });

  // Public "Popular this week" teaser — the ONLY unauthenticated content path (#7-A).
  // Top ~6 hot posts from PUBLIC spaces only; no bodies, email, phone or currency ever leave here.
  route('GET', '/api/teaser', (req, res) => {
    const publicSpaces = new Set(S().spaces.filter((s) => s.public !== false).map((s) => s.id));
    const posts = visiblePosts()
      .filter((p) => publicSpaces.has(p.space))
      .sort((a, b) => hotScore(b) - hotScore(a) || b.createdAt - a.createdAt)
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        title: scrubCurrency(p.title),
        snippet: teaserSnippet(p.body),
        space: S().spaces.find((s) => s.id === p.space)?.name ?? p.space,
        author: authorCard(p.author).name, // pseudonym only — never a card, email or phone
        reactions: totalReactions(p),
        commentCount: p.comments.length,
        age: timeAgo(p.createdAt),
      }));
    return json(res, 200, { posts });
  }, { auth: false });

  route('POST', '/api/posts', async (req, res, params, user) => {
    // Posting penalty (Reddit-style): a suspended author cannot create posts. Do not leak the flag.
    if (user.postingBannedUntil > Date.now()) {
      return json(res, 403, { error: 'posting suspended', until: user.postingBannedUntil });
    }
    const body = await readJson(req);
    const title = stripPhoneNumbers(String(body.title ?? '').trim()).slice(0, 200);
    if (!title) return json(res, 422, { error: 'a title is required' });
    const space = S().spaces.some((s) => s.id === body.space) ? body.space : 'help';
    const text = stripPhoneNumbers(String(body.body ?? '').trim()).slice(0, 8000);
    const post = {
      id: store.newId('post'), space, author: user.id, createdAt: Date.now(), via: 'web',
      title, body: text || '—', bodyFull: text || '—',
      reactions: { helpful: 0, insightful: 0, actionable: 0, like: 0 },
      removed: false, comments: [],
    };
    S().posts.unshift(post);
    store.save();
    return json(res, 201, { post: postVM(post, user, { withComments: true }) });
  });

  route('GET', '/api/posts/:id', (req, res, params, user) => {
    const post = visiblePosts().find((p) => p.id === params.id);
    if (!post) return json(res, 404, { error: 'not found' });
    return json(res, 200, { post: postVM(post, user, { withComments: true }) });
  });

  route('POST', '/api/posts/:id/comments', async (req, res, params, user) => {
    if (user.postingBannedUntil > Date.now()) {
      return json(res, 403, { error: 'posting suspended', until: user.postingBannedUntil });
    }
    const post = visiblePosts().find((p) => p.id === params.id);
    if (!post) return json(res, 404, { error: 'not found' });
    const body = await readJson(req);
    const text = stripPhoneNumbers(String(body.text ?? '').trim()).slice(0, 4000);
    if (!text) return json(res, 422, { error: 'empty reply' });
    const comment = { id: store.newId('c'), author: user.id, createdAt: Date.now(), text, reactions: { like: 0 } };
    post.comments.push(comment);
    store.save();
    // Outbound WhatsApp notification to the post author (consented members only).
    if (post.author !== user.id) {
      integrations.notifyWhatsApp({ recipient: post.author, topicId: post.id, displayUsername: user.name }).catch(() => {});
    }
    return json(res, 201, { post: postVM(post, user, { withComments: true }) });
  });

  route('POST', '/api/posts/:id/react', async (req, res, params, user) => {
    const post = visiblePosts().find((p) => p.id === params.id);
    if (!post) return json(res, 404, { error: 'not found' });
    const { type } = await readJson(req);
    if (!POSITIVE_REACTIONS.includes(type)) return json(res, 422, { error: 'unknown reaction' });
    const key = `${user.id}:${post.id}`;
    const mine = S().reactionsBy[key] ?? (S().reactionsBy[key] = {});
    if (mine[type]) {
      delete mine[type];
      post.reactions[type] = Math.max(0, (post.reactions[type] ?? 0) - 1);
    } else {
      mine[type] = true;
      post.reactions[type] = (post.reactions[type] ?? 0) + 1;
    }
    store.save();
    return json(res, 200, { reactions: postVM(post, user).reactions });
  });

  // Negative reactions: PRIVATE. Never rendered publicly; land in the review queue only.
  route('POST', '/api/posts/:id/flag', async (req, res, params, user) => {
    const post = visiblePosts().find((p) => p.id === params.id);
    if (!post) return json(res, 404, { error: 'not found' });
    const { reason } = await readJson(req);
    if (!NEGATIVE_REASONS.includes(reason)) return json(res, 422, { error: 'unknown reason' });
    let q = S().reviewQueue.find((item) => item.postId === post.id && item.status === 'pending');
    if (!q) {
      q = { id: store.newId('q'), postId: post.id, reason, flags: [], status: 'pending', createdAt: Date.now() };
      S().reviewQueue.unshift(q);
    }
    q.flags = q.flags ?? [];
    const existing = q.flags.find((f) => f.by === user.id);
    if (existing) existing.reason = reason; else q.flags.push({ by: user.id, reason, at: Date.now() });
    // Primary reason = the most recent flagger's choice (simple + predictable for the demo).
    q.reason = reason;
    store.save();
    return json(res, 200, { status: 'flagged', reason });
  });

  // --- profiles ---
  route('GET', '/api/users/:id', async (req, res, params, user, query) => {
    const target = S().users[params.id];
    if (!target) return json(res, 404, { error: 'not found' });
    const posts = visiblePosts().filter((p) => p.author === target.id)
      .sort((a, b) => b.createdAt - a.createdAt).map((p) => postVM(p, user));
    const comments = [];
    for (const p of visiblePosts()) {
      for (const c of p.comments) {
        if (c.author === target.id) {
          comments.push({ id: c.id, postId: p.id, postTitle: p.title, text: c.text, createdAt: c.createdAt, timeAgo: timeAgo(c.createdAt) });
        }
      }
    }
    comments.sort((a, b) => b.createdAt - a.createdAt);
    const isSelf = target.id === user.id;
    const out = {
      profile: {
        ...authorCard(target.id, { withKarma: true }),
        desiVerified: target.desiVerified,
        memberSince: target.memberSince,
        reactionsReceived: reactionsReceived(target.id),
        pseudonymous: true,
      },
      posts,
      comments,
      portfolio: null,
    };
    // Non-negotiable #4: owner sees value; the public sees allocation % only, opt-in.
    if (target.portfolio) {
      if (isSelf) {
        const gf = await integrations.ghostfolioSummary(target.id, 'owner');
        out.portfolio = {
          view: 'owner',
          public: target.portfolioPublic,
          value: target.portfolio.value,
          ytd: target.portfolio.ytd,
          holdings: target.portfolio.holdings,
          ghostfolio: target.ghostfolio ? { ...target.ghostfolio, live: gf?.status === 'ok' && !gf?.mock } : null,
          ssoAvailable: integrations.status.gfProvisioner.reachable, // provision happens on demand at click

        };
      } else if (target.portfolioPublic) {
        out.portfolio = { view: 'public', holdings: target.portfolio.holdings.map(({ t, pc }) => ({ t, pc })) };
      } else {
        out.portfolio = { view: 'private' };
      }
    }
    return json(res, 200, out);
  });

  route('POST', '/api/me/portfolio/sso', async (req, res, params, user) => {
    if (!user.ghostfolio) await integrations.provisionGhostfolio(user).catch(() => {});
    const minted = await integrations.mintSso(user.id);
    if (minted?.url) return json(res, 200, { url: minted.url, expiresAt: minted.expiresAt ?? null });
    return json(res, 200, { url: null, hint: 'gf-provisioner is not running — start the POC services to enable one-click SSO (see RUNBOOK).' });
  });

  // --- settings & experiments ---
  route('PUT', '/api/me/settings', async (req, res, params, user) => {
    const body = await readJson(req);
    const changed = [];
    if (typeof body.waConsentMirror === 'boolean' && body.waConsentMirror !== user.waConsentMirror) {
      user.waConsentMirror = body.waConsentMirror;
      changed.push('waConsentMirror');
      integrations.syncWaConsent(user.id, user.waConsentMirror).catch(() => {});
    }
    if (typeof body.waNotifs === 'boolean') { user.waNotifs = body.waNotifs; changed.push('waNotifs'); }
    if (typeof body.portfolioPublic === 'boolean' && body.portfolioPublic !== user.portfolioPublic) {
      user.portfolioPublic = body.portfolioPublic;
      changed.push('portfolioPublic');
      integrations.syncPortfolioVisibility(user.id, user.portfolioPublic).catch(() => {});
    }
    if (typeof body.country === 'string' && S().countries.some((c) => c.code === body.country)) {
      user.country = body.country;
      changed.push('country');
    }
    store.save();
    return json(res, 200, { me: meVM(user), changed });
  });

  route('PUT', '/api/me/experiments', async (req, res, params, user) => {
    const body = await readJson(req);
    for (const key of Object.keys(EXPERIMENTS)) {
      if (body[key] === 'A' || body[key] === 'B') user.experiments[key] = body[key];
    }
    store.save();
    return json(res, 200, { experiments: user.experiments });
  });

  route('PUT', '/api/me/theme', async (req, res, params, user) => {
    const body = await readJson(req);
    if (!THEME_IDS.includes(body.theme)) return json(res, 422, { error: 'unknown theme' });
    user.theme = body.theme;
    store.save();
    return json(res, 200, { theme: user.theme });
  });

  // --- communities ---
  route('GET', '/api/communities', (req, res, params, user, query) => {
    const country = query.get('country') || user.country;
    return json(res, 200, {
      country,
      communities: S().communities.filter((c) => c.country === country).map((c) => communityVM(c, user)),
    });
  });

  route('POST', '/api/communities/:id/join', (req, res, params, user) => {
    const c = S().communities.find((x) => x.id === params.id);
    if (!c) return json(res, 404, { error: 'not found' });
    if (user.joined.includes(c.id)) return json(res, 200, { status: 'already_joined' });
    if (c.type === 'private') {
      if (!user.requested.includes(c.id)) user.requested.push(c.id);
      store.save();
      return json(res, 200, { status: 'requested' });
    }
    user.joined.push(c.id);
    c.members += 1;
    store.save();
    return json(res, 200, { status: 'joined' });
  });

  // --- community calendar (moderator-managed; member-only read) ---
  const calendarSortKey = (e) => {
    const t = Date.parse(`${e.date} ${new Date().getFullYear()}`);
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t; // unparseable dates sink to the bottom
  };
  route('GET', '/api/calendar', (req, res) => {
    const events = [...(S().calendar ?? [])]
      .sort((a, b) => calendarSortKey(a) - calendarSortKey(b))
      .map((e) => ({ id: e.id, date: e.date, title: e.title, host: e.host, kind: e.kind ?? '', scope: e.scope ?? 'everyone' }));
    return json(res, 200, { events });
  });

  route('POST', '/api/calendar', async (req, res, params, user) => {
    if (!isModOrAdmin(user)) return json(res, 403, { error: 'moderators or admins only' });
    const body = await readJson(req);
    const date = stripPhoneNumbers(String(body.date ?? '').trim()).slice(0, 40);
    const title = stripPhoneNumbers(String(body.title ?? '').trim()).slice(0, 140);
    if (!date || !title) return json(res, 422, { error: 'date and title are required' });
    const event = {
      id: store.newId('ev'),
      date,
      title,
      host: stripPhoneNumbers(String(body.host ?? '').trim()).slice(0, 80),
      kind: stripPhoneNumbers(String(body.kind ?? '').trim()).slice(0, 40),
      scope: String(body.scope ?? 'everyone').trim().slice(0, 40) || 'everyone',
    };
    (S().calendar ??= []).push(event);
    store.save();
    integrations.event('calendar_add', { id: event.id, by: user.id });
    return json(res, 201, { event });
  });

  route('DELETE', '/api/calendar/:id', (req, res, params, user) => {
    if (!isModOrAdmin(user)) return json(res, 403, { error: 'moderators or admins only' });
    const cal = S().calendar ?? [];
    const i = cal.findIndex((e) => e.id === params.id);
    if (i < 0) return json(res, 404, { error: 'not found' });
    const [removed] = cal.splice(i, 1);
    store.save();
    integrations.event('calendar_delete', { id: removed.id, by: user.id });
    return json(res, 200, { status: 'deleted', id: removed.id });
  });

  // --- leaderboard (member-only; ranks ENGAGEMENT karma, never money or % returns — #9) ---
  route('GET', '/api/leaderboard', (req, res) => {
    const contributors = Object.values(S().users)
      .filter((u) => u.role !== 'bridge') // never surface the WhatsApp guest bucket
      .map((u) => { const karma = karmaFor(u.id); return { id: u.id, name: u.name, karma, tier: tierFor(karma), isMaven: u.groups.includes('mavens') }; })
      .sort((a, b) => b.karma - a.karma)
      .slice(0, 10);
    return json(res, 200, { contributors });
  });

  // --- how karma works (member-only transparency; sourced from the SAME constants that award
  //     karma above, so the published rules can never drift from what the code actually does) ---
  route('GET', '/api/karma/rules', (req, res) => {
    const REACTION_LABEL = { actionable: 'Actionable', helpful: 'Helpful', insightful: 'Insightful', like: 'Like' };
    return json(res, 200, {
      statement: 'Karma measures community engagement — never money. Portfolio value and % returns can never affect it (#9).',
      earn: [
        ...Object.entries(KARMA_WEIGHTS).map(([k, pts]) => ({
          action: `“${REACTION_LABEL[k] ?? k}” reaction received on your post or comment`, points: pts,
        })),
        { action: 'Your reply is marked the accepted answer', points: 5, note: 'Phase-2 — accepted answers are not tracked yet' },
      ],
      tiers: KARMA_TIERS.slice().reverse().map(([min, name]) => ({ name, min })),
      antiGaming: [
        'You cannot react to your own posts, so you cannot award yourself karma.',
        'Content removed by moderation grants no karma — and its author is stripped of any karma it earned.',
        'Karma only ever comes from reactions others give your contributions; it never uses portfolio value or returns.',
      ],
      changelog: [
        { date: '2026-07-21', note: 'Initial weights published: Actionable/Helpful +3, Insightful +2, Like +1, accepted answer +5.' },
      ],
    });
  });

  // --- review queue (moderators; the "native flag queue" of the prototype) ---
  route('GET', '/api/review-queue', (req, res, params, user) => {
    const items = S().reviewQueue.map((q) => {
      const post = S().posts.find((p) => p.id === q.postId);
      const spaceName = post ? (S().spaces.find((s) => s.id === post.space)?.name ?? post.space) : null;
      const flagCount = (q.flags?.length ?? 0) + (q.flaggedBy?.length ?? 0);
      return {
        id: q.id,
        postId: q.postId,
        reason: q.reason,
        author: post ? authorCard(post.author).name : null, // pseudonym only
        space: spaceName,
        age: timeAgo(q.createdAt),
        quote: post ? post.body : null, // the flagged post's body
        flagCount,
        removed: post ? post.removed : false,
        // legacy shape kept for the existing moderator surface + tests:
        status: q.status,
        createdAt: q.createdAt,
        timeAgo: timeAgo(q.createdAt),
        post: post ? {
          id: post.id, title: post.title, body: post.body, removed: post.removed,
          author: authorCard(post.author), spaceName,
        } : null,
      };
    });
    return json(res, 200, { items });
  }, { mod: true });

  route('POST', '/api/review-queue/:id', async (req, res, params, user) => {
    const q = S().reviewQueue.find((item) => item.id === params.id);
    if (!q) return json(res, 404, { error: 'not found' });
    const { action } = await readJson(req);
    if (action === 'remove') {
      const post = S().posts.find((p) => p.id === q.postId);
      if (post) post.removed = true;
      q.status = 'removed';
    } else if (action === 'dismiss') {
      q.status = 'dismissed';
    } else {
      return json(res, 422, { error: 'unknown action' });
    }
    q.resolvedAt = Date.now();
    q.resolvedBy = user.id;
    store.save();
    return json(res, 200, { status: q.status });
  }, { mod: true });

  // Explicit sub-path variants (moderator OR admin). Reddit-style: remove can also suspend the
  // author's posting for banDays; dismiss leaves the content untouched.
  route('POST', '/api/review-queue/:id/remove', async (req, res, params, user) => {
    if (!isModOrAdmin(user)) return json(res, 403, { error: 'moderators or admins only' });
    const q = S().reviewQueue.find((item) => item.id === params.id);
    if (!q) return json(res, 404, { error: 'not found' });
    const body = await readJson(req);
    const banDays = Number.isFinite(Number(body.banDays)) ? Math.max(0, Math.floor(Number(body.banDays))) : 0;
    const post = S().posts.find((p) => p.id === q.postId);
    if (post) post.removed = true;
    let banUntil = null;
    if (banDays > 0 && post) {
      const author = S().users[post.author];
      if (author) { author.postingBannedUntil = Date.now() + banDays * 86_400_000; banUntil = author.postingBannedUntil; }
    }
    q.status = 'removed';
    q.resolvedAt = Date.now();
    q.resolvedBy = user.id;
    store.save();
    // Log the moderation action only — never who flagged the post.
    integrations.event('mod_remove', { queueId: q.id, postId: q.postId, banDays, by: user.id });
    return json(res, 200, { status: 'removed', banned: banDays > 0, banUntil });
  });

  route('POST', '/api/review-queue/:id/dismiss', (req, res, params, user) => {
    if (!isModOrAdmin(user)) return json(res, 403, { error: 'moderators or admins only' });
    const q = S().reviewQueue.find((item) => item.id === params.id);
    if (!q) return json(res, 404, { error: 'not found' });
    q.status = 'dismissed'; // content untouched
    q.resolvedAt = Date.now();
    q.resolvedBy = user.id;
    store.save();
    integrations.event('mod_dismiss', { queueId: q.id, postId: q.postId, by: user.id });
    return json(res, 200, { status: 'dismissed' });
  });

  // --- search (member-only, Reddit-style; anonymous callers already 401 via the dispatcher) ---
  route('GET', '/api/search', (req, res, params, user, query) => {
    const q = String(query.get('q') ?? '').trim();
    const tab = ['all', 'posts', 'communities', 'comments', 'profiles'].includes(query.get('tab')) ? query.get('tab') : 'all';
    const empty = { q, counts: { all: 0, posts: 0, communities: 0, comments: 0, profiles: 0 }, posts: [], communities: [], comments: [], profiles: [] };
    if (!q) return json(res, 200, empty);
    const nq = q.toLowerCase();
    // Best-match ranking: prefix (3) > word-boundary (2) > substring (1) > miss (0).
    const rank = (hay) => {
      const h = String(hay ?? '').toLowerCase();
      const i = h.indexOf(nq);
      if (i < 0) return 0;
      if (i === 0) return 3;
      return /[a-z0-9]/.test(h[i - 1]) ? 1 : 2;
    };

    const postScored = [];
    for (const p of visiblePosts()) {
      const ts = rank(p.title);
      const bodyHit = `${p.body} ${p.bodyFull ?? ''}`.toLowerCase().includes(nq);
      if (ts > 0 || bodyHit) postScored.push({ p, score: ts > 0 ? ts + 3 : 1 });
    }
    postScored.sort((a, b) => b.score - a.score || b.p.createdAt - a.p.createdAt);
    const posts = postScored.map(({ p }) => ({
      id: p.id,
      title: p.title,
      snippet: snippet(p.bodyFull || p.body, q),
      space: S().spaces.find((s) => s.id === p.space)?.name ?? p.space,
      author: authorCard(p.author).name,
      reactions: totalReactions(p),
      commentCount: p.comments.length,
      age: timeAgo(p.createdAt),
    }));

    const commScored = [];
    for (const c of S().communities) {
      const s = Math.max(rank(c.name), (c.desc ?? '').toLowerCase().includes(nq) ? 1 : 0);
      if (s > 0) commScored.push({ c, s });
    }
    commScored.sort((a, b) => b.s - a.s || b.c.members - a.c.members);
    const communities = commScored.map(({ c }) => ({
      id: c.id, name: c.name, description: c.desc ?? '', members: c.members, joined: user.joined.includes(c.id),
    }));

    const commentScored = [];
    for (const p of visiblePosts()) {
      for (const c of p.comments) {
        const s = rank(c.text);
        if (s > 0) commentScored.push({ p, c, s });
      }
    }
    commentScored.sort((a, b) => b.s - a.s || b.c.createdAt - a.c.createdAt);
    const comments = commentScored.map(({ p, c }) => ({
      postId: p.id, postTitle: p.title, snippet: snippet(c.text, q), author: authorCard(c.author).name, age: timeAgo(c.createdAt),
    }));

    const profScored = [];
    for (const u of Object.values(S().users)) {
      if (u.role === 'bridge') continue; // never surface the WhatsApp guest bucket
      const isMaven = u.groups.includes('mavens');
      const s = Math.max(rank(u.name), rank(u.id), isMaven ? rank(u.credential ?? '') : 0);
      if (s > 0) profScored.push({ u, s });
    }
    profScored.sort((a, b) => b.s - a.s);
    // Profiles carry NO email and NO phone — pseudonym, badges, credential, corridor, karma only.
    const profiles = profScored.map(({ u }) => {
      const karma = karmaFor(u.id);
      return {
        id: u.id,
        name: u.name,
        isMaven: u.groups.includes('mavens'),
        isModerator: u.groups.includes('moderators'),
        credential: u.groups.includes('mavens') ? (u.credential ?? null) : null,
        corridor: u.country,
        karma,
        tier: tierFor(karma),
      };
    });

    const counts = { posts: posts.length, communities: communities.length, comments: comments.length, profiles: profiles.length };
    counts.all = counts.posts + counts.communities + counts.comments + counts.profiles;
    const cap = (name) => ((tab === 'all' || tab === name) ? 25 : 5);
    return json(res, 200, {
      q,
      counts,
      posts: posts.slice(0, cap('posts')),
      communities: communities.slice(0, cap('communities')),
      comments: comments.slice(0, cap('comments')),
      profiles: profiles.slice(0, cap('profiles')),
    });
  });

  // --- maven performance (percent-only proof; 404 unless the target is a maven) ---
  route('GET', '/api/mavens/:id/performance', async (req, res, params, user) => {
    const target = S().users[params.id];
    if (!target || !target.groups.includes('mavens')) return json(res, 404, { error: 'not found' });
    // Prefer a live percent-only feed when gf-provisioner is reachable — but only if it is
    // demonstrably currency-free; otherwise fall back to the seeded, guaranteed-safe computation.
    let perf = null;
    if (integrations.status.gfProvisioner.reachable) {
      const live = await integrations.ghostfolioSummary(target.id, 'maven').catch(() => null);
      if (live && live.overall && Array.isArray(live.monthly)
        && !('value' in live) && !/[$₹£]\s?\d/.test(JSON.stringify(live))) {
        perf = live;
      }
    }
    if (!perf) perf = buildPerformance(target);
    return json(res, 200, perf);
  });

  // --- admin management (admin-only; the one place email may appear) ---
  route('GET', '/api/admin/overview', (req, res) => {
    const usersAll = Object.values(S().users).filter((u) => u.role !== 'bridge');
    const recentSignups = [...usersAll]
      .sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0))
      .slice(0, 8)
      .map((u) => ({ username: u.id, joined: u.joinedAt ? new Date(u.joinedAt).toISOString() : u.memberSince }));
    return json(res, 200, {
      users: usersAll.length,
      posts: visiblePosts().length,
      pendingFlags: S().reviewQueue.filter((qq) => qq.status === 'pending').length,
      communities: S().communities.length,
      recentSignups,
    });
  }, { admin: true });

  route('GET', '/api/admin/users', (req, res) => {
    const users = Object.values(S().users)
      .filter((u) => u.role !== 'bridge')
      .map((u) => ({
        id: u.id,
        email: u.email,
        groups: u.groups,
        joined: u.joinedAt ? new Date(u.joinedAt).toISOString() : u.memberSince,
        postCount: S().posts.filter((p) => p.author === u.id).length,
      }));
    return json(res, 200, users);
  }, { admin: true });

  route('POST', '/api/admin/users/:id/role', async (req, res, params) => {
    const target = S().users[params.id];
    if (!target) return json(res, 404, { error: 'not found' });
    const body = await readJson(req);
    if (!['mavens', 'moderators', 'admins'].includes(body.role)) return json(res, 422, { error: 'unknown role' });
    if (body.action !== 'grant' && body.action !== 'revoke') return json(res, 422, { error: 'unknown action' });
    target.groups = target.groups ?? [];
    if (body.action === 'grant') {
      if (!target.groups.includes(body.role)) target.groups.push(body.role);
      // Granting 'mavens' is credentialing: attach the declared credential (phone-stripped).
      if (body.role === 'mavens' && typeof body.credential === 'string' && body.credential.trim()) {
        target.credential = stripPhoneNumbers(body.credential.trim()).slice(0, 80);
      }
    } else {
      target.groups = target.groups.filter((g) => g !== body.role);
      if (body.role === 'mavens') target.credential = null;
    }
    store.save();
    return json(res, 200, { user: adminUserSummary(target) });
  }, { admin: true });

  route('POST', '/api/admin/spaces', async (req, res) => {
    const body = await readJson(req);
    const name = String(body.name ?? '').trim().slice(0, 60);
    if (!name) return json(res, 422, { error: 'a name is required' });
    const description = stripPhoneNumbers(String(body.description ?? '').trim()).slice(0, 280);
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || store.newId('space');
    if (S().spaces.some((s) => s.id === id)) id = `${id}-${store.newId('s').slice(-4)}`;
    const space = { id, name, desc: description, count: 0, archived: false };
    S().spaces.push(space);
    store.save();
    return json(res, 201, { space });
  }, { admin: true });

  route('PUT', '/api/admin/spaces/:id', async (req, res, params) => {
    const space = S().spaces.find((s) => s.id === params.id);
    if (!space) return json(res, 404, { error: 'not found' });
    const body = await readJson(req);
    if (typeof body.name === 'string' && body.name.trim()) space.name = body.name.trim().slice(0, 60);
    if (typeof body.description === 'string') space.desc = stripPhoneNumbers(body.description.trim()).slice(0, 280);
    if (typeof body.archived === 'boolean') space.archived = body.archived;
    store.save();
    return json(res, 200, { space });
  }, { admin: true });

  route('POST', '/api/admin/posts/:id/remove', (req, res, params, user) => {
    const post = S().posts.find((p) => p.id === params.id);
    if (!post) return json(res, 404, { error: 'not found' });
    post.removed = true; // admin hard-remove, mirroring the moderator queue remove
    const q = S().reviewQueue.find((item) => item.postId === post.id && item.status === 'pending');
    if (q) { q.status = 'removed'; q.resolvedAt = Date.now(); q.resolvedBy = user.id; }
    store.save();
    return json(res, 200, { status: 'removed', postId: post.id });
  }, { admin: true });

  // --- demo driver (local demo tooling; not part of the product surface) ---
  // These are gated behind a session: the demo drawer only appears when signed in, and an
  // anonymous caller must not be able to forge feed posts, wipe state, or read the internal
  // event log / consent map (non-negotiable #7 — signed-out users get only the landing).
  route('GET', '/api/demo/status', async (req, res) => {
    await integrations.probe();
    return json(res, 200, {
      integrations: integrations.status,
      links: {
        prototype: config.publicUrl,
        discourse: config.discourseUrl,
        ghostfolio: config.ghostfolioUrl,
        mailhog: config.mailhogUrl,
        waBridge: config.waBridgeUrl,
        gfProvisioner: config.gfProvisionerUrl,
      },
      waMappings: S().waMappings.map((m) => ({ waHandle: m.waHandle, userId: m.userId })),
      events: S().events.slice(0, 30),
    });
  }, { auth: true });

  route('POST', '/api/demo/wa-inbound', async (req, res) => {
    const body = await readJson(req);
    const userId = String(body.userId ?? '');
    const text = stripPhoneNumbers(String(body.text ?? '').trim()).slice(0, 2000);
    if (!text) return json(res, 422, { error: 'text required' });
    const user = S().users[userId];
    const attempt = await integrations.injectWhatsApp({ userId, text });
    if (attempt.path === 'wa-bridge') {
      // The real bridge will call back into our Discourse-compatible /posts.json.
      return json(res, 200, { path: 'wa-bridge', bridgeResult: attempt.result, ms: attempt.ms });
    }
    // Built-in fallback honours the same consent rule the bridge applies.
    const consented = user?.waConsentMirror;
    const post = createMirroredPost({
      username: consented ? userId : null,
      title: text.slice(0, 60) + (text.length > 60 ? '…' : ''),
      raw: consented ? text : `${text}\n\n> _Shared from WhatsApp by a member who hasn't linked their account yet. Join DesiSquare to get credited._`,
    });
    integrations.event('wa_inbound_builtin', { postId: post.id, attributed: !!consented, ms: attempt.ms });
    return json(res, 200, { path: 'builtin', postId: post.id, attributed: !!consented, ms: attempt.ms });
  }, { auth: true });

  route('POST', '/api/demo/signup', async (req, res) => {
    const name = `${PSEUDONYM_POOL[Math.floor(Math.random() * PSEUDONYM_POOL.length)]}_${Math.floor(Math.random() * 90 + 10)}`;
    const colors = ['#0F766E', '#54428E', '#C05621', '#4A5568', '#5F7D4F', '#8E4256'];
    const user = {
      id: name, name, email: `${name}@demo.desisquare.local`,
      avatarColor: colors[name.length % colors.length],
      initials: name.slice(0, 2).toUpperCase(), role: 'peer', groups: [], desiVerified: true,
      memberSince: 'Jul 2026', waLinked: false, waConsentMirror: false, waNotifs: false,
      portfolioPublic: false, experiments: { density: 'A', reactions: 'A', rail: 'A' }, theme: 'warm',
      country: 'US', joined: ['usinv'], requested: [], ghostfolio: null,
      portfolio: { value: 0, ytd: 0, holdings: [{ t: 'Cash', pc: 100 }] },
    };
    S().users[user.id] = user;
    store.save();
    const result = await integrations.provisionGhostfolio(user);
    const again = await integrations.provisionGhostfolio(user); // prove idempotency live
    return json(res, 200, { userId: user.id, first: result?.status ?? 'simulated', second: again?.status ?? 'simulated' });
  }, { auth: true });

  route('POST', '/api/demo/reset', (req, res) => {
    store.reset();
    return json(res, 200, { status: 'reset' });
  }, { auth: true });

  route('GET', '/api/health', (req, res) => {
    return json(res, 200, { ok: true, service: 'desisquare-phase1', posts: S().posts.length, users: Object.keys(S().users).length });
  }, { auth: false });

  // ---------- dispatcher ----------
  async function handle(req, res, pathname, query) {
    for (const r of routes) {
      if (req.method !== r.method) continue;
      const m = pathname.match(r.regex);
      if (!m) continue;
      let params;
      try {
        params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      } catch {
        // A malformed %-escape in a path segment is a bad request for a resource, not a crash.
        return json(res, 404, { error: 'not found' });
      }
      let user = null;
      if (r.auth || r.mod || r.admin) {
        user = currentUser(req);
        if (!user) return json(res, 401, { error: 'sign in first' });
        if (r.mod && !user.groups.includes('moderators')) return json(res, 403, { error: 'moderators only' });
        if (r.admin && !user.groups.includes('admins')) return json(res, 403, { error: 'admins only' });
      }
      try {
        return await r.handler(req, res, params, user, query);
      } catch (err) {
        if (err instanceof HttpError) return json(res, err.status, { error: err.message });
        console.error(`[api] ${req.method} ${pathname} failed:`, err);
        return json(res, 500, { error: 'internal error' });
      }
    }
    return null; // not an API route
  }

  return { handle, createMirroredPost, POSITIVE_REACTIONS, NEGATIVE_REASONS };
}
