'use client';

// PROMPT 43 — retreat & venue reviews kept DISTINCT and never merged. The backend
// only stores TEACHER reviews (POST /public-reviews/{handle}); it has no per-retreat
// or per-venue review store yet, so those two live on the participant's device here.
// They are intentionally separate records so a teaching review is never conflated
// with a venue/hospitality review. (Backend gap tracked in ARCHITECTURE_data_model.md.)
export type LocalRetreatReview = {
  retreatId: string;
  retreatRating?: number;
  retreatText?: string;
  venueRating?: number;
  venueText?: string;
  teacherSubmitted?: boolean; // teacher review is persisted server-side; we just remember it's done
  updatedAt: number;
};

const KEY = 'nostops.retreatreviews.v1';

function readAll(): Record<string, LocalRetreatReview> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

export function getRetreatReview(retreatId: string): LocalRetreatReview | null {
  return readAll()[retreatId] || null;
}

export function saveRetreatReview(retreatId: string, patch: Partial<LocalRetreatReview>): void {
  if (typeof window === 'undefined') return;
  try {
    const all = readAll();
    all[retreatId] = { ...(all[retreatId] || { retreatId }), ...patch, retreatId, updatedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / serialization errors */
  }
}
