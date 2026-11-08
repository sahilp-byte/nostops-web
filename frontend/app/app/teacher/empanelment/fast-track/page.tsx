import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getFastTrackOffer, getFastTrackStatus, getEmpanelmentProgress } from '@/lib/server/teacher';
import FastTrackApply from '@/components/app/teacher/FastTrackApply';
import { FAST_TRACK_TERMS, FREE_PATH_SUMMARY } from '@/lib/empanelment-policy';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Fast-Track Empanelment', robots: { index: false, follow: false } };

// Policy V2: the badge follows an explicit Council decision on merit, never the
// payment. The main backend's offer text says "immediate … badge", so it is reworded.
const policyText = (w: string) => (/badge/i.test(w) ? 'If the Council approves you on merit: the Empanelled Teacher badge' : w);

export default async function FastTrackPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'teacher') redirect('/app');

  const [offer, status, prog] = await Promise.all([getFastTrackOffer(), getFastTrackStatus(), getEmpanelmentProgress()]);
  const amount = offer?.amount ?? 4999;
  const isEmpanelled = prog?.isEmpanelled ?? false;
  const latest = status?.history?.[0] ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/app/teacher/empanelment" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to empanelment</Link>

      {/* Offer */}
      <section className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-cream p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-600">⚡ Fast-Track</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight text-ink">Priority Council Empanelment</h1>
            <p className="mt-1 text-sm text-ink-soft">{offer?.durationMinutes || '30–45'} min · {offer?.format || 'Online interview with a Council member'}</p>
          </div>
          <span className="shrink-0 rounded-xl bg-white px-3 py-2 text-lg font-black text-accent-600">₹{amount.toLocaleString('en-IN')}</span>
        </div>
      </section>

      {offer && (offer.whatYouGet.length > 0 || offer.whatItsNot.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {offer.whatYouGet.length > 0 && (
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-extrabold text-ink">What you get</h2>
              <ul className="mt-3 space-y-2 p-0">
                {offer.whatYouGet.map(policyText).map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-ink-soft"><span className="mt-0.5 text-brand">✓</span>{w}</li>
                ))}
              </ul>
            </section>
          )}
          {offer.whatItsNot.length > 0 && (
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-sm font-extrabold text-ink">What it’s not</h2>
              <ul className="mt-3 space-y-2 p-0">
                {offer.whatItsNot.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-ink-soft"><span className="mt-0.5 text-muted">•</span>{w}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-5" data-testid="ft-policy-terms">
        <h2 className="text-sm font-extrabold text-ink">How the decision is made</h2>
        <ul className="mt-3 space-y-2 p-0">
          {FAST_TRACK_TERMS.map((t) => (
            <li key={t} className="flex items-start gap-2 text-sm text-ink-soft"><span className="mt-0.5 text-brand">•</span>{t}</li>
          ))}
        </ul>
      </section>

      <FastTrackApply amount={amount} isEmpanelled={isEmpanelled} active={status?.active ?? null} latest={latest} />

      <p className="rounded-xl border border-dashed border-line bg-cream/60 px-4 py-3 text-sm text-ink-soft" data-testid="ft-free-path-note">
        💡 Free path (no fee) · {FREE_PATH_SUMMARY}
      </p>
    </div>
  );
}
