import type { NextRequest } from 'next/server';
import { growthOrigin, proxyGrowthPdf } from '@/lib/server/venue-growth';

// The owner's personalised invitation note as a PDF (read-only kit token).
// ?inline=1 opens it in the browser; otherwise it downloads.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const token = (sp.get('k') || '').trim().slice(0, 400);
  if (!token) return Response.json({ error: 'Missing toolkit link.' }, { status: 400 });
  const inline = sp.get('inline') === '1';
  const lang = sp.get('lang') === 'hi' ? 'hi' : 'en';
  return proxyGrowthPdf(`/invitation.pdf?token=${encodeURIComponent(token)}&base=${encodeURIComponent(growthOrigin(req.headers))}&inline=${inline}&lang=${lang}`);
}
