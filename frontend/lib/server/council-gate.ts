// Council publication gate (backend/guru_nominations.py GET /public/gate): Council profile
// handles linked to a Guru nomination that is NOT published yet. Every public Council surface
// (roster + JSON-LD, /council/{slug}, share cards, stats, sitemap) passes this set to
// lib/council-visibility so the Guru stays hidden until they accept and an admin publishes.
// Cached 60 s and refreshed immediately on any admin nomination change (revalidateTag).
// Lookup failure → the last answer that loaded, so an outage never un-hides a Guru that was gated.
export const COUNCIL_GATE_TAG = 'council-gate';
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');

let lastGood: ReadonlySet<string> = new Set();

export async function getCouncilGate(): Promise<ReadonlySet<string>> {
  const secret = process.env.PULSE_SHARED_SECRET || '';
  if (!secret) return lastGood;
  try {
    const r = await fetch(`${BASE}/api/guru-nominations/public/gate`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': secret },
      next: { revalidate: 60, tags: [COUNCIL_GATE_TAG] },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return lastGood;
    const d = await r.json();
    lastGood = new Set((Array.isArray(d?.gated_handles) ? d.gated_handles : []).map((h: unknown) => String(h).toLowerCase()));
    return lastGood;
  } catch {
    return lastGood;
  }
}
