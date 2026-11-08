import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New Batch', robots: { index: false, follow: false } };

// The older "New Batch" flow (components/app/org/CreateBookingForm.tsx, kept in
// the codebase) cannot apply Council-programme selection, the Special Needs
// verified-teacher rule or the publication rules, so NEW batches are no longer
// created here. The URL stays valid and points to the canonical wizard;
// existing batches, their invite links and detail pages are untouched.
export default async function NewBatchPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'corporate') redirect('/app');

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to overview</Link>
      <div className="mt-4 rounded-2xl border border-line bg-white p-6" data-testid="legacy-batch-moved">
        <h1 className="text-2xl font-black tracking-tight text-ink">Programmes are now created with the programme wizard</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Choose a Council-curated Mind, Body or Special Needs programme, configure your event and publish. The same programme, teacher-eligibility and publishing rules apply to every pathway.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/org/events/new" data-testid="legacy-batch-to-wizard"
            className="inline-flex min-h-[48px] items-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Create a Programme →</Link>
          <Link href="/app" className="inline-flex min-h-[48px] items-center rounded-xl border border-line px-5 py-3 text-sm font-bold text-ink transition hover:bg-cream">Your existing batches</Link>
        </div>
      </div>
    </div>
  );
}
