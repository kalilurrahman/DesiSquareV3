// EP-03 — Services & Products Hub (Phase 5, DS-201..DS-206). Zero-dependency helpers.
//
// The Hub is a public, SEO-facing surface: an expert directory, a service catalog, and a
// canonical-guides library distilled from community answers. It is held to the same
// non-negotiables as every other surface, enforced here at the data layer:
//   #4/#8 — percent-only: expert track records are a cumulative % (or null); never a dollar value.
//   #5    — identity-safe: cards carry NO email and NO phone; service prices are qualitative tiers
//           (words, never a currency amount), so nothing here can trip the leak-sweep.
//   #9    — ordering ranks by verified flair then name, NEVER by returns or money.
// Booking is a member action (gated in the API dispatcher, not here).
import { HttpError } from './util.mjs';

// Qualitative price tiers — deliberately word-only so no currency symbol/amount reaches a public
// surface (constraint #4/#8). "On request" pricing is settled privately at booking time.
export const HUB_PRICE_TIERS = ['Complimentary', 'Member', 'Premium'];

// Build a public-safe expert card. `card` is the output of the API's identity-safe authorCard()
// (id/name/initials/color/credential — no email, no phone); `trackRecordPct` is the maven's
// cumulative % or null. This function never accepts or emits a currency value.
export function publicExpertCard(expert, card, trackRecordPct, servicesCount = 0) {
  const pct = (typeof trackRecordPct === 'number' && Number.isFinite(trackRecordPct))
    ? Math.round(trackRecordPct * 10) / 10
    : null;
  return {
    id: card.id,
    name: card.name,
    initials: card.initials,
    color: card.color,
    credential: card.credential ?? null,
    verified: true,                       // the Hub lists verified experts only
    flair: expert.flair || 'Verified Maven',
    tagline: String(expert.tagline || '').slice(0, 160),
    specialties: Array.isArray(expert.specialties) ? expert.specialties.slice(0, 6) : [],
    corridors: Array.isArray(expert.corridors) ? expert.corridors.slice(0, 6) : [],
    trackRecordPct: pct,                  // percent-only (#8); null when unknown. Never a $ value.
    servicesCount: Number(servicesCount) || 0,
  };
}

// Public-safe service card. `priceTier` is a word from HUB_PRICE_TIERS — never a currency amount.
export function publicServiceCard(svc, expertName) {
  return {
    id: svc.id,
    expertId: svc.expertId,
    expertName: expertName || svc.expertId,
    title: String(svc.title || '').slice(0, 120),
    kind: svc.kind || 'consult',
    durationMin: Number(svc.durationMin) || 30,
    format: svc.format === 'chat' ? 'chat' : 'video',
    priceTier: HUB_PRICE_TIERS.includes(svc.priceTier) ? svc.priceTier : 'Member',
  };
}

// Public-safe canonical-guide card (SEO/programmatic pages consume the slug).
export function publicGuideCard(g) {
  return {
    id: g.id,
    slug: g.slug,
    title: String(g.title || '').slice(0, 140),
    summary: String(g.summary || '').slice(0, 280),
    author: g.author,
    tags: Array.isArray(g.tags) ? g.tags.slice(0, 6) : [],
    sourcePostId: g.sourcePostId ?? null,
    updatedAt: g.updatedAt ?? null,
  };
}

// Experts ordered by verified flair (all verified here) then name — NEVER by % returns or money (#9).
export function orderExperts(cards) {
  return cards.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// Validate a booking request against the known service ids. Returns { serviceId, note } or throws.
// The note is trimmed/bounded here; phone-number stripping (#5) happens at the API write.
export function validateBooking(body, serviceIds) {
  const serviceId = String(body?.serviceId ?? '').trim();
  if (!serviceId || !serviceIds.includes(serviceId)) {
    throw new HttpError(400, 'unknown service');
  }
  const note = String(body?.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  return { serviceId, note };
}
