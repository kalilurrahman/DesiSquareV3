// Webhook path: HMAC verification (sibling-service scheme) + Signal stamping,
// idempotent on postId even across distinct webhook event ids.
import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { boot, api } from './helpers.js';

const SECRET = 'test-webhook-secret';

function sign(raw, secret = SECRET) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
}
function postEvent(post, eventId) {
  const raw = JSON.stringify({ post });
  return [raw, {
    'x-discourse-event-type': 'post',
    'x-discourse-event': 'post_created',
    'x-discourse-event-id': eventId,
    'x-discourse-event-signature': sign(raw),
  }];
}

const signalPost = {
  id: 5551,
  username: 'nikhil_cfa',
  topic_title: 'Trimming NVDA into strength',
  created_at: '2026-06-01T15:00:00Z',
  custom_fields: { signal_kind: 'SELL', ticker: 'NVDA' },
};

test('signal-tagged post stamps a Signal; idempotent on postId', async () => {
  const app = await boot({ secret: SECRET });
  try {
    const [raw, headers] = postEvent(signalPost, 'evt-1');
    const first = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(first.code, 201);
    assert.strictEqual(first.body.status, 'stamped');
    assert.strictEqual(first.body.signal.postId, 5551);
    assert.strictEqual(first.body.signal.kind, 'SELL');
    assert.strictEqual(first.body.signal.instrument, 'NVDA');
    assert.ok(first.body.signal.refPrice > 0, 'refPrice stamped from EOD close');
    assert.strictEqual(first.body.signal.stampedAt, '2026-06-01T15:00:00Z');

    // same post redelivered under a DIFFERENT event id → still one stamp (postId idempotency)
    const [raw2, headers2] = postEvent(signalPost, 'evt-2');
    const second = await api(app.base, 'POST', '/webhook/discourse', raw2, headers2);
    assert.strictEqual(second.code, 200);
    assert.strictEqual(second.body.status, 'duplicate_ignored');
    assert.strictEqual(second.body.signal.id, first.body.signal.id);
    assert.strictEqual(app.store.counts().signals, 1);

    // redelivery with the SAME event id → deduped at the event level
    const third = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(third.body.status, 'duplicate_event_ignored');
    assert.strictEqual(app.store.counts().signals, 1);

    // and the stamp is immutable: a "changed" payload for the same post never rewrites it
    const [raw4, headers4] = postEvent({ ...signalPost, custom_fields: { signal_kind: 'BUY', ticker: 'AAPL' } }, 'evt-3');
    const fourth = await api(app.base, 'POST', '/webhook/discourse', raw4, headers4);
    assert.strictEqual(fourth.body.status, 'duplicate_ignored');
    assert.strictEqual(app.store.signalByPostId(5551).kind, 'SELL');
  } finally { await app.close(); }
});

test('bad signature is rejected 401; valid signature required for every delivery', async () => {
  const app = await boot({ secret: SECRET });
  try {
    const raw = JSON.stringify({ post: signalPost });
    const bad = await api(app.base, 'POST', '/webhook/discourse', raw, {
      'x-discourse-event-type': 'post',
      'x-discourse-event-signature': sign(raw, 'wrong-secret'),
    });
    assert.strictEqual(bad.code, 401);
    const missing = await api(app.base, 'POST', '/webhook/discourse', raw, { 'x-discourse-event-type': 'post' });
    assert.strictEqual(missing.code, 401);
    assert.strictEqual(app.store.counts().signals, 0);
  } finally { await app.close(); }
});

test('posts without signal_kind + ticker custom fields are skipped, other events ignored', async () => {
  const app = await boot({ secret: SECRET });
  try {
    const [raw, headers] = postEvent({ id: 5552, username: 'quiet_lotus', custom_fields: {} }, 'evt-plain');
    const plain = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(plain.body.status, 'skipped_no_signal_fields');

    // topic events are processed now (tags path) — one without tags is a skip, not an error
    const topicRaw = JSON.stringify({ topic: { id: 7 } });
    const topic = await api(app.base, 'POST', '/webhook/discourse', topicRaw, {
      'x-discourse-event-type': 'topic',
      'x-discourse-event-id': 'evt-topic',
      'x-discourse-event-signature': sign(topicRaw),
    });
    assert.strictEqual(topic.body.status, 'skipped_no_signal_fields');

    const userRaw = JSON.stringify({ user: { id: 3 } });
    const other = await api(app.base, 'POST', '/webhook/discourse', userRaw, {
      'x-discourse-event-type': 'user',
      'x-discourse-event-id': 'evt-user',
      'x-discourse-event-signature': sign(userRaw),
    });
    assert.strictEqual(other.body.status, 'ignored');
    assert.strictEqual(app.store.counts().signals, 0);
  } finally { await app.close(); }
});

test('sibling-convention alias /discourse/webhook stamps too', async () => {
  const app = await boot({ secret: SECRET });
  try {
    const [raw, headers] = postEvent({ ...signalPost, id: 5599 }, 'evt-alias');
    const r = await api(app.base, 'POST', '/discourse/webhook', raw, headers);
    assert.strictEqual(r.code, 201);
    assert.strictEqual(r.body.status, 'stamped');
  } finally { await app.close(); }
});

test('tag fallback: buy + ticker tags on a first post stamp a signal (FED-S04)', async () => {
  const app = await boot({ secret: SECRET });
  try {
    const [raw, headers] = postEvent({
      id: 6601, username: 'nikhil_cfa', post_number: 1, created_at: '2026-06-05T14:00:00Z',
      topic_title: 'BRK.B on the dip', topic_tags: ['buy', 'brk-b', 'value'],
    }, 'evt-tags-1');
    const r = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(r.code, 201);
    assert.strictEqual(r.body.status, 'stamped');
    assert.strictEqual(r.body.signal.kind, 'BUY');
    assert.strictEqual(r.body.signal.instrument, 'BRK.B');

    // replies inherit topic tags — post_number > 1 must NOT stamp
    const [raw2, headers2] = postEvent({
      id: 6602, username: 'quiet_lotus', post_number: 4,
      topic_tags: ['buy', 'brk-b'],
    }, 'evt-tags-2');
    const reply = await api(app.base, 'POST', '/webhook/discourse', raw2, headers2);
    assert.strictEqual(reply.body.status, 'skipped_no_signal_fields');

    // tags with no priced ticker are skipped, not errored
    const [raw3, headers3] = postEvent({
      id: 6603, username: 'nikhil_cfa', post_number: 1, topic_tags: ['buy', 'gurgaon-flat'],
    }, 'evt-tags-3');
    const noTicker = await api(app.base, 'POST', '/webhook/discourse', raw3, headers3);
    assert.strictEqual(noTicker.body.status, 'skipped_no_signal_fields');
  } finally { await app.close(); }
});

test('topic_created with signal + ticker tags stamps (post payloads carry no tags)', async () => {
  const app = await boot({ secret: SECRET });
  try {
    const raw = JSON.stringify({ topic: {
      id: 901, title: 'Adding AVGO on the AI networking ramp', tags: ['avgo', 'buy'],
      created_by: { id: 10, username: 'nikhil_cfa' }, created_at: '2026-06-05T14:00:00Z',
    } });
    const headers = {
      'x-discourse-event-type': 'topic',
      'x-discourse-event': 'topic_created',
      'x-discourse-event-id': 'evt-topic-901',
      'x-discourse-event-signature': sign(raw),
    };
    const r = await api(app.base, 'POST', '/webhook/discourse', raw, headers);
    assert.strictEqual(r.code, 201);
    assert.strictEqual(r.body.signal.kind, 'BUY');
    assert.strictEqual(r.body.signal.instrument, 'AVGO');
    assert.strictEqual(r.body.signal.postId, 'topic-901');

    // same topic redelivered under a new event id -> postId idempotency holds
    const headers2 = { ...headers, 'x-discourse-event-id': 'evt-topic-901-redeliver' };
    const dup = await api(app.base, 'POST', '/webhook/discourse', raw, headers2);
    assert.strictEqual(dup.body.status, 'duplicate_ignored');
  } finally { await app.close(); }
});
