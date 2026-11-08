import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireFeatureAccess } from '@/lib/server/teacher-access';

// Connect a hosted retreat's venue to its public Google listing (#36 venue
// enrichment). CSRF-guarded, bearer attached server-side. Only the host can
// call this (the backend authorizes ownership). Forwards to:
//   POST /venue-enrichment/retreats/{id}/connect  {maps_url, i_have_venue_permission}
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');

// Accept the common shapes of a Google Maps / Business Profile share link.
// The backend does the authoritative resolution; this is a light client guard.
function looksLikeGoogleMapsUrl(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  return /(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|business\.google\.|share\.google)/i.test(u);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const gate = await requireFeatureAccess('retreat_hosting');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'missing retreat id' }, { status: 400 });

  const raw = await req.json().catch(() => ({}));
  const mapsUrl = s(raw.maps_url);
  const permission = raw.i_have_venue_permission === true;

  if (!mapsUrl) return NextResponse.json({ error: 'Paste the venue’s Google Maps or Business Profile link.' }, { status: 400 });
  if (!looksLikeGoogleMapsUrl(mapsUrl)) {
    return NextResponse.json({ error: 'That doesn’t look like a Google Maps / Business Profile link.' }, { status: 400 });
  }
  if (!permission) {
    return NextResponse.json({ error: 'Please confirm you have permission to reference this venue’s public listing.' }, { status: 400 });
  }

  const up = await backendFetch(`/venue-enrichment/retreats/${encodeURIComponent(id)}/connect`, {
    method: 'POST',
    body: JSON.stringify({ maps_url: mapsUrl, i_have_venue_permission: true }),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail || data?.error, 'Could not connect the venue.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
