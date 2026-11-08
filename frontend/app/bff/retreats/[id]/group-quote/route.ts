import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// Live group pricing quote for a retreat (tiered group discounts). GET, so no
// CSRF; session-guarded and read-only. Proxies GET /retreats/{id}/group-quote?size=N.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { id } = await params;
  const size = Math.floor(Number(req.nextUrl.searchParams.get('size')));
  if (!Number.isFinite(size) || size < 1 || size > 500) {
    return NextResponse.json({ error: 'Enter a valid group size.' }, { status: 400 });
  }

  const up = await backendFetch(`/retreats/${encodeURIComponent(id)}/group-quote?size=${size}`);
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray((d as any)?.detail) ? (d as any).detail[0]?.msg : (d as any)?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not price this group.') }, { status: up.status || 502 });
  }
  return NextResponse.json(d);
}
