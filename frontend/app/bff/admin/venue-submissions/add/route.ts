import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { createLocalSubmission } from '@/lib/server/venue-submissions-local';

// Admin "Add submission" — lets an admin add a venue that reached out by email/
// phone directly into the review queue. CSRF-guarded + admin-only. Writes to the
// same local `venue_submissions` store the console reads from.
const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const name = str(body?.venue_name, 120);
  const city = str(body?.city, 80);
  if (name.length < 2 || city.length < 1) {
    return NextResponse.json({ error: 'Venue name and city are required.' }, { status: 400 });
  }

  const payload = {
    venue_name: name,
    city,
    state: str(body?.state, 60),
    country: str(body?.country, 60),
    address: str(body?.address, 200),
    venue_type: str(body?.venue_type, 60),
    website_or_maps_url: str(body?.website_or_maps_url, 400),
    description: str(body?.description, 4000),
    submitter_role: str(body?.submitter_role, 40) || 'owner',
    submitter_name: str(body?.submitter_name, 120),
    submitter_email: str(body?.submitter_email, 160),
    submitter_phone: str(body?.submitter_phone, 40),
    relationship_note: str(body?.relationship_note, 1000),
    source_note: str(body?.source_note, 1000),
    capacity: typeof body?.capacity === 'number' && Number.isFinite(body.capacity) ? body.capacity : undefined,
  };

  const res = await createLocalSubmission(payload);
  if (!res.ok) {
    return NextResponse.json({ error: res.error || 'Could not add submission.' }, { status: res.status || 502 });
  }
  return NextResponse.json({ ok: true, submission_id: res.submissionId, deduped: res.deduped });
}
