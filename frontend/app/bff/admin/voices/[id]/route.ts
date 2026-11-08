import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { adminArticleAction, adminSetRepublication } from '@/lib/server/voices';
import { revalidatePath } from 'next/cache';

// Admin editorial controls for one article. CSRF-guarded + admin-only.
//   { action: 'approve'|'reject'|'publish'|'unpublish', reason? }  → workflow
//   { republication: boolean }                                     → syndication toggle
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Unknown article.' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'No change supplied.' }, { status: 400 });

  let result: { ok: boolean; error?: string; data?: any };
  if (typeof body.republication === 'boolean') {
    result = await adminSetRepublication(id, body.republication);
  } else if (typeof body.action === 'string') {
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 1000) : undefined;
    result = await adminArticleAction(id, body.action, reason);
  } else {
    return NextResponse.json({ error: 'No valid change supplied.' }, { status: 400 });
  }
  if (!result.ok) return NextResponse.json({ error: result.error || 'Action failed.' }, { status: 502 });

  revalidatePath('/app/admin/voices');
  revalidatePath(`/app/admin/voices/${id}`);
  return NextResponse.json({ ok: true, ...(result.data || {}) });
}
