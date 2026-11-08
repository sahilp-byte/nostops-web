import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';

// PUBLIC: save edits to a submission, authenticated by the signed edit token.
// No CAPTCHA needed — the token proves the submitter opened the emailed link.
export const runtime = 'nodejs';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: unknown, len: number): string => s(v).slice(0, len);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 20) : [];
const AI_FIELDS = new Set(['description', 'address', 'submitter_phone']);

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  if (!SECRET) return NextResponse.json({ error: 'Temporarily unavailable.' }, { status: 503 });
  const raw = await req.json().catch(() => ({}));

  const token = clip(raw.token, 512);
  const venue_name = clip(raw.venue_name, 120);
  const city = clip(raw.city, 80);
  if (token.length < 8) return NextResponse.json({ error: 'This edit link is invalid or has expired.' }, { status: 400 });
  if (venue_name.length < 2) return NextResponse.json({ error: 'Enter the venue name.' }, { status: 400 });
  if (city.length < 2) return NextResponse.json({ error: 'Enter the venue city.' }, { status: 400 });

  const capRaw = Number(raw.capacity);
  const capacity = Number.isFinite(capRaw) && capRaw >= 1 && capRaw <= 5000 ? Math.floor(capRaw) : undefined;

  const body: Record<string, unknown> = {
    token,
    site_base: new URL(req.url).origin,
    venue_name,
    city,
    state: clip(raw.state, 60),
    country: clip(raw.country, 60),
    address: clip(raw.address, 200),
    venue_type: clip(raw.venue_type, 60),
    best_for: strArr(raw.best_for),
    amenities: strArr(raw.amenities),
    description: clip(raw.description, 4000),
    website_or_maps_url: clip(raw.website_or_maps_url, 400),
    submitter_name: clip(raw.submitter_name, 120),
    submitter_phone: clip(raw.submitter_phone, 40),
    relationship_note: clip(raw.relationship_note, 1000),
    // Fields the owner accepted from the paid AI website import (provenance tag).
    ai_fields: strArr(raw.ai_fields).filter((f) => AI_FIELDS.has(f)),
  };
  if (capacity !== undefined) body.capacity = capacity;

  try {
    const up = await fetch(`${BASE}/api/venues/public-submissions/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not save your changes. Please try again.') }, { status: up.status || 502 });
    // mode: 'pending' (live venue, awaiting admin review) | 'minor_applied' (typo fix, live now)
    //       | 'private_only' (contact details only) | 'resubmitted' (not live yet, back in the queue)
    return NextResponse.json({ ok: true, submission_id: data?.submission_id, mode: data?.mode || 'resubmitted', changed: data?.changed || [] });
  } catch {
    return NextResponse.json({ error: 'Service is unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}
