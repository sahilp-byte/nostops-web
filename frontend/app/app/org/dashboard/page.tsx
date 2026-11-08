import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { listMyEvents, listMyOrganisations } from '@/lib/server/institutional';
import CreateAgainButton from '@/components/app/org/events/CreateAgainButton';
import OrganiserFlagReply from '@/components/app/org/OrganiserFlagReply';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

const TRUST_STYLE: Record<string, string> = {
  VERIFIED: 'bg-emerald-50 text-emerald-700', PENDING: 'bg-amber-50 text-amber-700', UNVERIFIED: 'bg-cream text-ink-soft',
};

const FLAG_LABELS: Record<string, string> = {
  VENUE_PROBLEM: 'Venue problem', TEACHER_AT_RISK: 'Teacher at risk / no-show',
  LOW_TURNOUT: 'Low turnout risk', SAFETY_CONCERN: 'Safety concern', OTHER: 'Other',
};

function FlaggedCard({ e }: { e: any }) {
  const f = e.coordinator_flag || {};
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" data-testid={`dash-flag-${e.event_id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">⚠️ {FLAG_LABELS[f.reason] || f.reason}</span>
        <p className="text-sm font-bold text-ink">{e.title}</p>
        {f.flagged_by_name && <span className="text-[11px] text-amber-800/80">Flagged by City Coordinator {f.flagged_by_name}</span>}
      </div>
      {f.note && <p className="mt-1.5 whitespace-pre-wrap text-sm text-amber-900/90">{f.note}</p>}
      <OrganiserFlagReply eventId={e.event_id} replies={f.replies || []} />
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-brand/40">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
    </Link>
  );
}

function EventLine({ e, repeat }: { e: any; repeat?: boolean }) {
  const eff = e.lifecycle_effective || e.lifecycle;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3" data-testid={`dash-event-${e.event_id}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{e.title}</p>
        <p className="mt-0.5 text-xs text-muted">{e.programme_snapshot?.name}{e.programme_snapshot?.version ? ` · ${e.programme_snapshot.version}` : ''} · {e.city || '—'} · {e.event_date || 'date TBC'} · {eff}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {eff === 'DRAFT' && <Link href={`/app/org/events/new?event=${e.event_id}`} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">Continue →</Link>}
        {repeat && <CreateAgainButton eventId={e.event_id} />}
        {e.slug && e.visibility !== 'PRIVATE' && eff !== 'DRAFT' && <Link href={`/events/${e.slug}`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">View →</Link>}
      </div>
    </div>
  );
}

function SoonCard({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-4">
      <p className="text-lg">{icon}</p>
      <p className="mt-1 text-sm font-extrabold text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </div>
  );
}

export default async function OrgDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const [events, orgs] = await Promise.all([listMyEvents(user), listMyOrganisations(user)]);

  const eff = (e: any) => e.lifecycle_effective || e.lifecycle;
  const drafts = events.filter((e) => eff(e) === 'DRAFT');
  const upcoming = events.filter((e) => ['PUBLISHED', 'LIVE'].includes(eff(e)));
  const completed = events.filter((e) => ['COMPLETED', 'EVERGREEN', 'ARCHIVED'].includes(eff(e)));

  const progMap = new Map<string, { name: string; version?: string; count: number }>();
  for (const e of events) {
    const s = e.programme_snapshot || {};
    if (!s.programme_id) continue;
    const cur = progMap.get(s.programme_id) || { name: s.name, version: s.version, count: 0 };
    cur.count += 1; progMap.set(s.programme_id, cur);
  }
  const programmes = [...progMap.values()].sort((a, b) => b.count - a.count);
  const flagged = events.filter((e: any) => e.coordinator_flag?.status === 'OPEN');

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">Programme Dashboard</h1>
            <p className="mt-1 text-sm text-ink-soft">Manage your organisations, Council programmes and events.</p>
          </div>
          <Link href="/app/org/events/new" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">+ Create a Programme</Link>
        </div>

        {/* Needs attention — coordinator at-risk flags (organiser can reply in-app) */}
        {flagged.length > 0 && (
          <section className="mt-5" data-testid="dash-needs-attention">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-700">⚠️ Needs attention <span className="text-muted">({flagged.length})</span></h2>
            <p className="mt-0.5 text-xs text-muted">A City Coordinator flagged these events. Reply with the fix — the coordinator and NOSTOPS will see it here.</p>
            <div className="mt-2 space-y-3">
              {flagged.map((e: any) => <FlaggedCard key={e.event_id} e={e} />)}
            </div>
          </section>
        )}

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="dash-stats">
          <Stat label="Organisations" value={orgs.length} href="#organisations" />
          <Stat label="Upcoming" value={upcoming.length} href="#upcoming" />
          <Stat label="Completed" value={completed.length} href="#completed" />
          <Stat label="Drafts" value={drafts.length} href="/app/org/events?tab=drafts" />
        </div>

        {/* My Organisation */}
        <section id="organisations" className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">My Organisation</h2>
          <div className="mt-2 space-y-2">
            {orgs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted">No organisation yet. Start a programme to create one.</p>
            ) : orgs.map((o) => (
              <div key={o.organisation_id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote logo URL, no next/image loader */}
                  {o.logo_url ? <img src={o.logo_url} alt="" className="h-9 w-9 rounded-lg object-contain ring-1 ring-line" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-cream">🏢</span>}
                  <div><p className="text-sm font-bold text-ink">{o.name}</p><p className="text-xs text-muted">{o.primary_city || '—'} · {o.cohort_type?.replace(/_/g, ' ').toLowerCase()}</p></div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TRUST_STYLE[o.trust_state] || 'bg-cream text-ink-soft'}`}>{o.trust_state === 'VERIFIED' ? '✓ Verified' : (o.trust_state || 'Unverified')}</span>
              </div>
            ))}
          </div>
        </section>

        {/* My Programmes */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-ink">My Programmes</h2>
            <Link href="/programmes" className="text-xs font-bold text-brand-700 hover:underline">Browse catalogue →</Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {programmes.length === 0 ? (
              <Link href="/app/org/events/new" className="rounded-xl border border-dashed border-line bg-white px-4 py-3 text-sm font-bold text-brand-700">+ Create your first programme</Link>
            ) : programmes.map((p) => (
              <span key={p.name} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink">
                ✓ {p.name}{p.version ? ` · ${p.version}` : ''} <span className="text-muted">×{p.count}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Upcoming */}
        <section id="upcoming" className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Upcoming Events <span className="text-muted">({upcoming.length})</span></h2>
          <div className="mt-2 space-y-2">
            {upcoming.length === 0 ? <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted">No upcoming events.</p> : upcoming.map((e) => <EventLine key={e.event_id} e={e} />)}
          </div>
        </section>

        {/* Completed + Create Again (first-class) */}
        <section id="completed" className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Completed Events <span className="text-muted">({completed.length})</span></h2>
          <p className="mt-0.5 text-xs text-muted">Completed public events stay live for at least 90 days. Run one again with one tap.</p>
          <div className="mt-2 space-y-2">
            {completed.length === 0 ? <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted">No completed events yet.</p> : completed.map((e) => <EventLine key={e.event_id} e={e} repeat />)}
          </div>
        </section>

        {/* Drafts */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-ink">Drafts <span className="text-muted">({drafts.length})</span></h2>
            <Link href="/app/org/events?tab=drafts" className="text-xs font-bold text-brand-700 hover:underline">View all →</Link>
          </div>
          <div className="mt-2 space-y-2">
            {drafts.length === 0 ? <p className="rounded-xl border border-dashed border-line bg-white p-5 text-sm text-muted">No drafts. Tap &ldquo;Save draft &amp; exit&rdquo; in the creator to keep one.</p> : drafts.slice(0, 5).map((e) => <EventLine key={e.event_id} e={e} />)}
          </div>
        </section>

        {/* Operational sections — launch with participant registration & teacher matching */}
        <section className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Participants, Teachers &amp; Reports</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="dash-ops">
            <SoonCard icon="🧑‍🤝‍🧑" title="Participants" note="Manage registrations here once participant registration launches." />
            <SoonCard icon="🧘" title="Teachers" note="Your matched NOSTOPS teachers will appear here after teacher matching." />
            <SoonCard icon="✅" title="Attendance" note="Mark and review attendance per session." />
            <SoonCard icon="⭐" title="Feedback" note="Participant feedback and ratings per event." />
            <SoonCard icon="📈" title="Reports" note="Participation, attendance and outcome reports." />
            <SoonCard icon="🧾" title="Create Again" note="Duplicate any completed event from the Completed list above." />
          </div>
        </section>
      </div>
    </div>
  );
}
