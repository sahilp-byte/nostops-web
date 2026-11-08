import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';

// Council roster reactivate (PHASE 8). CSRF-guarded + admin-only.
//   POST /api/admin/council-roster/{handle}/reactivate
export async function POST(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { handle } = await params;
  if (!handle) return NextResponse.json({ ok: false, error: 'Unknown member.' }, { status: 400 });

  let up: Response;
  try {
    up = await backendFetch(`/admin/council-roster/${encodeURIComponent(handle)}/reactivate`, { method: 'POST', body: JSON.stringify({}) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Council roster service is unavailable right now.' }, { status: 502 });
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok || data?.success === false) {
    return NextResponse.json({ ok: false, error: toErrorText(data?.detail || data?.error, 'Could not reactivate the member.') }, { status: up.status || 502 });
  }

  revalidatePath('/app/admin/council-roster');
  return NextResponse.json({ ok: true });
}
