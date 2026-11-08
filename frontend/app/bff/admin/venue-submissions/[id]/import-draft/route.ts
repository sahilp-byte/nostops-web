import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { importDraftLocal } from '@/lib/server/venue-submissions-local';

// Admin "Run website import" — generates reviewable suggestions (description /
// address / phone) from the venue's own website for a submission. Admin-only +
// CSRF (requireAdmin). Writes NOTHING: the admin reviews and Saves via the edit
// form (a draft, never auto-published). No payment of any kind.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Unknown submission.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 400) : '';

  const res = await importDraftLocal(id, url);
  if (!res.ok) return NextResponse.json({ error: res.error || 'Could not run website import.' }, { status: res.status || 502 });
  return NextResponse.json({ ok: true, proposed: res.proposed || {}, unverified: res.unverified || [], source: res.source, message: res.message });
}
