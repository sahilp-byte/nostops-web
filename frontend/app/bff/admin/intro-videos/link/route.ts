// Admin › Intro Videos — add a file that is already in the bucket to the library (the file is never
// changed, renamed or deleted). The backend checks it exists and really is a video.
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { introVideoFetch, relay, unavailable } from '@/lib/server/intro-videos';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const b = await req.json().catch(() => ({}));
  const body = JSON.stringify({
    key: String(b?.key ?? '').slice(0, 512),
    title: String(b?.title ?? '').slice(0, 200),
    description: String(b?.description ?? '').slice(0, 1000),
  });
  try {
    return await relay(await introVideoFetch('/admin/videos/link', guard.user, { method: 'POST', body }), 'Could not add that file.');
  } catch {
    return unavailable();
  }
}
