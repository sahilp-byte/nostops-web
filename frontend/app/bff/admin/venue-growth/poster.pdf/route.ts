import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { growthOrigin, proxyGrowthPdf } from '@/lib/server/venue-growth';

// Admin-only: any venue's printable A4 poster (?venue_id=&audience=teachers|guests&inline=1).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const sp = new URL(req.url).searchParams;
  const venueId = (sp.get('venue_id') || '').slice(0, 80);
  if (!venueId) return Response.json({ error: 'Missing venue.' }, { status: 400 });
  const audience = sp.get('audience') || 'teachers';
  if (audience !== 'teachers' && audience !== 'guests') return Response.json({ error: 'audience: teachers or guests' }, { status: 422 });
  const lang = sp.get('lang') || 'en';
  if (lang !== 'en' && lang !== 'hi') return Response.json({ error: 'lang: en or hi' }, { status: 422 });
  const inline = sp.get('inline') === '1';
  return proxyGrowthPdf(
    `/admin/poster.pdf?venue_id=${encodeURIComponent(venueId)}&audience=${audience}&lang=${lang}&base=${encodeURIComponent(growthOrigin(req.headers))}&inline=${inline}`,
  );
}
