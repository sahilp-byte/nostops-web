// Client-side draft of an in-progress "Host your retreat" wizard. Saved on the
// teacher's device so they can leave and pick up exactly where they left off.
// No backend draft endpoint exists, and a half-finished retreat should never be
// created server-side, so this stays local until the teacher publishes.
export type RetreatDraft = {
  step?: number;
  title?: string;
  shortDesc?: string;
  theme?: string;
  startDate?: string;
  endDate?: string;
  seats?: string;
  cover?: string;
  carryHome?: string;
  yogaSeKyaHoga?: string;
  stay?: string;
  food?: string;
  cohortCurated?: boolean;
  personaMix?: string[];
  seniority?: string;
  language?: string;
  cohortNotes?: string;
  venuePartnerId?: string;
  venueName?: string;
  venueCity?: string;
  state?: string;
  lat?: string;
  lng?: string;
  mapsUrl?: string;
  venuePermission?: boolean;
  venueWhy?: string;
  venueCap?: import('@/lib/venue-capacity').VenueCapacityBreakdown;
  capOverride?: boolean;
  incl?: string[];
  inclMore?: string;
  itinerary?: string;
  itin?: import('@/lib/retreat-content').ItineraryItem[];
  audienceTags?: string[];
  framings?: string[];
  preRamp?: string;
  postSanskara?: string;
  price?: string;
  venueCost?: string;
  minCohort?: string;
  maxCohort?: string;
  cohortDeadline?: string;
  shortfallPolicy?: string;
  groupNote?: string;
  taxNote?: string;
  cancellation?: string;
  exclusions?: string;
  howToGetThere?: string;
  whatToCarry?: string;
  savedAt?: number;
};

const KEY = 'nostops.retreatdraft.v1';

export function loadRetreatDraft(): RetreatDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RetreatDraft) : null;
  } catch {
    return null;
  }
}

export function saveRetreatDraft(d: RetreatDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function clearRetreatDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// A draft is worth restoring only once the teacher has entered real content
// (not just the base coordinates the wizard pre-fills on load).
export function draftIsMeaningful(d: RetreatDraft | null): boolean {
  if (!d) return false;
  return Boolean(
    (d.title && d.title.trim()) ||
      (d.shortDesc && d.shortDesc.trim()) ||
      (d.venueName && d.venueName.trim()) ||
      (d.itinerary && d.itinerary.trim()) ||
      (d.carryHome && d.carryHome.trim()),
  );
}
