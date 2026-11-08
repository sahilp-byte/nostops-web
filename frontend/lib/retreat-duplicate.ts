// PROMPT 45 — build a new retreat "from this experience". Maps an existing retreat
// into a fresh wizard draft, prepopulating the teacher's structure, itinerary,
// venue, logistics and FAQs, while CLEARING the things a repeat must re-confirm:
// dates (blank), venue availability (re-affirm), and re-surfacing pricing / capacity /
// cancellation for explicit confirmation. Pure + isomorphic (no backend call).
import type { RetreatDetail } from '@/lib/server/retreat-host';
import type { RetreatDraft } from '@/lib/retreat-draft';
import { parseRetreatContent } from '@/lib/retreat-content';

export function draftFromRetreat(r: RetreatDetail): RetreatDraft {
  const c = parseRetreatContent(r.description);
  return {
    step: 0,
    title: r.title,
    theme: r.theme || 'general',
    shortDesc: (c.intro || '').slice(0, 240),
    yogaSeKyaHoga: c.yogaSeKyaHoga || '',
    stay: c.stay || '',
    food: c.food || '',
    carryHome: c.carryHome || '',
    itin: c.itinerary && c.itinerary.length ? c.itinerary : undefined,
    cancellation: c.cancellation || '',
    exclusions: (c.notIncluded || []).join(', '),
    incl: r.inclusions && r.inclusions.length ? r.inclusions : undefined,
    audienceTags: r.audienceTags && r.audienceTags.length ? r.audienceTags : undefined,
    whatToCarry: r.whatToCarry.join(', '),
    howToGetThere: r.howToGetThere || '',
    venueName: r.venueName || '',
    venueCity: r.venueCity || '',
    state: r.state || '',
    venueWhy: r.venueDescription || '',
    cover: r.coverImage || '',
    // Prefilled but must be re-confirmed by the teacher for the new run:
    seats: r.seatsTotal ? String(r.seatsTotal) : '',
    price: r.priceInr ? String(r.priceInr) : '',
    venueCost: r.venueCostPerSeatInr ? String(r.venueCostPerSeatInr) : '',
    // Reset — a repeat needs fresh dates and a fresh venue-availability confirmation:
    startDate: '',
    endDate: '',
    venuePermission: false,
  };
}
