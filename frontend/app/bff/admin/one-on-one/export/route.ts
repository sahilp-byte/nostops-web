// Admin CSV export of the local 1:1 session ledger (admin-guarded, GET → no
// CSRF). Streams the CSV produced by the internal audit service to the browser.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { fetchOneOnOneExport } from '@/lib/server/audit';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const upstream = await fetchOneOnOneExport(guard.user, req.nextUrl.search);
  const buf = await upstream.arrayBuffer();
  const res = new NextResponse(buf, { status: upstream.status });
  res.headers.set('content-type', upstream.headers.get('content-type') || 'text/csv');
  const cd = upstream.headers.get('content-disposition');
  if (cd) res.headers.set('content-disposition', cd);
  return res;
}
