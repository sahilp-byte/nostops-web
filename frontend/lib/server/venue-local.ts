import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import type { OwnerCenter } from '@/lib/server/venue-owner';

// Server-only client for the LOCAL venue-centers fallback store (/api/venues/*).
// Used only because the remote POST /retreats/centers is 500ing for all owners.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT = 12000;

async function actor(): Promise<{ headers: Record<string, string>; userId: string } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const userId = String(user.user_id || user.email || '');
  const x = Buffer.from(JSON.stringify({ user_id: userId, name: user.name || user.email || '', role: normalizeRole(user.role) }), 'utf8').toString('base64');
  return { headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Pulse-User': x }, userId };
}

export function isLocalCenterId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('loc_');
}

function mapLocal(c: any): OwnerCenter | null {
  if (!c?.center_id) return null;
  return {
    id: String(c.center_id),
    name: c.name || 'Venue',
    city: c.city || undefined,
    state: c.state || undefined,
    address: c.address || undefined,
    pincode: c.pincode || undefined,
    country: c.country || undefined,
    capacity: typeof c.capacity === 'number' ? c.capacity : undefined,
    amenities: Array.isArray(c.amenities) ? c.amenities : [],
    foodType: c.food_type || undefined,
    roomTypes: Array.isArray(c.room_types) ? c.room_types : [],
    photos: Array.isArray(c.photos) ? c.photos : [],
    distinguishingFeature: c.distinguishing_feature || undefined,
    websiteOrMapsUrl: c.website_or_maps_url || undefined,
    openToPartnerships: c.open_to_partnerships !== false,
    isActive: c.is_active !== false,
  };
}

export async function createLocalCenter(payload: Record<string, unknown>): Promise<{ ok: boolean; center?: OwnerCenter; error?: string }> {
  const a = await actor();
  if (!a) return { ok: false, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/centers`, {
      method: 'POST', headers: { ...a.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (d?.detail as string) || 'Could not create the venue.' };
    return { ok: true, center: mapLocal(d?.center) || undefined };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function updateLocalCenter(id: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const a = await actor();
  if (!a) return { ok: false, error: 'Not signed in.' };
  try {
    const r = await fetch(`${BASE}/api/venues/centers/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { ...a.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (d?.detail as string) || 'Could not save the venue.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

export async function listLocalCenters(): Promise<OwnerCenter[]> {
  const a = await actor();
  if (!a) return [];
  try {
    const r = await fetch(`${BASE}/api/venues/centers/mine?owner_id=${encodeURIComponent(a.userId)}`, {
      headers: a.headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null);
    return (Array.isArray(d?.items) ? d.items : []).map(mapLocal).filter((x: OwnerCenter | null): x is OwnerCenter => x !== null);
  } catch {
    return [];
  }
}

export async function getLocalCenter(id: string): Promise<OwnerCenter | null> {
  const a = await actor();
  if (!a) return null;
  try {
    const r = await fetch(`${BASE}/api/venues/centers/${encodeURIComponent(id)}?owner_id=${encodeURIComponent(a.userId)}`, {
      headers: a.headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return mapLocal(d?.center);
  } catch {
    return null;
  }
}

// Center "extras" — persists the Google/website link and country locally, keyed
// by center_id, so they round-trip even for remote (ctr_*) centers whose frozen
// backend model drops these fields. Only provided fields are written.
export interface CenterExtra {
  websiteOrMapsUrl: string;
  country: string;
}

export async function saveCenterExtra(id: string, extra: { websiteOrMapsUrl?: string; country?: string }): Promise<void> {
  const a = await actor();
  if (!a) return;
  const body: Record<string, string> = {};
  if (extra.websiteOrMapsUrl !== undefined) body.website_or_maps_url = extra.websiteOrMapsUrl;
  if (extra.country !== undefined) body.country = extra.country;
  if (Object.keys(body).length === 0) return;
  try {
    await fetch(`${BASE}/api/venues/center-extras/${encodeURIComponent(id)}`, {
      method: 'POST', headers: { ...a.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch { /* best-effort */ }
}

export async function getCenterExtra(id: string): Promise<CenterExtra> {
  const a = await actor();
  if (!a) return { websiteOrMapsUrl: '', country: '' };
  try {
    const r = await fetch(`${BASE}/api/venues/center-extras/${encodeURIComponent(id)}`, { headers: a.headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return { websiteOrMapsUrl: '', country: '' };
    const d = await r.json().catch(() => null);
    return {
      websiteOrMapsUrl: typeof d?.website_or_maps_url === 'string' ? d.website_or_maps_url : '',
      country: typeof d?.country === 'string' ? d.country : '',
    };
  } catch {
    return { websiteOrMapsUrl: '', country: '' };
  }
}