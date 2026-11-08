import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getFastTrackQueue } from '@/lib/server/guru';
import { getFastTrackPolicyMap } from '@/lib/server/empanelment-policy';
import InterviewQueue from '@/components/app/council/InterviewQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Interview Queue', robots: { index: false, follow: false } };

export default async function CouncilInterviewsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'council') redirect('/app');

  const [q, policy] = await Promise.all([getFastTrackQueue(), getFastTrackPolicyMap(user)]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to Council home</Link>

      <div className="mt-4">
        <h1 className="text-2xl font-black tracking-tight text-ink">Empanelment interviews</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Claim paid fast-track applications, schedule the 30-minute interview, then record your decision. An approval is activated by a NOSTOPS admin after checking it. You earn a flat ₹1,500 per completed interview, paid quarterly.
        </p>
      </div>

      {q?.guruFocus && q.guruFocus.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-muted">Your focus:</span>
          {q.guruFocus.map((f) => (
            <span key={f} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{f}</span>
          ))}
        </div>
      )}

      {q && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          {[
            { n: q.counts.unclaimed, l: 'Unclaimed', c: '#EA580C' },
            { n: q.counts.claimedPendingInterview, l: 'To schedule', c: '#F59E0B' },
            { n: q.counts.interviewScheduled, l: 'Scheduled', c: '#0F766E' },
            { n: q.counts.approvedLast30d, l: 'Approved · 30d', c: '#0D9488' },
            { n: q.counts.rejectedLast30d, l: 'Rejected · 30d', c: '#EF4444' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-line bg-white p-2.5">
              <p className="text-lg font-black" style={{ color: s.c }}>{s.n}</p>
              <p className="text-[11px] font-semibold text-ink-soft">{s.l}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        {!q ? (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <span className="text-3xl">🔒</span>
            <h2 className="mt-2 text-base font-black text-ink">Interview queue unavailable</h2>
            <p className="mt-1 text-sm text-ink-soft">This workspace is for Council empanelment interviewers. Reach out to the Council if you expect access here.</p>
          </div>
        ) : (
          <InterviewQueue active={q.active} decidedRecent={q.decidedRecent} myUserId={String(user.user_id || '')} policy={policy} />
        )}
      </div>
    </div>
  );
}
