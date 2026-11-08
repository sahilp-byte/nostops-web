import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireFeatureAccess } from '@/lib/server/teacher-access';
import { getBindableVenues } from '@/lib/server/venues';
import { resolveVenueBinding, venueDerivedFields, seatsOverCapacity } from '@/lib/server/venue-binding';
import { retreatDatesError, todayIST } from '@/lib/retreat-dates';

// Edit a hosted retreat (#36). CSRF-guarded PATCH → /retreats/{id}. Only sends
// fields the host actually changed; the backend enforces the edit-lock (locked
// once seats are paid) and re-validates every bound.
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const strArr = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 20) : [];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const gate = await requireFeatureAccess('retreat_hosting');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'missing retreat id' }, { status: 400 });
  const raw = await req.json().catch(() => ({}));

  const body: Record<string, unknown> = {};
  if (typeof raw.title === 'string') {
    const t = s(raw.title);
    if (t.length < 6 || t.length > 120) return NextResponse.json({ error: 'Title must be 6–120 characters.' }, { status: 400 });
    body.title = t;
  }
  if (typeof raw.description === 'string') {
    const d = s(raw.description);
    if (d.length < 40 || d.length > 2000) return NextResponse.json({ error: 'Description must be 40–2000 characters.' }, { status: 400 });
    body.description = d;
  }
  if (typeof raw.venue_name === 'string') body.venue_name = s(raw.venue_name);
  if (typeof raw.venue_city === 'string') body.venue_city = s(raw.venue_city);
  if (typeof raw.state === 'string') body.state = s(raw.state);
  if (typeof raw.cover_image === 'string') {
    const c = s(raw.cover_image);
    if (c === '' || (c.length <= 600 && (c.startsWith('/bff/media/') || /^https?:\/\//.test(c)))) body.cover_image = c;
  }
  if (typeof raw.venue_description === 'string') body.venue_description = s(raw.venue_description);
  if (typeof raw.start_date === 'string') body.start_date = s(raw.start_date);
  if (typeof raw.end_date === 'string') body.end_date = s(raw.end_date);
  // TVR-13: validate any date change against the stored other date.
  if (body.start_date !== undefined || body.end_date !== undefined) {
    let start = body.start_date as string | undefined;
    let end = body.end_date as string | undefined;
    if (start === undefined || end === undefined) {
      const cur = await backendFetch(`/retreats/${id}`).catch(() => null);
      const cd = cur && cur.ok ? await cur.json().catch(() => ({})) : {};
      const r = cd?.retreat ?? cd;
      start = start ?? String(r?.start_date || '').slice(0, 10);
      end = end ?? String(r?.end_date || '').slice(0, 10);
    }
    // A stored start date that is already past is only an error when the host is changing it.
    const dateErr = retreatDatesError(start, end, body.start_date === undefined ? '0000-00-00' : todayIST());
    if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });
  }
  if (raw.seats_total != null) {
    const n = Math.floor(Number(raw.seats_total));
    if (!Number.isFinite(n) || n < 4 || n > 200) return NextResponse.json({ error: 'Seats must be between 4 and 200.' }, { status: 400 });
    body.seats_total = n;
  }
  if (raw.price_per_seat_inr != null) {
    const n = Math.floor(Number(raw.price_per_seat_inr));
    if (!Number.isFinite(n) || n < 500 || n > 500000) return NextResponse.json({ error: 'Price must be between ₹500 and ₹5,00,000.' }, { status: 400 });
    body.price_per_seat_inr = n;
  }
  if (Array.isArray(raw.audience_tags)) body.audience_tags = strArr(raw.audience_tags);
  if (Array.isArray(raw.inclusions)) body.inclusions = strArr(raw.inclusions);

  // Venue binding: only touched when the field is PRESENT (omitted ⇒ existing
  // binding preserved). Never trust the browser id — re-validate against the
  // existing eligible directory. An empty value is rejected so a published
  // retreat can't be stripped of its required venue; ineligible ids are rejected.
  // The decision itself lives in a pure, test-covered helper (resolveVenueBinding).
  // Venue-derived fields + capacity: whenever the venue, its name/city/state or
  // the seat count changes, the listed venue the retreat is bound to (new or
  // existing) supplies name/city/state and caps the seats.
  const touchesVenue =
    typeof raw.venue_partner_id === 'string' || body.seats_total !== undefined ||
    body.venue_name !== undefined || body.venue_city !== undefined || body.state !== undefined;
  if (touchesVenue) {
    const eligible = await getBindableVenues({ limit: 100 }).catch(() => []);
    let boundId = '';
    if (typeof raw.venue_partner_id === 'string') {
      const decision = resolveVenueBinding(raw.venue_partner_id, true, eligible.map((v) => v.id), false);
      if (decision.action === 'reject') return NextResponse.json({ error: decision.error }, { status: 400 });
      if (decision.action === 'set') boundId = body.venue_partner_id = decision.value;
    } else {
      const cur = await backendFetch(`/retreats/${id}`).catch(() => null);
      const cd = cur && cur.ok ? await cur.json().catch(() => ({})) : {};
      boundId = String((cd?.retreat ?? cd)?.venue_partner_id || '');
    }
    const venue = boundId ? eligible.find((v) => v.id === boundId) : undefined;
    if (venue) {
      Object.assign(body, venueDerivedFields(venue, { venue_city: body.venue_city, state: body.state }));
      if (typeof body.seats_total === 'number') {
        const capErr = seatsOverCapacity(body.seats_total, venue.capacity);
        if (capErr) return NextResponse.json({ error: capErr }, { status: 400 });
      }
    }
  }

  if (Object.keys(body).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const up = await backendFetch(`/retreats/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not update the retreat.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
