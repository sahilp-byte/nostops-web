import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { spacesCall, spacesError } from '@/lib/server/spaces';
import { isCoverageStatus } from '@/lib/coverage';

// Phase 8B.2 — admin: start tracking a locality (creates its single coverage record via POST /api/spaces/coverage).
// Admin + CSRF enforced here; the backend re-checks the admin role, the locality and the reason.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const raw = await req.json().catch(() => ({}));
  if (!isCoverageStatus(raw.status)) return NextResponse.json({ error: 'Choose one of the four coverage statuses.' }, { status: 422 });
  const r = await spacesCall('/coverage', {
    method: 'POST',
    body: { pin: String(raw.pin || '').slice(0, 6), locality_id: String(raw.locality_id || '').slice(0, 120), status: raw.status, reason: String(raw.reason || '').slice(0, 1000) },
  });
  if (r.status !== 201) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not create the coverage record.') }, { status: r.status || 502 });
  return NextResponse.json(r.data, { status: 201 });
}
