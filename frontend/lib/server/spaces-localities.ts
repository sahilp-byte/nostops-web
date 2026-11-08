import 'server-only';

// Phase 2 — NOSTOPS Spaces India-only PIN + locality lookup (backend/spaces_localities.py).
// Read-only reference data. Spaces-only: Global Venues never call this.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export type Locality = {
  id: string; pin: string; name: string; office_name: string; office_type: string; delivery: boolean;
  taluk: string; district: string; state: string; country: 'IN';
};
export type PinLookup = { ok: true; pin: string; country: 'IN'; district: string; state: string; districts: string[]; localities: Locality[] };
export type LocalityMeta = { ok: boolean; ready: boolean; error?: string; version?: string; source?: string; localities?: number; pins?: number; states?: number; loaded_at?: string };

async function call(path: string, revalidate = 86400): Promise<{ status: number; data: any }> {
  try {
    const r = await fetch(`${BASE}/api/spaces/localities${path}`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET },
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 502, data: { detail: { error: 'backend_error', message: 'Locality lookup is unavailable right now.' } } };
  }
}

export const PIN_RE = /^[1-9][0-9]{5}$/;

export function lookupPin(pin: string) {
  return call(`/pin/${encodeURIComponent(pin)}`);
}

export async function getLocalityMeta(): Promise<LocalityMeta | null> {
  const r = await call('/meta', 0);
  return r.status === 200 ? (r.data as LocalityMeta) : null;
}
