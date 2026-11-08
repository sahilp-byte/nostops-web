// Admin › Intro Videos. GET = settings check + bucket connection + library + read-only bucket listing.
// POST = upload one video (multipart, ≤ 10 MB). Admin-gated here AND re-checked by the backend, which
// also checks the file's own bytes (the browser's file name / type are not trusted).
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { INTRO_VIDEO_MAX_BYTES, introVideoFetch, relay, unavailable } from '@/lib/server/intro-videos';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  try {
    return await relay(await introVideoFetch('/admin/overview', guard.user), 'Could not load the video library.');
  } catch {
    return unavailable();
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > INTRO_VIDEO_MAX_BYTES + 256 * 1024) {
    return NextResponse.json({ error: 'Videos can be at most 10 MB.' }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Choose a video file to upload.' }, { status: 400 });
  }
  if (file.size > INTRO_VIDEO_MAX_BYTES) return NextResponse.json({ error: 'Videos can be at most 10 MB.' }, { status: 413 });
  const out = new FormData();
  out.append('file', file, 'upload.bin'); // the backend names the file itself
  out.append('title', String(form.get('title') ?? '').slice(0, 200));
  out.append('description', String(form.get('description') ?? '').slice(0, 1000));
  try {
    return await relay(await introVideoFetch('/admin/videos', guard.user, { method: 'POST', body: out }, 60000), 'The upload failed.');
  } catch {
    return unavailable();
  }
}
