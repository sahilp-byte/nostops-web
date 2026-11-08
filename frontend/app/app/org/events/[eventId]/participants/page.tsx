import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getEventRoster } from '@/lib/server/institutional';
import CreateAgainButton from '@/components/app/org/events/CreateAgainButton';
import EscalateButton from '@/components/app/EscalateButton';
import { formatSessionDate } from '@/lib/org/schedule';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Participants', robots: { index: false, follow: false } };

type Params = { params: Promise<{ eventId: string }> };

const BS: Record<string, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700', WAITLISTED: 'bg-amber-50 text-amber-800',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-800', CANCELLED: 'bg-cream text-muted',
};

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center">
      <p className={`text-2xl font-black ${accent || 'text-ink'}`}>{value}{suffix || ''}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

export default async function OrgEventParticipants({ params }: Params) {
  const { eventId } = await params;
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const data = await getEventRoster(user, eventId);
  if (!data) notFound();
  const { event, summary, registrations, sessions, feedback, renewal } = data;
  // B2.2 — "S3 · 20 Jul 2026" for a repeating programme's session registrations.
  const sessionTag = (r: { session_seq?: number | null; session_date?: string | null }) =>
    r.session_seq ? `Session ${r.session_seq}${r.session_date ? ` · ${formatSessionDate(r.session_date)}` : ''}` : null;

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/app/org/events" className="text-xs font-bold text-brand-700 hover:underline">← Programme events</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">{event.title}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {event.event_date || 'date TBC'}{event.city ? ` · ${event.city}` : ''} · <span className="font-bold text-brand-700">{event.lifecycle_effective}</span>
            </p>
            {event.schedule_label && (
              <p className="mt-0.5 text-sm font-semibold text-ink-soft" data-testid="roster-schedule">🔁 {event.schedule_label}</p>
            )}
            {event.teacher_confirmed && event.assigned_teacher?.name ? (
              <div className="mt-1.5 inline-flex flex-col rounded-xl bg-emerald-50 px-3 py-2" data-testid="org-teacher-confirmed">
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">✅ Teacher Confirmed</span>
                <span className="text-sm font-black text-ink">{event.assigned_teacher.name}</span>
                {event.teacher_verified && (
                  <span className="text-[11px] font-bold text-emerald-700" data-testid="org-teacher-verified">✓ Verified Teacher</span>
                )}
              </div>
            ) : event.teacher_state_label ? (
              <p className="mt-1 text-sm font-semibold text-amber-700" data-testid="org-teacher-state">🔎 {event.teacher_state_label}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <EscalateButton eventId={event.event_id} />
            {event.slug && event.lifecycle_effective !== 'DRAFT' && (
              <Link href={`/events/${event.slug}`} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">View public page →</Link>
            )}
          </div>
        </div>

        {renewal.can_renew && (
          <section className="mt-5 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 via-cream to-white p-5" data-testid="renewal-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-ink">Renew this programme</h2>
                <p className="mt-0.5 text-xs text-ink-soft">This programme has run — bring it back for the next cohort.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CreateAgainButton eventId={event.event_id} label="🔁 Renew Programme" variant="primary" />
                <CreateAgainButton eventId={event.event_id} label="↻ Create again" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Attendance" value={renewal.attendance_rate} accent="text-brand-700" suffix="%" />
              <Stat label="Avg rating" value={renewal.avg_rating ?? 0} accent="text-amber-600" suffix={renewal.feedback_count ? '★' : ''} />
              <Stat label="Participants" value={renewal.participants} />
            </div>
            <p className="mt-2 text-[11px] text-muted">Based on {renewal.attended}/{renewal.participants} attended and {renewal.feedback_count} feedback response{renewal.feedback_count === 1 ? '' : 's'}.</p>
          </section>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
          <Stat label="Confirmed" value={summary.confirmed} accent="text-emerald-700" />
          <Stat label="Waitlist" value={summary.waitlisted} accent="text-amber-700" />
          <Stat label="Attended" value={summary.attended} accent="text-brand-700" />
          <Stat label="Cancelled" value={summary.cancelled} />
          <Stat label="Total" value={summary.total} />
        </div>

        {sessions && sessions.length > 0 && (
          <section className="mt-6" data-testid="roster-sessions">
            <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Sessions</h2>
            <p className="mb-2 text-xs text-muted">Participants register for each session separately; capacity applies to each session.</p>
            <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-line bg-white">
              {sessions.map((s, i) => (
                <div key={s.session_id} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-line' : ''}`} data-testid={`roster-session-${s.seq}`}>
                  <span className={`font-bold ${s.is_past ? 'text-muted' : 'text-ink'}`}>Session {s.seq} · {formatSessionDate(s.date)}</span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {s.confirmed} confirmed{s.waitlisted ? ` · ${s.waitlisted} waitlist` : ''}{s.attended ? ` · ${s.attended} attended` : ''}{s.is_full ? ' · Full' : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Registered participants</h2>
          {registrations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted" data-testid="roster-empty">No registrations yet. Share your event page to invite participants.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white" data-testid="org-roster">
              {registrations.map((r, i) => (
                <div key={r.registration_id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{r.name || 'Participant'}</p>
                    <p className="truncate text-xs text-muted">{r.email}{r.department ? ` · ${r.department}` : ''}{r.phone ? ` · ${r.phone}` : ''}</p>
                    {sessionTag(r) && <p className="text-[11px] font-semibold text-brand-700">{sessionTag(r)}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.attendance_status === 'PRESENT' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">Attended</span>}
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${BS[r.booking_status || ''] || 'bg-cream text-ink-soft'}`}>{r.booking_status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {feedback && feedback.count > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Participant feedback</h2>
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-ink">{feedback.average ?? '—'}</span>
                <p className="text-xs text-muted">{feedback.count} response{feedback.count === 1 ? '' : 's'}</p>
              </div>
              {feedback.comments.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {feedback.comments.map((c, i) => (
                    <li key={i} className="rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-soft"><span className="mr-2 font-bold text-amber-500">{'★'.repeat(c.rating || 0)}</span>{c.comment}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
