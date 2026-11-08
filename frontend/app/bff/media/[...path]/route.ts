import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getObject, STORAGE_PREFIX } from '@/lib/server/object-storage';

export const runtime = 'nodejs';

// PUBLIC read proxy for retreat cover images stored in Emergent Object Storage.
// The storage API has no public URLs, so this route re-attaches the server-only
// storage key and streams the bytes. Scoped strictly to `nostops/retreats/**`
// (all public retreat covers) so it can never read another app's private objects.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = (path || []).join('/');
  if (!rel || rel.includes('..') || !rel.startsWith('retreats/')) {
    return new NextResponse('Not found', { status: 404 });
  }
  const full = `${STORAGE_PREFIX.split('/')[0]}/${rel}`; // nostops/retreats/...
  try {
    const obj = await getObject(full);
    if (!obj) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(obj.body, {
      status: 200,
      headers: {
        'Content-Type': obj.contentType,
        'X-Content-Type-Options': 'nosniff',
        // UUID filenames are immutable → cache aggressively.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
