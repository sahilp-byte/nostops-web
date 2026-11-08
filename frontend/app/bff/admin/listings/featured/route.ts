// Admin › Homepage & Listings — save the homepage "Meet Our Teachers" picks (up to 6, in order) and
// the "never on the homepage" list. Admin-gated here AND re-checked by the backend.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';
import { CURATION_TAG } from '@/lib/server/site-curation';
import { curationAdminFetch, relayCuration } from '@/lib/server/site-curation-admin';

const handles = (v: unknown) => (Array.isArray(v) ? v.slice(0, 250).map((x) => String(x ?? '').slice(0, 100)) : []);

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const b = await req.json().catch(() => ({}));
  const body = JSON.stringify({ featured: handles(b?.featured), home_hidden: handles(b?.home_hidden) });
  let res: NextResponse;
  try {
    res = await relayCuration(await curationAdminFetch('/admin/featured', guard.user, { method: 'PUT', body }), 'Could not save the homepage teachers.');
  } catch {
    return NextResponse.json({ error: 'The listings service is unavailable right now.' }, { status: 504 });
  }
  if (res.ok) {
    revalidateTag(CURATION_TAG, { expire: 0 });
    revalidatePath('/');
  }
  return res;
}
