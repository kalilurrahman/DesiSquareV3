// Core pipeline (pure, dependency-injected for testability).
import { normalizePhone, hashPhone } from './util.js';

// Is this group allowed? Empty allow-list = allow all (dev only).
export function isAllowedGroup(groupJid, config) {
  return config.allowedGroups.length === 0 || config.allowedGroups.includes(groupJid);
}

// Inbound: WhatsApp group message -> Discourse post as the mapped member (or guest).
export async function handleInbound(msg, { store, discourse, config, log = console.log }) {
  if (!msg || !msg.id) return { status: 'bad_message' };
  if (!isAllowedGroup(msg.groupJid, config)) return { status: 'ignored_group' };
  if (store.seen(msg.id)) return { status: 'duplicate_ignored' };
  store.markSeen(msg.id);

  const phone = normalizePhone(msg.phone);
  let text = String(msg.text || '').trim();
  const media = msg.media && msg.media.url ? msg.media : null; // B7: {url, type?} from the client
  if (!text && !media) return { status: 'skipped_empty' };
  if (!text) text = media.type === 'video' ? 'Shared a video' : media.type === 'document' ? 'Shared a document' : 'Shared a photo';

  // B7/DS-048: re-host media in Discourse when possible; otherwise fall back to the source
  // link as plain markdown (image embed only for our own uploads — expiring CDN links break).
  let mediaMd = '';
  if (media) {
    const hosted = await discourse.uploadFromUrl(media.url, `wa-${msg.id}`);
    mediaMd = hosted ? `\n\n![shared media](${hosted})` : `\n\n[shared media](${media.url})`;
  }

  const user = phone ? store.getUserByPhone(phone) : null; // null if unmapped or opted-out
  const title = text.length > 60 ? text.slice(0, 57) + '…' : text;

  if (user) {
    await discourse.postAsUser({ username: user.username, title, raw: text + mediaMd, category: config.discourse.mirrorCategory });
    log(`  mirrored msg ${msg.id} from ${hashPhone(phone, config.phoneHashSalt)} as @${user.username}${media ? ' (+media)' : ''}`);
    return { status: 'mirrored', as: user.username, media: !!media };
  }
  // Unmapped sender: post as guest with an invite CTA. NEVER include the phone number.
  const raw = `${text}${mediaMd}\n\n> _Shared from WhatsApp by a member who hasn't linked their account yet. [Join DesiSquare](/) to get credited._`;
  await discourse.postAsUser({ username: config.discourse.guestUsername, title, raw, category: config.discourse.mirrorCategory });
  return { status: 'mirrored_guest', media: !!media };
}

// Outbound: a Discourse notification -> WhatsApp Cloud API template (deep-link to the post).
export async function notify(notification, { store, cloudApi, config, log = console.log }) {
  const n = notification?.notification || notification;
  if (!n) return { status: 'bad_payload' };
  const eventId = `notif_${n.id ?? `${n.user_id}:${n.topic_id}:${n.created_at ?? ''}`}`;
  if (store.seen(eventId)) return { status: 'duplicate_ignored' };
  store.markSeen(eventId);

  const phone = store.phoneForUserId(n.user_id);
  if (!phone) return { status: 'no_phone_or_opted_out' };

  const link = `${config.discourse.url}/t/${n.topic_id || ''}`;
  try {
    await cloudApi.sendTemplate(phone, [n.data?.display_username || 'Someone', link]);
    log(`  notified user ${n.user_id} via WhatsApp (${hashPhone(phone, config.phoneHashSalt)})`);
    return { status: 'notified' };
  } catch (e) {
    // Fallback to email would go here (stub: log only).
    log(`  cloud-api failed (${e.message}) — would fall back to email`);
    return { status: 'failed_fallback_email' };
  }
}
