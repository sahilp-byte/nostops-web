import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { backendFetch } from '@/lib/server/session';
import { getVenues, venuePath } from '@/lib/server/venues';
import { HIDDEN_PUBLIC_HANDLES } from '@/lib/public-teacher';
import { curationAdminFetch } from '@/lib/server/site-curation-admin';
import ListingsManager, { type ListingTeacher, type ListingVenue, type ListingsState } from '@/components/admin/ListingsManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Homepage & Listings', robots: { index: false, follow: false } };

async function loadTeachers(): Promise<ListingTeacher[]> {
  try {
    const r = await backendFetch('/teachers/directory?limit=1000');
    const d = r.ok ? await r.json() : {};
    return (Array.isArray(d?.teachers) ? d.teachers : [])
      .filter((t: any) => t?.handle && !HIDDEN_PUBLIC_HANDLES.has(String(t.handle).toLowerCase()))
      .map((t: any) => ({
        handle: String(t.handle),
        name: String(t.name || '').trim() || String(t.handle),
        city: String(t.city || t.location?.city || '').trim(),
        avatar: typeof t.avatar_url === 'string' && t.avatar_url ? t.avatar_url : null,
        listed: t.public_profile_visible !== false && t.is_active !== false && !t.suspended_at,
      }))
      .sort((a: ListingTeacher, b: ListingTeacher) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function loadVenues(): Promise<ListingVenue[]> {
  const all = await getVenues({ limit: 100, includeRemoved: true }).catch(() => []);
  return all
    .map((v) => ({ id: v.id, name: v.name, city: v.city || '', path: venuePath(v) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function AdminListingsPage() {
  const user = await requireAdminUser();
  const [teachers, venues, stateRes] = await Promise.all([
    loadTeachers(),
    loadVenues(),
    curationAdminFetch('/admin/state', user).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const state: ListingsState | null = stateRes
    ? { featured: stateRes.featured || [], homeHidden: stateRes.home_hidden || [], maxFeatured: stateRes.max_featured || 6, removals: stateRes.removals || [] }
    : null;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-black uppercase tracking-wider text-brand-700">Website</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Homepage &amp; Listings</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Choose the teachers featured on the homepage, and delete yoga teachers or venues from the website. Deleting takes a
        listing off every public page; the account or venue record is kept and can be restored here at any time.
      </p>
      {state ? (
        <ListingsManager teachers={teachers} venues={venues} initial={state} />
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-cream/40 p-8 text-center text-sm text-muted" data-testid="listings-unavailable">
          The listings service is unavailable right now. Please try again shortly.
        </div>
      )}
    </div>
  );
}
