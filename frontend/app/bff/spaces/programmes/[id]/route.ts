import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { refreshTeacherStatus, spCall, spError } from '@/lib/server/space-programmes';

// Phase 5B — edit a Space programme draft (status refreshed first; Space / enquiry can never change).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const st = await refreshTeacherStatus();
  if (!st.ok) return NextResponse.json({ error: st.error }, { status: st.status });
  const r = await spCall(`/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  if (r.status !== 200) return NextResponse.json({ error: spError(r.data?.detail, 'Could not save the programme.') }, { status: r.status });
  return NextResponse.json(r.data);
}
