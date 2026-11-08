import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// Payment status for one of the seeker's reservations. GET (no CSRF),
// session-guarded, read-only. Proxies GET /retreats/reservation/{rid}/payment-status.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ rid: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { rid } = await params;
  const up = await backendFetch(`/retreats/reservation/${encodeURIComponent(rid)}/payment-status`);
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: 'Could not read reservation status.', status: null }, { status: up.status || 502 });
  }
  return NextResponse.json({ status: (d as any)?.status ?? null });
}
