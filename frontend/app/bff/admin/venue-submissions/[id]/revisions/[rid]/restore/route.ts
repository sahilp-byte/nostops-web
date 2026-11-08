import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { restoreRevisionLocal } from '@/lib/server/venue-submissions-local';

// Admin restores an earlier version of a venue listing (recorded as a new version).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id, rid } = await params;
  if (!/^rev_[a-f0-9]{6,32}$/.test(rid)) return NextResponse.json({ error: 'Unknown version.' }, { status: 404 });
  const r = await restoreRevisionLocal(id, rid);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 502 });
  return NextResponse.json({ ok: true, unchanged: !!r.data?.unchanged });
}
