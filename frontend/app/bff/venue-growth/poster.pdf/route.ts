import type { NextRequest } from 'next/server';
import { growthOrigin, proxyGrowthPdf } from '@/lib/server/venue-growth';

// The owner's printable A4 poster (read-only kit token): ?audience=teachers|guests, ?inline=1 to view.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const token = (sp.get('k') || '').trim().slice(0, 400);
  if (!token) return Response.json({ error: 'Missing toolkit link.' }, { status: 400 });
  const audience = sp.get('audience') || 'teachers';
  if (audience !== 'teachers' && audience !== 'guests') return Response.json({ error: 'audience: teachers or guests' }, { status: 422 });
  const lang = sp.get('lang') || 'en';
  if (lang !== 'en' && lang !== 'hi') return Response.json({ error: 'lang: en or hi' }, { status: 422 });
  const inline = sp.get('inline') === '1';
  return proxyGrowthPdf(
    `/poster.pdf?token=${encodeURIComponent(token)}&audience=${audience}&lang=${lang}&base=${encodeURIComponent(growthOrigin(req.headers))}&inline=${inline}`,
  );
}
