import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';
import { getPublicRetreats } from '@/lib/server/retreats';
import { retreatGoogleAllowed } from '@/lib/server/ai-assisted-venues';

// Streams the FIRST Google venue photo for a retreat as a card thumbnail.
// Resolves the venue's photo list, then proxies the first photo's bytes. Returns
// 404 when the venue isn't Google-connected, has no photos, or isn't eligible
// for Google content (free venue) — the card then falls back to a themed cover.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const w = Math.min(Math.max(Number(searchParams.get('w')) || 800, 200), 1200);

  try {
    const r = (await getPublicRetreats()).retreats.find((x) => x.id === id);
    if (!r || !(await retreatGoogleAllowed(r))) return NextResponse.json({ error: 'unavailable' }, { status: 404 });
    const meta = await backendFetch(`/venue-enrichment/retreats/${encodeURIComponent(id)}/venue?include_reviews=false&include_photos=true`);
    if (!meta.ok) return NextResponse.json({ error: 'unavailable' }, { status: 404 });
    const data = await meta.json().catch(() => null);
    const photos: any[] = Array.isArray(data?.photos) ? data.photos : [];
    const name = photos.length ? (photos[0]?.name || photos[0]?.photo_name || photos[0]?.photo_reference) : '';
    if (!name) return NextResponse.json({ error: 'no photo' }, { status: 404 });

    const ph = await backendFetch(`/venue-enrichment/retreats/${encodeURIComponent(id)}/photo?photo_name=${encodeURIComponent(name)}&max_width_px=${w}`);
    if (!ph.ok) return NextResponse.json({ error: 'photo unavailable' }, { status: ph.status || 404 });
    const buf = await ph.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': ph.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  }
}
