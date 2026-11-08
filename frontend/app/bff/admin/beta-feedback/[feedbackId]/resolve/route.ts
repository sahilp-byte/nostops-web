import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Resolve a beta feedback item (PHASE 14). CSRF-guarded + admin-only.
//   POST /api/admin/beta-feedback/{feedback_id}/resolve
export async function POST(req: NextRequest, { params }: { params: Promise<{ feedbackId: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { feedbackId } = await params;
  if (!feedbackId) return NextResponse.json({ ok: false, error: 'Unknown feedback item.' }, { status: 400 });

  let up: Response;
  try {
    up = await backendFetch(`/admin/beta-feedback/${encodeURIComponent(feedbackId)}/resolve`, { method: 'POST', body: JSON.stringify({}) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Feedback service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not resolve the item.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/beta-feedback');
  return NextResponse.json({ ok: true });
}
