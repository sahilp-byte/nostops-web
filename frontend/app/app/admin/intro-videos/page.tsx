import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import IntroVideoManager from '@/components/admin/IntroVideoManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Intro Videos', robots: { index: false, follow: false } };

export default async function AdminIntroVideosPage() {
  await requireAdminUser();
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-black uppercase tracking-wider text-brand-700">Media</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Intro Videos</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Approved introductory videos stored in Cloudflare R2. New videos start Private and Draft; only Published videos can
        be watched, and only Public ones without signing in.
      </p>
      <IntroVideoManager />
    </div>
  );
}
