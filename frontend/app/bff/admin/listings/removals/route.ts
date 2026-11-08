// Admin › Homepage & Listings — "Delete" (remove from the website) or Restore a yoga teacher or a
// venue. Nothing is deleted from the main system: the teacher can still sign in and the venue record
// stays; every public page stops showing them. Admin-gated here AND re-checked by the backend.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';
import { CURATION_TAG } from '@/lib/server/site-curation';
import { curationAdminFetch, relayCuration } from '@/lib/server/site-curation-admin';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const b = await req.json().catch(() => ({}));
  const kind = b?.kind === 'teacher' || b?.kind === 'venue' ? b.kind : null;
  const action = b?.action === 'remove' || b?.action === 'restore' ? b.action : null;
  if (!kind || !action) return NextResponse.json({ error: 'Unknown change.' }, { status: 422 });
  const body = JSON.stringify({
    kind,
    action,
    ref: String(b?.ref ?? '').slice(0, 160),
    name: String(b?.name ?? '').slice(0, 200),
    reason: String(b?.reason ?? '').slice(0, 500),
  });
  let res: NextResponse;
  try {
    res = await relayCuration(await curationAdminFetch('/admin/removals', guard.user, { method: 'POST', body }), 'Could not save the change.');
  } catch {
    return NextResponse.json({ error: 'The listings service is unavailable right now.' }, { status: 504 });
  }
  if (res.ok) {
    // Removals touch many public pages (profiles, city pages, venue hubs, search, sitemap) — refresh all.
    revalidateTag(CURATION_TAG, { expire: 0 });
    revalidatePath('/', 'layout');
  }
  return res;
}
