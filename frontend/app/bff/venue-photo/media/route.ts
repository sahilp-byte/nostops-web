import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPhotoResponse } from '@/lib/server/google-places';
import { isEligiblePlaceId } from '@/lib/server/ai-assisted-venues';

// Streams a Google Place photo (by resource name) for PAID AI-assisted venue
// profiles that use the live Places Details fallback. The API key stays
// server-side; only a validated `places/.../photos/...` resource name is
// accepted (no arbitrary fetch / SSRF).
export const dynamic = 'force-dynamic';

const NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_.~-]+$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || '';
  if (!NAME_RE.test(name)) return NextResponse.json({ error: 'bad photo name' }, { status: 400 });
  // Only photos of an eligible (grandfathered or paid) venue's pinned place.
  if (!(await isEligiblePlaceId(name.split('/')[1]))) return NextResponse.json({ error: 'not available' }, { status: 404 });
  const w = Math.min(Math.max(Number(searchParams.get('w')) || 1200, 200), 1600);

  try {
    const up = await getPhotoResponse(name, w);
    if (!up || !up.ok) return NextResponse.json({ error: 'photo unavailable' }, { status: 502 });
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
