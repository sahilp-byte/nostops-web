import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getTeacherEvent } from '@/lib/server/institutional';
import AttendanceMarker from '@/components/app/teacher/AttendanceMarker';
import AssignmentResponse from '@/components/app/teacher/AssignmentResponse';
import TeacherFeedbackForm from '@/components/app/teacher/TeacherFeedbackForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Event · Institutional', robots: { index: false, follow: false } };

type Params = { params: Promise<{ eventId: string }> };

export default async function TeacherInstitutionalEvent({ params }: Params) {
  const { eventId } = await params;
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const data = await getTeacherEvent(user, eventId);
  if (!data) notFound();
  const { assignment: a, roster, sessions, feedback, can_mark_attendance, can_respond, can_give_feedback, assignment_status, my_feedback } = data;
  const confirmed = roster.filter((r) => r.booking_status === 'CONFIRMED').length;

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/app/teacher/institutional" className="text-xs font-bold text-brand-700 hover:underline">← Institutional events</Link>

        <div className="mt-3 rounded-3xl border border-line bg-gradient-to-br from-brand/10 via-cream to-white p-6">
          <h1 className="text-xl font-black tracking-tight text-ink">{a.event_title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{a.programme_name}{a.programme_taxonomy_label ? ` · ${a.programme_taxonomy_label}` : ''}{a.organisation_name ? ` · ${a.organisation_name}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            {a.event_date && <span>📅 {a.event_date}{a.start_time ? ` · ${a.start_time}` : ''}</span>}
            {(a.venue || a.city) && <span>📍 {a.venue || a.city}</span>}
            <span>👥 {confirmed} confirmed</span>
            <span className="font-bold text-brand-700">{a.lifecycle_effective}</span>
            {assignment_status === 'ACCEPTED' && <span className="font-bold text-emerald-700">✓ You accepted</span>}
          </div>
          {a.schedule_label && <p className="mt-2 text-sm font-semibold text-ink" data-testid="teacher-schedule">🔁 {a.schedule_label}</p>}
        </div>

        {can_respond && (
          <section className="mt-6">
            <AssignmentResponse eventId={eventId} />
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Attendance</h2>
          <p className="mb-3 text-xs text-muted">Participant names only — contact details stay with the organiser.</p>
          <AttendanceMarker eventId={eventId} roster={roster} canMark={can_mark_attendance} sessions={sessions} />
        </section>

        {can_give_feedback && (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Your feedback on this programme</h2>
            <TeacherFeedbackForm eventId={eventId} initialRating={my_feedback?.rating} initialComment={my_feedback?.comment} />
          </section>
        )}

        {feedback && feedback.count > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-ink">Participant feedback</h2>
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-ink">{feedback.average ?? '—'}</span>
                <div>
                  <p className="text-sm font-bold text-amber-500">{'★'.repeat(Math.round(feedback.average || 0))}<span className="text-line">{'★'.repeat(5 - Math.round(feedback.average || 0))}</span></p>
                  <p className="text-xs text-muted">{feedback.count} response{feedback.count === 1 ? '' : 's'}</p>
                </div>
              </div>
              {feedback.comments.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {feedback.comments.map((c, i) => (
                    <li key={i} className="rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-soft">
                      <span className="mr-2 font-bold text-amber-500">{'★'.repeat(c.rating || 0)}</span>{c.comment}
                    </li>
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
