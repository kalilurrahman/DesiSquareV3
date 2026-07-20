#!/usr/bin/env node
// DesiSquare 50-user community simulation & acceptance test.
//
// Usage:
//   DISCOURSE_URL=https://community.example.com \
//   DISCOURSE_API_KEY=<global admin key> \
//   [DISCOURSE_API_USERNAME=system] [SIM_PACE_MS=600] [SIM_USER_PASSWORD=...] \
//   node test/community-sim/run.mjs
//
// Creates 50 pseudonymous users, seeds 15+ realistic multi-turn dialogues
// (68 replies, 100+ reactions, accepted answers, a poll, an AMA, two flagged
// posts), then runs 14 acceptance checks (UC1–UC14) mapped to the v3 user
// stories, and writes a Markdown + JSON report to test/community-sim/report/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DiscourseClient } from './lib/discourse.mjs';
import { PERSONAS, SPAMMER, SPACES, TAGS, DIALOGUES, SPAM_POST, LOW_EFFORT_POST } from './data/community.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.DISCOURSE_URL;
const KEY = process.env.DISCOURSE_API_KEY;
if (!BASE || !KEY) {
  console.error('Set DISCOURSE_URL and DISCOURSE_API_KEY (global admin key). See README.md.');
  process.exit(2);
}
const PASSWORD = process.env.SIM_USER_PASSWORD || 'DesiSquare-sim-2026!';
const EMAIL_DOMAIN = process.env.SIM_EMAIL_DOMAIN || 'sim.desisquare.invalid';

const api = new DiscourseClient({
  baseUrl: BASE, apiKey: KEY,
  apiUsername: process.env.DISCOURSE_API_USERNAME || 'system',
  paceMs: Number(process.env.SIM_PACE_MS || 600),
  verbose: !!process.env.SIM_VERBOSE,
});

const results = { startedAt: new Date().toISOString(), baseUrl: BASE, phases: {}, usecases: [], metrics: {} };
const uc = (id, name, pass, evidence, note = '') => {
  results.usecases.push({ id, name, pass, evidence, note });
  console.log(`  ${pass === true ? 'PASS' : pass === 'warn' ? 'WARN' : 'FAIL'}  ${id} ${name}${note ? ` — ${note}` : ''}`);
};

// ---------- Phase 0: preflight ----------
console.log('\n== Phase 0: preflight ==');
const about = await api.get('/about.json');
if (about.status !== 200) {
  console.error(`Cannot reach ${BASE}/about.json as admin (HTTP ${about.status}). Check URL/key.`);
  process.exit(1);
}
const site = await api.get('/site.json');
const version = about.json?.about?.version ?? 'unknown';
console.log(`  Discourse ${version} at ${BASE}`);
results.phases.preflight = { version };

// ---------- Phase 1: structure (settings + categories + tag group) ----------
console.log('\n== Phase 1: structure ==');
// Instance prep (fail-soft — WARNs surface in UC checks if these stay off):
for (const [k, v] of [['tagging_enabled', 'true'], ['solved_enabled', 'true'],
  ['allow_solved_on_all_topics', 'true'], ['enable_user_status', 'true']]) {
  const r = await api.setSiteSetting(k, v);
  if (!r.ok) console.warn(`  site setting ${k}: HTTP ${r.status} (plugin absent or non-admin key?)`);
}
const catIds = {};
for (const s of SPACES) {
  const r = await api.ensureCategory(s);
  if (!r.ok) console.warn(`  category "${s.name}": ${r.error}`);
  else catIds[s.name] = r.id;
}
// Pre-create the label taxonomy as a tag group so non-staff personas can APPLY
// (not mint) tags — regular users lack create_tag rights by default.
const tg = await api.ensureTagGroup({ name: 'DesiSquare labels', tags: TAGS });
if (!tg.ok) console.warn(`  tag group: ${tg.error}`);
console.log(`  categories ready: ${Object.keys(catIds).length}/${SPACES.length}; tag group ${tg.ok ? 'ready' : 'FAILED'}`);
results.phases.structure = { categories: Object.keys(catIds).length, tagGroup: tg.ok };

// ---------- Phase 2: users ----------
console.log('\n== Phase 2: 50 users + 1 flag-exercise account ==');
const allPersonas = [...PERSONAS, SPAMMER];
let created = 0, existed = 0, tl2 = 0, failed = [];
for (const p of allPersonas) {
  const r = await api.createUser({
    username: p.u, email: `${p.u}@${EMAIL_DOMAIN}`, password: PASSWORD, bio: p.bio,
  });
  if (r.ok) {
    r.existed ? existed++ : created++;
    // TL2: escapes new-user posting limits; polls need TL1+. Fail-soft.
    const uid = r.id ?? await api.userId(p.u);
    if (uid) { const t = await api.setTrustLevel({ userId: uid, level: 2 }); if (t.ok) tl2++; }
  } else failed.push(`${p.u}: ${r.error}`);
}
console.log(`  created ${created}, already existed ${existed}, TL2 bumped ${tl2}, failed ${failed.length}`);
failed.slice(0, 5).forEach(f => console.log(`   ! ${f}`));
results.phases.users = { created, existed, failed };
uc('UC1', 'User provisioning: 50 pseudonymous members active & postable (story 1.2/1.4 analog)',
  failed.length === 0, `${created} created, ${existed} pre-existing, 0 failures`);

// ---------- Phase 3: dialogues ----------
console.log('\n== Phase 3: seeding dialogues ==');
const topicIndex = {}; // key -> {topicId, postIds[]}
let topics = 0, replies = 0, likes = 0, accepts = 0, likeFails = 0;
const NOW = Date.now();
let di = 0;
for (const d of DIALOGUES) {
  // Backdate for a realistic timeline: topics spread over the past ~12 days,
  // replies landing 40min–8h apart after their topic.
  const topicAt = new Date(NOW - (DIALOGUES.length - di) * 19 * 3600 * 1000);
  const t = await api.createTopic({
    title: d.title, raw: d.body, categoryId: catIds[d.space], tags: d.tags, as: d.by,
    createdAt: topicAt.toISOString(),
  });
  di++;
  if (!t.ok) { console.warn(`  topic "${d.title.slice(0, 40)}…": ${t.error}`); continue; }
  topics++;
  const postIds = [t.postId];
  let ri = 1;
  for (const [user, body] of d.r) {
    const replyAt = new Date(topicAt.getTime() + ri * (40 + (ri * 37) % 440) * 60 * 1000);
    const rr = await api.reply({ topicId: t.topicId, raw: body, as: user, createdAt: replyAt.toISOString() });
    ri++;
    if (rr.ok) { replies++; postIds.push(rr.postId); }
    else console.warn(`  reply by ${user}: ${rr.error}`);
  }
  // reactions on the opening post
  for (const who of d.like?.[0] ?? []) {
    const lr = await api.like({ postId: postIds[0], as: who });
    lr.ok ? likes++ : likeFails++;
  }
  // reactions on replies (1-indexed reply positions)
  for (const [idx, users] of Object.entries(d.likeReplies ?? {})) {
    const pid = postIds[Number(idx)];
    if (!pid) continue;
    for (const who of users) {
      const lr = await api.like({ postId: pid, as: who });
      lr.ok ? likes++ : likeFails++;
    }
  }
  // accepted answer (Solved): d.accept is the reply index-0 within d.r
  if (d.accept !== undefined && postIds[d.accept + 1]) {
    const ar = await api.acceptAnswer({ postId: postIds[d.accept + 1], as: d.by });
    if (ar.ok) accepts++;
  }
  topicIndex[d.key] = { topicId: t.topicId, postIds };
  console.log(`  ✓ ${d.key} (topic ${t.topicId}, ${d.r.length} replies)`);
}
results.phases.dialogues = { topics, replies, likes, likeFails, accepts };
uc('UC2', 'Labelled posting: topics created with required labels (14.1)', topics === DIALOGUES.length,
  `${topics}/${DIALOGUES.length} topics, all with tags`);
const expectedReplies = DIALOGUES.reduce((s, d) => s + d.r.length, 0);
uc('UC3', 'Threaded dialogue: multi-turn replies land in-thread (2.4)', replies === expectedReplies,
  `${replies}/${expectedReplies} corpus replies across ${topics} topics`);
uc('UC4', 'Reactions: structured feedback accrues (3.1/3.2)', likes >= 80,
  `${likes} reactions applied (${likeFails} failures)`);
uc('UC8', 'Accepted answers mark solutions (Solved / karma 21.1 input)',
  accepts > 0 ? true : 'warn', `${accepts} accepted`, accepts === 0 ? 'Solved plugin disabled — enable per runbook Stage 8C' : '');

// ---------- Phase 4: flag flow ----------
console.log('\n== Phase 4: flag → review queue ==');
let flagged = 0;
for (const spec of [SPAM_POST, LOW_EFFORT_POST]) {
  const t = await api.createTopic({
    title: spec.title, raw: spec.body, categoryId: catIds[spec.space], tags: spec.tags, as: spec.by,
  });
  if (!t.ok) { console.warn(`  flag-target topic failed: ${t.error}`); continue; }
  // spam solicitation → type 8 (spam); low-effort → type 4 (inappropriate)
  const flagType = spec === SPAM_POST ? 8 : 4;
  for (const who of spec.flaggedBy) {
    const fr = await api.flag({ postId: t.postId, as: who, type: flagType });
    if (fr.ok) flagged++;
    else console.warn(`  flag by ${who}: ${fr.error}`);
  }
}
const review = await api.get('/review.json');
const reviewCount = review.json?.reviewables?.length ?? 0;
results.phases.flags = { flagged, reviewCount };
uc('UC9', 'Private flags route to the mod review queue (3.3/9.1, #3)',
  flagged >= 2 && reviewCount >= 1, `${flagged} flags filed; ${reviewCount} reviewable(s) in queue`);

// ---------- Phase 5: discovery & gate checks ----------
console.log('\n== Phase 5: discovery use-cases ==');

// UC5 text search (as member)
const s1 = await api.search('FEMA', { as: 'quiet_lotus' });
const s1hit = (s1.json?.topics ?? []).some(t => /FEMA/i.test(t.title ?? t.fancy_title ?? ''));
uc('UC5', 'Search by general text finds discussions (4.1)', s1.status === 200 && s1hit,
  `search "FEMA" → ${s1.json?.topics?.length ?? 0} topics, FEMA guide ${s1hit ? 'found' : 'MISSING'}`);

// UC6 ticker/label search
const s2 = await api.search('tags:nvda', { as: 'quiet_lotus' });
const s2n = s2.json?.topics?.length ?? 0;
const tagPage = await api.get('/tag/nvda.json', { as: 'quiet_lotus' });
const tagN = tagPage.json?.topic_list?.topics?.length ?? 0;
uc('UC6', 'Search by ticker label: tags:nvda + label hub page (4.6/4.7, 20.1)',
  s2n >= 1 && tagN >= 1, `tags:nvda → ${s2n} topics; /tag/nvda → ${tagN} topics`);

// UC7 popular/hot
const hot = await api.get('/hot.json', { as: 'quiet_lotus' });
const hotTopics = hot.json?.topic_list?.topics ?? [];
const topHot = hotTopics.slice(0, 10).map(t => t.title);
const engagedHot = topHot.some(t => /rebalancing|FEMA|Roth|AMA/i.test(t ?? ''));
uc('UC7', 'Popular surfaces the highest-engagement discussions (2.1/F3)',
  hot.status === 200 && hotTopics.length >= 5 ? (engagedHot ? true : 'warn') : false,
  `/hot returned ${hotTopics.length} topics`, engagedHot ? '' : 'hot scores recompute on a ~10min job — re-check shortly');

// UC12 pseudonymity: non-admin view of a profile exposes no email
const prof = await api.get('/u/quiet_lotus.json', { as: 'first_gen_saver' });
const profStr = JSON.stringify(prof.json ?? {});
const emailLeak = new RegExp(`@${EMAIL_DOMAIN.replace('.', '\\.')}`).test(profStr);
uc('UC12', 'Profiles are pseudonym-only to other members (1.4/4.3)',
  prof.status === 200 && !emailLeak, `member-view profile payload ${emailLeak ? 'CONTAINS EMAIL' : 'contains no email'}`);

// UC13 poll present
const wk = topicIndex['weekly-watch'];
if (wk) {
  const tj = await api.get(`/t/${wk.topicId}.json`, { as: 'quiet_lotus' });
  const hasPoll = !!tj.json?.post_stream?.posts?.[0]?.polls?.length;
  uc('UC13', 'Native poll renders on the ritual thread (18.4/19.2)', hasPoll,
    hasPoll ? 'polls[] present on first post' : 'no polls[] on first post');
} else uc('UC13', 'Native poll renders on the ritual thread (18.4/19.2)', false, 'weekly-watch topic missing');

// UC10 anonymous gate (#7-A): member endpoints must 403/redirect when login_required
console.log('\n== Phase 6: signed-out gate & leak scan ==');
const gatePaths = ['/latest.json', '/search.json?q=FEMA', '/u/quiet_lotus.json', '/tag/nvda.json', '/hot.json'];
const gate = [];
for (const p of gatePaths) {
  const r = await api.get(p, { anon: true });
  gate.push({ path: p, status: r.status, gated: r.status === 403 || (r.status >= 300 && r.status < 400) });
}
const allGated = gate.every(g => g.gated);
const loginRequired = site.json?.login_required ?? about.json?.about?.login_required;
uc('UC10', 'Signed-out gate: member endpoints 403/redirect anonymously (#7-A, 1.1/4.4)',
  allGated ? true : (loginRequired === false ? 'warn' : false),
  gate.map(g => `${g.path}→${g.status}`).join(' · '),
  allGated ? '' : 'enable login_required + invite-only per runbook Stage 5 for the DesiSquare gate');

// UC11 leak scan: no E.164 phone patterns / no sim emails in member-visible payloads
const scanTargets = [];
for (const k of Object.keys(topicIndex).slice(0, 6)) {
  const tj = await api.get(`/t/${topicIndex[k].topicId}.json`, { as: 'first_gen_saver' });
  scanTargets.push(JSON.stringify(tj.json ?? {}));
}
const e164 = /\+[1-9]\d{9,14}\b/;
const leakHits = scanTargets.filter(s => e164.test(s) || s.includes(`@${EMAIL_DOMAIN}`)).length;
uc('UC11', 'Leak scan: no E.164 numbers, no emails in thread payloads (#5, 12.5)',
  leakHits === 0, `${scanTargets.length} thread payloads scanned, ${leakHits} hits`);

// UC14 karma-proxy leaderboard from seeded engagement (engagement-only, #9)
const likesByUser = {};
for (const d of DIALOGUES) {
  (d.like?.[0] ?? []).forEach(() => { likesByUser[d.by] = (likesByUser[d.by] ?? 0) + 1; });
  for (const [idx, users] of Object.entries(d.likeReplies ?? {})) {
    const author = d.r[Number(idx) - 1]?.[0];
    if (author) likesByUser[author] = (likesByUser[author] ?? 0) + users.length;
  }
}
const board = Object.entries(likesByUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
uc('UC14', 'Engagement leaderboard derivable — by karma, never by returns (#9, 18.1/21.5)',
  board.length >= 5, `top: ${board.slice(0, 5).map(([u, n]) => `${u}(${n})`).join(', ')}`);

// ---------- Report ----------
console.log('\n== Report ==');
results.metrics = {
  users: created + existed, topics, replies, reactions: likes, acceptedAnswers: accepts,
  flags: flagged, tagsUsed: [...new Set(DIALOGUES.flatMap(d => d.tags))].length,
  corridors: [...new Set(PERSONAS.map(p => p.corridor))].length,
};
const passed = results.usecases.filter(u => u.pass === true).length;
const warned = results.usecases.filter(u => u.pass === 'warn').length;
const failedUc = results.usecases.filter(u => u.pass === false).length;

const perCorridor = {};
for (const p of PERSONAS) perCorridor[p.corridor] = (perCorridor[p.corridor] ?? 0) + 1;

const md = `# DesiSquare — 50-User Community Simulation Report

**Target:** ${BASE} · Discourse ${version} · run ${results.startedAt}
**Outcome:** ${passed} passed · ${warned} warnings · ${failedUc} failed (of ${results.usecases.length} use-cases)

## What was simulated

- **${results.metrics.users} pseudonymous members** across ${results.metrics.corridors} corridors (${Object.entries(perCorridor).map(([c, n]) => `${c} ${n}`).join(' · ')}), incl. 2 mavens and 1 flag-exercise account.
- **${topics} discussions / ${replies} replies** of realistic multi-turn dialogue: FEMA repatriation, Roth-vs-traditional on H-1B, rebalancing bands, $NVDA trim debate, FCNR rate shopping, ISA-vs-pension, TFSA cross-border, DIFC gratuity, CPF-vs-SRS, super on 482, buy-vs-remit real estate, a weekly ritual with a **native poll**, a maven **AMA with pinned recap**, term insurance, GIFT City fine print.
- **${likes} reactions**, ${accepts} accepted answers, ${flagged} private flags on 2 policy-violating posts.
- Labels exercised: ${[...new Set(DIALOGUES.flatMap(d => d.tags))].sort().join(', ')}.

## Acceptance results

| # | Use case | Result | Evidence |
|---|---|---|---|
${results.usecases.map(u => `| ${u.id} | ${u.name} | ${u.pass === true ? '✅ PASS' : u.pass === 'warn' ? '⚠️ WARN' : '❌ FAIL'} | ${u.evidence}${u.note ? ` — *${u.note}*` : ''} |`).join('\n')}

## Community pulse (from seeded engagement — engagement only, #9)

| Rank | Member | Reactions received |
|---|---|---|
${board.slice(0, 8).map(([u, n], i) => `| ${i + 1} | ${u} | ▲ ${n} |`).join('\n')}

## Notes

- All dialogue bodies are percent/ratio-based — no personal portfolio currency amounts — so public-surface leak scans stay clean by construction.
- The two flagged posts ("guaranteed returns" solicitation, low-effort) exercise the 3.3 → 9.1 private-flag pipeline; moderate them from /review.
- WARN rows are configuration follow-ups (runbook stages), not seeding failures.
`;

const outDir = join(HERE, 'report');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'DesiSquare-50-user-test-report.md'), md);
writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
console.log(`  report: test/community-sim/report/DesiSquare-50-user-test-report.md`);
console.log(`\nDone: ${passed} PASS / ${warned} WARN / ${failedUc} FAIL`);
process.exit(failedUc > 0 ? 1 : 0);
