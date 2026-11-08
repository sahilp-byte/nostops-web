import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getSessionUser } from '@/lib/server/session';
import { getAdminCategories, actorFrom } from '@/lib/server/pulse';
import CategoryManager from '@/components/app/admin/pulse/CategoryManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Pulse Topics', robots: { index: false, follow: false } };

export default async function AdminPulseCategoriesPage() {
  await requireAdminUser();
  const user = await getSessionUser();
  const { categories } = await getAdminCategories(actorFrom(user!));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/app/admin/pulse" className="text-xs font-bold uppercase tracking-wider text-brand-700">← Teacher Pulse</Link>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Topics</h1>
        <p className="mt-1 text-ink-soft">Add, rename, reorder or archive the discussion topics teachers see.</p>
      </div>
      <CategoryManager initial={categories} />
    </div>
  );
}
