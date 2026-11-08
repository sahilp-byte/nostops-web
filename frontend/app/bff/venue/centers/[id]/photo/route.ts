import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';

// Streams a Google Place photo for a venue CENTER through the backend proxy
// (GET /venue-enrichment/centers/{id}/photo?photo_name=...). Mirrors the retreat
// photo proxy — keeps Google photo bytes server-side so <img src="/bff/..."> works.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || '';
  if (!name) return NextResponse.json({ error: 'missing photo name' }, { status: 400 });
  const w = Math.min(Math.max(Number(searchParams.get('w')) || 800, 200), 1600);

  try {
    const up = await backendFetch(
      `/venue-enrichment/centers/${encodeURIComponent(id)}/photo?photo_name=${encodeURIComponent(name)}&max_width_px=${w}`,
    );
    if (!up.ok) return NextResponse.json({ error: 'photo unavailable' }, { status: up.status || 502 });
    const buf = await up.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': up.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'photo unavailable' }, { status: 502 });
  }
}
