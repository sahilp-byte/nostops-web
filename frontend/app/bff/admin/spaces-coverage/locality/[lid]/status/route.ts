import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { spacesCall, spacesError } from '@/lib/server/spaces';
import { isCoverageStatus } from '@/lib/coverage';

// Phase 8B.2 — admin: change one locality's coverage status (POST /api/spaces/coverage/locality/{lid}/status).
// The backend validates the status, the mandatory reason and the optimistic version, and writes the audit history.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ lid: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { lid } = await params;
  const raw = await req.json().catch(() => ({}));
  if (!isCoverageStatus(raw.status)) return NextResponse.json({ error: 'Choose one of the four coverage statuses.' }, { status: 422 });
  const r = await spacesCall(`/coverage/locality/${encodeURIComponent(lid)}/status`, {
    method: 'POST',
    body: { status: raw.status, reason: String(raw.reason || '').slice(0, 1000), expected_version: Number(raw.expected_version) || 0 },
  });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not change the coverage status.') }, { status: r.status || 502 });
  return NextResponse.json(r.data);
}
