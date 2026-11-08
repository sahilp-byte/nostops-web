import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Close enrollment on a group booking — locks headcount + final discounted
// rate. CSRF-guarded proxy to POST /bookings/{id}/close-enrollment.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'unknown booking' }, { status: 404 });

  const up = await backendFetch(`/bookings/${encodeURIComponent(id)}/close-enrollment`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not close enrollment.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
