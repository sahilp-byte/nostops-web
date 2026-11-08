import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { requireAdmin } from '@/lib/server/admin-guard';
import { ownershipCall } from '@/lib/server/venue-ownership';

// Admin decision on a venue ownership claim: approve | reject | dispute | review.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; decision: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id, decision } = await params;
  const raw = await req.json().catch(() => ({}));
  const r = await ownershipCall(`/claims/${encodeURIComponent(id)}/${encodeURIComponent(decision)}`, { method: 'POST', body: { note: String(raw.note || '').slice(0, 1000) } });
  if (r.status !== 200) return NextResponse.json({ error: toErrorText(r.data?.detail, 'Could not record the decision.') }, { status: r.status });
  return NextResponse.json(r.data);
}
