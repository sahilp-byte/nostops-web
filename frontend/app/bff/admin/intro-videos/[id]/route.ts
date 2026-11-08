// Admin › Intro Videos — edit (PATCH: title, description, visibility, status) or delete (DELETE with
// { confirm: "DELETE" }). Only videos uploaded through NOSTOPS have their R2 file deleted; files that
// were already in the bucket only leave the library.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { VIDEO_ID_RE, introVideoFetch, relay, unavailable } from '@/lib/server/intro-videos';

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: 'Video not found.' }, { status: 404 });

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  if (!VIDEO_ID_RE.test(id)) return notFound();
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, string> = {};
  for (const k of ['title', 'description', 'visibility', 'status'] as const) {
    if (typeof b?.[k] === 'string') patch[k] = b[k].slice(0, 1000);
  }
  try {
    return await relay(await introVideoFetch(`/admin/videos/${id}`, guard.user, { method: 'PATCH', body: JSON.stringify(patch) }), 'Could not save the change.');
  } catch {
    return unavailable();
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  if (!VIDEO_ID_RE.test(id)) return notFound();
  const b = await req.json().catch(() => ({}));
  const body = JSON.stringify({ confirm: String(b?.confirm ?? '').slice(0, 20) });
  try {
    return await relay(await introVideoFetch(`/admin/videos/${id}/delete`, guard.user, { method: 'POST', body }), 'Could not delete the video.');
  } catch {
    return unavailable();
  }
}
