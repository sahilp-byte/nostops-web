import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Teacher intro-video. GET reads the current status (used for polling after a
// Cloudinary upload). POST is CSRF-guarded and whitelisted to two actions:
//   upload-token → returns a signed Cloudinary upload payload (no secrets leak;
//                  the client uploads the file directly to Cloudinary).
//   retake       → clears the current video so a new one can be recorded.

export async function GET() {
  const up = await backendFetch('/teachers/me/video-intro');
  const data = await up.json().catch(() => ({}));
  if (!up.ok) return NextResponse.json({ error: 'Could not load video status.' }, { status: up.status || 502 });
  return NextResponse.json({ ok: true, video_intro: data?.video_intro ?? null });
}

const PATHS: Record<string, string> = {
  'upload-token': '/teachers/me/video-intro/upload-token',
  retake: '/teachers/me/video-intro/retake',
};

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  const path = PATHS[action];
  if (!path) return NextResponse.json({ error: 'unknown action' }, { status: 404 });

  const up = await backendFetch(path, { method: 'POST', body: JSON.stringify({}) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail || data?.message, 'Request could not be completed.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, ...data });
}
