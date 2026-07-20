// Inbound Discourse webhook: verify HMAC signature (same scheme as the sibling
// services), stay idempotent, and stamp a Signal when a post-created event
// carries the `signal_kind` + `ticker` custom fields set by the composer —
// or, until the theme composer lands, a signal tag (buy/sell/hold/update) plus
// a ticker tag from the blueprint's Tickers tag group on the topic's first post.
import crypto from 'node:crypto';
import { stampSignal } from './ledger.js';

export function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret) return true; // dev only: allow when no secret configured (warned at startup)
  if (!signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function handleEvent(headers, payload, { store, book }) {
  const eventType = headers['x-discourse-event-type'];
  const eventId = headers['x-discourse-event-id'] || `${eventType}:${crypto.randomUUID()}`;

  if (store.hasEvent(eventId)) return { status: 'duplicate_event_ignored', code: 200, eventId };

  const result = processEvent(eventType, payload, { store, book });
  // Record the event id only after a TERMINAL outcome (stamped/duplicate/skipped).
  // A failed delivery (unknown instrument, invalid payload) must stay retryable —
  // marking it seen up front would permanently swallow Discourse's redelivery.
  // stampSignal's postId idempotency guards genuine double-stamps regardless.
  if ((result.code || 200) < 400) store.addEvent(eventId);
  return result;
}

const SIGNAL_TAG_KINDS = { buy: 'BUY', sell: 'SELL', hold: 'HOLD', update: 'UPDATE' };

// Tag fallback (FED-S04): kind from the Signals tag group (one_per_topic), instrument
// from the first tag that maps to a priced instrument (brk-b -> BRK.B). First post only —
// replies inherit topic tags and must not stamp signals of their own.
function signalFromTags(p, book) {
  const tags = p.topic_tags || [];
  if (!tags.length || (p.post_number && p.post_number !== 1)) return {};
  const kind = tags.map((t) => SIGNAL_TAG_KINDS[String(t).toLowerCase()]).find(Boolean);
  const ticker = tags
    .map((t) => String(t).toUpperCase().replace(/-/g, '.'))
    .find((t) => book.has(t));
  return { kind, ticker };
}

function processEvent(eventType, payload, { store, book }) {
  // topic_created is the tags path today: Discourse's post_created payload carries no
  // topic_tags, but the topic payload does (tags + created_by). postId uses a stable
  // `topic-<id>` surrogate — idempotency and immutability semantics are unchanged.
  if (eventType === 'topic' && payload?.topic) {
    const t = payload.topic;
    const { kind, ticker } = signalFromTags({ topic_tags: t.tags, post_number: 1 }, book);
    if (!kind || !ticker) return { status: 'skipped_no_signal_fields', code: 200, topicId: t.id };
    return stampSignal(store, book, {
      userId: t.created_by?.username || t.created_by?.id,
      postId: `topic-${t.id}`,
      kind,
      instrument: ticker,
      stampedAt: t.created_at || new Date().toISOString(),
      note: t.title || undefined,
    });
  }

  if (eventType !== 'post' || !payload?.post) return { status: 'ignored', code: 200, eventType };

  const p = payload.post;
  const custom = p.custom_fields || {};
  const fromTags = signalFromTags(p, book);
  const kind = custom.signal_kind || p.signal_kind || fromTags.kind;
  const ticker = custom.ticker || p.ticker || fromTags.ticker;
  if (!kind || !ticker) return { status: 'skipped_no_signal_fields', code: 200, postId: p.id };

  // Pseudonym rule: the Discourse username IS the member's pseudonym — never
  // phone numbers or emails. Fall back to the numeric user id.
  const userId = p.username || p.user_id;
  return stampSignal(store, book, {
    userId,
    postId: p.id,
    kind,
    instrument: ticker,
    stampedAt: p.created_at || new Date().toISOString(),
    note: p.topic_title || undefined,
  });
}
