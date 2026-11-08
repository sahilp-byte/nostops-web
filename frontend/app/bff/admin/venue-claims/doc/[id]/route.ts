import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { ownershipCall } from '@/lib/server/venue-ownership';

// Admin-only view of a PRIVATE claim evidence document. Never cached, never indexed.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const r = await ownershipCall(`/claims/doc/${encodeURIComponent(id)}`);
  if (r.status !== 200) return NextResponse.json({ error: 'Not found.' }, { status: r.status });
  return new NextResponse(Buffer.from(String(r.data.base64 || ''), 'base64'), {
    headers: { 'Content-Type': String(r.data.type), 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'Content-Disposition': 'inline' },
  });
}
