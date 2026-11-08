import 'server-only';

// Public window/state of the Festive Complimentary InstaKYC campaign, read from the website backend
// (backend/festive_kyc.py GET /public — authoritative, server clock). Display only: this never
// decides who qualifies and never applies a waiver. If the backend can't be reached, the page falls
// back to the published dates so it still renders.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');

export type FestiveState = 'upcoming' | 'active' | 'ended' | 'disabled';
export type FestivePublic = { state: FestiveState; startsAt: string; endsAt: string; minProfilePercent: number };

const STARTS = '2026-11-01T00:00:00+05:30';
const ENDS = '2026-12-31T23:59:59+05:30';

// Task 3 (teacher dashboard claim button) flips this to true. Until then the claim CTA is shown
// but disabled ("Claiming opens soon") — owner decision.
export const FESTIVE_CLAIM_READY = true;
// After sign-in / Teacher sign-up the dashboard reads real eligibility from the backend.
export const FESTIVE_CLAIM_HREF = `/login?next=${encodeURIComponent('/app/teacher/kyc')}`;
export const FESTIVE_REGISTER_HREF = '/join';

export async function getFestivePublic(): Promise<FestivePublic> {
  const secret = process.env.PULSE_SHARED_SECRET || '';
  try {
    const r = await fetch(`${BASE}/api/festive-kyc/public`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': secret },
      next: { revalidate: 60, tags: ['festive-kyc'] },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const d = await r.json();
      return { state: d.state, startsAt: d.starts_at, endsAt: d.ends_at, minProfilePercent: d.min_profile_percent ?? 80 };
    }
  } catch {
    /* fall through to the published dates */
  }
  const now = Date.now();
  const state: FestiveState = now < Date.parse(STARTS) ? 'upcoming' : now > Date.parse(ENDS) + 999 ? 'ended' : 'active';
  return { state, startsAt: STARTS, endsAt: ENDS, minProfilePercent: 80 };
}
