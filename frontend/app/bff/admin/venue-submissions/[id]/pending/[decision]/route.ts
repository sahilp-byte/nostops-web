import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { decidePendingLocal } from '@/lib/server/venue-submissions-local';

// Admin approves (applies to the live listing) or rejects an owner's pending
// changes to a live venue. CSRF + admin only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; decision: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id, decision } = await params;
  if (decision !== 'approve' && decision !== 'reject') return NextResponse.json({ error: 'Unsupported decision.' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  const r = await decidePendingLocal(id, decision, note, new URL(req.url).origin);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 502 });
  return NextResponse.json({ ok: true });
}
