import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getOrgBookingDetail } from '@/lib/server/org';
import BatchShare from '@/components/app/org/BatchShare';
import CloseEnrollment from '@/components/app/org/CloseEnrollment';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Batch details', robots: { index: false, follow: false } };

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

const STATUS: Record<string, { label: string; cls: string }> = {
  inviting: { label: 'Inviting', cls: 'bg-brand-50 text-brand-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-50 text-blue-600' },
  active: { label: 'Active', cls: 'bg-brand-50 text-brand-700' },
  completed: { label: 'Completed', cls: 'bg-cream text-muted' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
  draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700' },
};

function pStatus(s: string) {
  if (s === 'paid') return { label: 'Paid', cls: 'bg-brand-50 text-brand-700' };
  if (s === 'cancelled') return { label: 'Cancelled', cls: 'bg-red-50 text-red-600' };
  return { label: 'Enrolled · unpaid', cls: 'bg-amber-50 text-amber-700' };
}

function fmt(ts: string | null) {
  if (!ts) return '';
  const d = Date.parse(ts);
  return Number.isNaN(d) ? '' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
}

export default async function OrgBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (normalizeRole(user.role) !== 'corporate') redirect('/app');

  const { id } = await params;
  const b = await getOrgBookingDetail(id);
  if (!b) notFound();

  const st = STATUS[b.status] || { label: b.status, cls: 'bg-cream text-muted' };
  const pct = b.capacity > 0 ? Math.min((b.registered / b.capacity) * 100, 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/app" className="text-sm font-bold text-brand-700 hover:underline">‹ Back to overview</Link>

      {/* Header */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-ink sm:text-2xl">{b.companyName}</h1>
            <p className="mt-0.5 text-sm text-muted">{b.courseTitle}{b.venueCity ? ` · ${b.venueCity}` : ''}{b.assignedTeacherName ? ` · ${b.assignedTeacherName}` : ''}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{b.registered}/{b.capacity} enrolled · {b.sessionCount} sessions</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-2xl font-black text-ink">{b.paidCount}</p><p className="text-xs font-bold uppercase tracking-wider text-muted">Paid</p></div>
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-2xl font-black text-ink">{b.pendingCount}</p><p className="text-xs font-bold uppercase tracking-wider text-muted">Unpaid</p></div>
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-2xl font-black text-brand-700">{inr(b.totalCollected)}</p><p className="text-xs font-bold uppercase tracking-wider text-muted">Collected</p></div>
      </div>

      {/* Batch payments — lock the group price & collect */}
      <CloseEnrollment bookingId={b.id} enrollmentOpen={b.enrollmentOpen} registered={b.registered} status={b.status} />

      {/* Re-share / nudge */}
      {b.inviteToken && b.status === 'inviting' && (
        <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5">
          <h2 className="text-sm font-extrabold text-ink">Nudge your team</h2>
          <p className="mt-0.5 text-sm text-muted">Re-share the invite link — the more colleagues join, the deeper the group discount.</p>
          <div className="mt-3">
            <BatchShare token={b.inviteToken} companyName={b.companyName} venue={b.venue} capacity={b.capacity} />
          </div>
        </section>
      )}

      {/* Participants */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Enrolled ({b.participants.length})</h2>
        {b.participants.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No one has enrolled yet. Share the invite link to get started.</p>
        ) : (
          <div className="mt-3 divide-y divide-line">
            {b.participants.map((p, i) => {
              const ps = pStatus(p.status);
              return (
                <div key={i} className="flex items-center gap-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-black text-brand-700">{p.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-ink">{p.name}</p>
                    <p className="truncate text-xs text-muted">{[p.email, p.department, fmt(p.registeredAt)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ps.cls}`}>{ps.label}</span>
                    {p.amount > 0 && <p className="mt-0.5 text-xs font-bold text-ink">{inr(p.amount)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
