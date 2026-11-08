import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getCoordinatorMe } from '@/lib/server/coordinator';
import { getCoordinatorCityEvents, type CoordCityEvent } from '@/lib/server/institutional';
import EscalateButton from '@/components/app/EscalateButton';
import CoordinatorFlagButton from '@/components/app/coordinator/CoordinatorFlagButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Institutional Events · Coordinator', robots: { index: false, follow: false } };

const LC_STYLE: Record<string, string> = {
  PUBLISHED: 'bg-sky-50 text-sky-700',
  LIVE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-brand-50 text-brand-700',
  EVERGREEN: 'bg-violet-50 text-violet-700',
  ARCHIVED: 'bg-rose-50 text-rose-700',
};

function EventRow({ e }: { e: CoordCityEvent }) {
  return (
    <div className="px-4 py-3" data-testid={`coord-event-${e.event_id}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{e.title}</p>
          <p className="truncate text-xs text-muted">{e.programme || '—'} · {e.event_date || 'date TBC'} · {e.visibility}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LC_STYLE[e.lifecycle] || 'bg-cream text-ink-soft'}`}>{e.lifecycle}</span>
          {e.slug && e.visibility !== 'PRIVATE' && (
            <Link href={`/events/${e.slug}`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">View →</Link>
          )}
        </div>
      </div>
      <CoordinatorFlagButton eventId={e.event_id} flag={e.flag ?? null} />
    </div>
  );
}

export default async function CoordinatorInstitutionalPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const role = normalizeRole(user.role);

  // Verify coordinator eligibility against the authoritative remote backend.
  // Admins may view directly. Teachers who are NOT coordinators are bounced.
  const me = await getCoordinatorMe();
  const isCoordinator = !!me.coordinator;
  if (!isCoordinator && role !== 'admin') {
    return (
      <div className="container-x py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">🔒</span>
          <h1 className="mt-2 text-lg font-black text-ink">Coordinator access required</h1>
          <p className="mt-1 text-sm text-ink-soft">The institutional events view is for City Coordinators serving their city. Reach out to the Council if you&apos;d like to serve your city.</p>
          <Link href="/app/coordinator/agreement" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">See how the programme works →</Link>
        </div>
      </div>
    );
  }

  const city = me.coordinator?.city || null;
  const data = await getCoordinatorCityEvents(user, city, 'coordinator');
  const events = data?.events ?? [];

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/app/coordinator" className="text-xs font-bold text-brand-700 hover:underline">‹ Coordinator Hub</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">Institutional Events{city ? ` · ${city}` : ''}</h1>
            <p className="mt-1 text-sm text-ink-soft">An operational record of the institutional programmes running in your city.</p>
          </div>
          <EscalateButton />
        </div>

        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-50/50 px-4 py-3 text-xs text-ink-soft" data-testid="coord-no-approval">
          ℹ️ You support and help resolve exceptions — you do <span className="font-bold">not</span> approve events. Organisations self-create programmes. Participant details stay private to each organisation.
        </div>

        <section className="mt-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Events <span className="text-muted">({events.length})</span></h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white" data-testid="coord-inst-events">
            {events.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted" data-testid="coord-events-empty">
                {city ? `No institutional events in ${city} yet.` : 'No institutional events yet.'} New programmes appear here as organisations publish them.
              </p>
            ) : (
              events.map((e, i) => (
                <div key={e.event_id} className={i > 0 ? 'border-t border-line' : ''}>
                  <EventRow e={e} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
