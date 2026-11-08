// A short-lived playback link for one intro video. The backend decides access (PUBLIC → anyone,
// PRIVATE → signed-in members, DRAFT → admins) and signs the link; nothing here is cached.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { VIDEO_ID_RE, introVideoFetch, relay, unavailable } from '@/lib/server/intro-videos';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!VIDEO_ID_RE.test(id)) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  const user = await getSessionUser().catch(() => null);
  try {
    return await relay(await introVideoFetch(`/${id}/playback`, user), 'This video is unavailable right now.');
  } catch {
    return unavailable();
  }
}
