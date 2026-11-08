import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { refreshTeacherStatus, spCall, spError } from '@/lib/server/space-programmes';

// Phase 5B — create a Space programme draft. The teacher's authoritative status is refreshed
// server-side first; the browser's body is forwarded as-is so the backend rejects any financial field.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const st = await refreshTeacherStatus();
  if (!st.ok) return NextResponse.json({ error: st.error }, { status: st.status });
  const r = await spCall('', { method: 'POST', body });
  if (r.status !== 200) return NextResponse.json({ error: spError(r.data?.detail, 'Could not create the programme.') }, { status: r.status });
  return NextResponse.json(r.data);
}
