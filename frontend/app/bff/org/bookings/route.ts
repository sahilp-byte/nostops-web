import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Create a group-booking batch (POST /bookings). CSRF-guarded. Whitelists and
// lightly validates the corporate/educational/startup batch payload before
// forwarding. Returns { booking_id, invite_link_token } on success.
const COHORTS = new Set(['company', 'education', 'startup_network']);
const DIMS = new Set(['body', 'mind', 'special_needs']);
// New batches are created through the canonical Council-programme wizard, which
// enforces the programme, Special Needs teacher-eligibility and publication
// rules. This older path cannot, so creation is closed (code kept for reference;
// existing batches are read through other routes and are unaffected).
const LEGACY_BATCH_CREATION_ENABLED = false;

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  if (!LEGACY_BATCH_CREATION_ENABLED) {
    return NextResponse.json(
      { error: 'New batches are created with the programme wizard.', next: '/app/org/events/new' },
      { status: 410 },
    );
  }
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Missing booking details.' }, { status: 400 });

  const companyName = String(b.company_name || '').trim();
  const venue = String(b.venue || '').trim();
  const capacity = parseInt(b.batch_capacity, 10);
  const dates = Array.isArray(b.session_dates) ? b.session_dates.filter((d: any) => d && d.date) : [];
  const dims = Array.isArray(b.yoga_dimensions) ? b.yoga_dimensions.filter((d: any) => DIMS.has(d)) : [];
  const cohort = COHORTS.has(b.cohort_type) ? b.cohort_type : 'company';

  if (!companyName || !venue) return NextResponse.json({ error: 'Organisation name and venue are required.' }, { status: 400 });
  if (!capacity || capacity < 18 || capacity > 40) return NextResponse.json({ error: 'Batch capacity must be between 18 and 40.' }, { status: 400 });
  if (dates.length === 0) return NextResponse.json({ error: 'Add at least one session date.' }, { status: 400 });
  if (dims.length === 0) return NextResponse.json({ error: 'Select at least one focus area.' }, { status: 400 });

  const payload = {
    company_name: companyName,
    venue,
    venue_address: String(b.venue_address || '').trim(),
    venue_city: String(b.venue_city || '').trim(),
    batch_capacity: capacity,
    session_dates: dates,
    yoga_dimensions: dims,
    course_title: String(b.course_title || '').trim() ||
      (cohort === 'education' ? 'Campus Yoga & Wellness Program' : cohort === 'startup_network' ? 'Founder Wellness Program' : 'Corporate Yoga Wellness Program'),
    cohort_type: cohort,
    audience_type: String(b.audience_type || '').trim(),
  };

  const up = await backendFetch('/bookings', { method: 'POST', body: JSON.stringify(payload) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail || data?.message, 'Could not create the batch.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, booking_id: data.booking_id, invite_link_token: data.invite_link_token });
}
