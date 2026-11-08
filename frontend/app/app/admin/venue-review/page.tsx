import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getVenueReviewData } from '@/lib/server/venue-review';
import VenueReviewQueue from '@/components/app/admin/VenueReviewQueue';
import VenueBackfillButton from '@/components/app/admin/VenueBackfillButton';
import VenueAddSubmissionButton from '@/components/app/admin/VenueAddSubmissionButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Venue Submissions', robots: { index: false, follow: false } };

export default async function VenueReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'admin') redirect('/app');

  const data = await getVenueReviewData();
  const m = data.metrics;

  // PROMPT 34 — pipeline overview.
  const kpis = [
    { label: 'Pending reviews', value: m.pendingReviews, tone: 'text-brand-700' },
    { label: 'Needs information', value: m.needsInformation, tone: 'text-accent-600' },
    { label: 'Approved', value: m.approved, tone: 'text-brand-700' },
    { label: 'Published', value: m.published, tone: 'text-brand-700' },
    { label: 'Potential duplicates', value: m.potentialDuplicates, tone: 'text-red-700' },
    { label: 'Recently submitted', value: m.recentlySubmitted, tone: 'text-ink' },
    { label: 'Recently updated', value: m.recentlyUpdated, tone: 'text-ink' },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Venue Quality &amp; Verification</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Venue Submissions</h1>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <VenueAddSubmissionButton />
          <VenueBackfillButton />
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Review, verify, enrich and publish venues so the NOSTOPS directory stays trustworthy. Submissions move through a clear lifecycle before they become publicly discoverable. Use <strong className="text-ink">Sync venues now</strong> to pull in every owner-created venue at once.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-3xl font-black ${k.tone}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <VenueReviewQueue
          rows={data.rows}
          counts={data.counts}
          submissionsBackendReady={data.submissionsBackendReady}
          cities={data.cities}
          states={data.states}
          venueTypes={data.venueTypes}
          submitterTypes={data.submitterTypes}
        />
      </div>
    </div>
  );
}
