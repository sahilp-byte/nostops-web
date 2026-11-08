import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { listMyEvents } from '@/lib/server/institutional';
import CreateAgainButton from '@/components/app/org/events/CreateAgainButton';
import EscalateButton from '@/components/app/EscalateButton';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-cream text-muted', PUBLISHED: 'bg-brand-50 text-brand-700',
  LIVE: 'bg-emerald-50 text-emerald-700', COMPLETED: 'bg-cream text-ink-soft',
  ARCHIVED: 'bg-cream text-muted', EVERGREEN: 'bg-accent/10 text-accent-600',
};
const VIS_STYLE: Record<string, string> = {
  PUBLIC: 'bg-emerald-50 text-emerald-700', UNLISTED: 'bg-amber-50 text-amber-700', PRIVATE: 'bg-cream text-ink-soft',
};
// §6 — teacher-confirmation chip for the HR events list (confirm-first). Wording
// mirrors the organiser status language without exposing matching internals.
const TEACHER_CHIP: Record<string, { label: string; cls: string }> = {
  TEACHER_MATCHING: { label: 'Finding teacher', cls: 'bg-amber-50 text-amber-700' },
  TEACHER_OFFERED: { label: 'Offer sent', cls: 'bg-amber-50 text-amber-700' },
  TEACHER_CONFIRMED: { label: '✅ Teacher Confirmed', cls: 'bg-emerald-50 text-emerald-700' },
  TEACHER_REASSIGNMENT_REQUIRED: { label: 'Finding another teacher', cls: 'bg-amber-50 text-amber-700' },
  TEACHER_UNAVAILABLE: { label: 'No teacher yet', cls: 'bg-red-50 text-red-700' },
};

function EventRow({ e }: { e: any }) {
  const isDraft = e.lifecycle === 'DRAFT';
  const canRepeat = ['PUBLISHED', 'LIVE', 'COMPLETED'].includes(e.lifecycle);
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm" data-testid={`event-row-${e.event_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-ink">{e.title}</p>
          {e.illustrative_only && (
            <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700" data-testid={`illustrative-${e.event_id}`}>Illustrative example · not a real session</span>
          )}
          <p className="mt-0.5 text-xs text-muted">{e.programme_snapshot?.name}{e.programme_snapshot?.version ? ` · ${e.programme_snapshot.version}` : ''} · {e.city || '—'} · {e.event_date || 'date TBC'}</p>
          {e.schedule_label && (
            <p className="mt-0.5 text-xs font-semibold text-brand-700" data-testid={`schedule-${e.event_id}`}>🔁 {e.schedule_label}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[e.lifecycle] || 'bg-cream text-muted'}`}>{e.lifecycle}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${VIS_STYLE[e.visibility] || ''}`}>{e.visibility}</span>
          {e.teacher_state && TEACHER_CHIP[e.teacher_state] && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TEACHER_CHIP[e.teacher_state].cls}`} data-testid={`teacher-chip-${e.event_id}`}>{TEACHER_CHIP[e.teacher_state].label}</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isDraft && !e.illustrative_only && (
          <Link href={`/app/org/events/new?event=${e.event_id}`} data-testid={`continue-draft-${e.event_id}`}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600">Continue editing →</Link>
        )}
        {!isDraft && e.slug && e.visibility !== 'PRIVATE' && (
          <Link href={`/events/${e.slug}`} className="inline-flex min-h-[44px] items-center rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">View public page →</Link>
        )}
        {!isDraft && (
          <Link href={`/app/org/events/${e.event_id}/participants`} data-testid={`roster-${e.event_id}`}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-cream">Participants →</Link>
        )}
        {canRepeat && <CreateAgainButton eventId={e.event_id} />}
      </div>
    </div>
  );
}

export default async function MyEventsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const events = await listMyEvents(user);
  const drafts = events.filter((e) => e.lifecycle === 'DRAFT');
  const live = events.filter((e) => e.lifecycle !== 'DRAFT');

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">Programme Events</h1>
            <p className="mt-1 text-sm text-ink-soft">Institutional events you&rsquo;ve created across your organisations.</p>
          </div>
          <Link href="/app/org/events/new" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">+ Create a Programme</Link>
        </div>
        <div className="mt-2"><EscalateButton /></div>

        {events.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-3xl">🧘</p>
            <p className="mt-2 text-base font-extrabold text-ink">No events yet</p>
            <p className="mt-1 text-sm text-ink-soft">Create your first Council-curated programme event for your organisation.</p>
            <Link href="/app/org/events/new" className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Create a Programme →</Link>
          </div>
        ) : (
          <>
            {/* Drafts (Prompt 3 §11) */}
            <section id="drafts" className="mt-6" data-testid="drafts-section">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-ink">Drafts</h2>
                <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-muted">{drafts.length}</span>
              </div>
              {drafts.length === 0 ? (
                <p className="mt-2 rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted">No drafts. Start a programme and tap &ldquo;Save draft &amp; exit&rdquo; at any step to keep it here.</p>
              ) : (
                <div className="mt-2 space-y-3">{drafts.map((e) => <EventRow key={e.event_id} e={e} />)}</div>
              )}
            </section>

            {/* Published / Live / Completed */}
            {live.length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-black uppercase tracking-wider text-ink">Published &amp; Live</h2>
                <div className="mt-2 space-y-3">{live.map((e) => <EventRow key={e.event_id} e={e} />)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
