import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import {
  getAdminInstitutionalOverview,
  getAdminEscalations,
  getAdminSettings,
  getAdminTeacherDirectory,
  type AdminInstEvent,
  type Escalation,
} from '@/lib/server/institutional';
import InstLifecycleControl from '@/components/app/admin/InstLifecycleControl';
import TeacherWindowControl from '@/components/app/admin/TeacherWindowControl';
import AdaptiveCompetenceControl from '@/components/app/admin/AdaptiveCompetenceControl';
import OrgTrustControl from '@/components/app/admin/OrgTrustControl';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Institutional Engine · Admin', robots: { index: false, follow: false } };

const TRUST_STYLE: Record<string, string> = {
  VERIFIED: 'bg-emerald-50 text-emerald-700',
  VERIFICATION_PENDING: 'bg-amber-50 text-amber-700',
  EXCEPTION_MANUAL_REVIEW: 'bg-rose-50 text-rose-700',
  UNVERIFIED: 'bg-cream text-ink-soft',
};
const LC_STYLE: Record<string, string> = {
  DRAFT: 'bg-cream text-muted',
  PUBLISHED: 'bg-sky-50 text-sky-700',
  LIVE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-brand-50 text-brand-700',
  EVERGREEN: 'bg-violet-50 text-violet-700',
  ARCHIVED: 'bg-rose-50 text-rose-700',
};
const CAT_STYLE: Record<string, string> = {
  VENUE_PROBLEM: 'bg-amber-50 text-amber-800',
  AT_RISK_EVENT: 'bg-amber-100 text-amber-900',
  COMPLAINT: 'bg-rose-50 text-rose-700',
  TEACHER_ISSUE: 'bg-sky-50 text-sky-700',
  EXCEPTION: 'bg-violet-50 text-violet-700',
  COMMERCIAL: 'bg-emerald-50 text-emerald-700',
  QUALITY_ISSUE: 'bg-fuchsia-50 text-fuchsia-700',
  OTHER: 'bg-cream text-ink-soft',
};

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

// Lifecycle can be admin-overridden only for published/completed public events.
function canOverride(e: AdminInstEvent): boolean {
  return e.lifecycle !== 'DRAFT' && e.visibility !== 'PRIVATE';
}

function EscalationCard({ x }: { x: Escalation }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4" data-testid={`esc-${x.reference}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CAT_STYLE[x.category] || CAT_STYLE.OTHER}`}>{x.category.replace(/_/g, ' ')}</span>
        <span className="text-[11px] font-bold text-ink">{x.reference}</span>
        <span className="text-[11px] text-muted">{x.from_name || 'User'} · {x.from_role}</span>
        {x.created_at && <span className="ml-auto text-[11px] text-muted">{x.created_at.slice(0, 10)}</span>}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{x.message}</p>
      {x.event_id && <p className="mt-1 text-[11px] text-muted">Event: {x.event_id}</p>}
      {(x.reply_count ?? 0) > 0 && x.last_reply && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2" data-testid={`esc-reply-${x.reference}`}>
          <p className="text-[11px] font-bold text-emerald-700">💬 Organiser reply{(x.reply_count ?? 0) > 1 ? ` (${x.reply_count})` : ''}{x.last_reply_by ? ` · ${x.last_reply_by}` : ''}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-emerald-900">{x.last_reply}</p>
        </div>
      )}
    </div>
  );
}

export default async function AdminInstitutionalPage() {
  const user = await requireAdminUser();
  const [overview, inbox, settings, directory] = await Promise.all([
    getAdminInstitutionalOverview(user),
    getAdminEscalations(user),
    getAdminSettings(user),
    getAdminTeacherDirectory(user),
  ]);

  const orgs = overview?.organisations ?? [];
  const events = overview?.events ?? [];
  const usage = overview?.programme_usage ?? [];
  const escalations = inbox?.escalations ?? [];

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/app/admin" className="text-xs font-bold text-brand-700 hover:underline">‹ Admin Dashboard</Link>
        <div className="mt-3">
          <h1 className="text-2xl font-black tracking-tight text-ink">Institutional Program Engine</h1>
          <p className="mt-1 text-sm text-ink-soft">Organisations, events (including drafts), Council programme adoption and human-escalation tickets. No participant PII.</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="admin-inst-stats">
          <Stat label="Organisations" value={overview?.organisation_count ?? 0} />
          <Stat label="Events" value={overview?.event_count ?? 0} />
          <Stat label="Drafts" value={overview?.draft_count ?? 0} />
          <Stat label="Open tickets" value={inbox?.open_count ?? 0} />
        </div>

        {/* Platform settings (§5 configurable teacher response window) */}
        <section className="mt-8" data-testid="admin-inst-settings">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Platform settings</h2>
          <div className="mt-2">
            <TeacherWindowControl
              current={settings?.teacher_response_window_hours ?? 48}
              isDefault={settings?.is_default ?? true}
            />
          </div>
          <div className="mt-3">
            <AdaptiveCompetenceControl teachers={directory.teachers} awaiting={directory.awaiting} />
          </div>
          <Link href="/app/admin/institutional/special-needs-review" data-testid="sn-review-page-link"
            className="mt-2 inline-flex text-xs font-bold text-brand-700 hover:underline">
            View teachers who declared Special Needs and await review →
          </Link>
        </section>

        {/* Human-escalation inbox */}
        <section className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Human Escalations <span className="text-muted">({escalations.length})</span></h2>
          <p className="mt-0.5 text-xs text-muted">Support tickets raised from organiser, teacher and coordinator screens (§16).</p>
          <div className="mt-3 space-y-2" data-testid="admin-escalations">
            {escalations.length === 0
              ? <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">No escalations raised.</p>
              : escalations.slice(0, 30).map((x) => <EscalationCard key={x.reference} x={x} />)}
          </div>
        </section>

        {/* Programme adoption */}
        <section className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Programme adoption</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {usage.length === 0
              ? <p className="rounded-xl border border-dashed border-line bg-white px-4 py-3 text-sm text-muted">No programmes in use yet.</p>
              : usage.map((p) => (
                <span key={p.programme_id} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink">
                  {p.name || p.programme_id} <span className="text-muted">×{p.count}</span>
                </span>
              ))}
          </div>
        </section>

        {/* Organisations */}
        <section className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Organisations <span className="text-muted">({orgs.length})</span></h2>
          <div className="mt-2 space-y-2" data-testid="admin-inst-orgs">
            {orgs.slice(0, 30).map((o) => (
              <div key={o.organisation_id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{o.name}</p>
                  <p className="text-xs text-muted">{o.primary_city || '—'} · {(o.cohort_type || '').replace(/_/g, ' ').toLowerCase()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TRUST_STYLE[o.trust_state] || 'bg-cream text-ink-soft'}`}>{o.trust_state === 'VERIFIED' ? '✓ Verified' : (o.trust_state || 'Unverified').replace(/_/g, ' ')}</span>
                  <OrgTrustControl organisationId={o.organisation_id} current={o.trust_state} />
                </div>
              </div>
            ))}
            {orgs.length > 30 && <p className="text-center text-xs text-muted">+{orgs.length - 30} more</p>}
          </div>
        </section>

        {/* Events incl. drafts + lifecycle controls */}
        <section className="mt-8">
          <h2 className="text-sm font-black uppercase tracking-wider text-ink">Events <span className="text-muted">({events.length})</span></h2>
          <p className="mt-0.5 text-xs text-muted">Archive removes an event from search and the sitemap; Evergreen keeps a completed event indexable.</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white" data-testid="admin-inst-events">
            {events.slice(0, 40).map((e, i) => (
              <div key={e.event_id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{e.title}</p>
                  <p className="truncate text-xs text-muted">{e.programme || '—'}{e.programme_version ? ` · ${e.programme_version}` : ''} · {e.city || '—'} · {e.event_date || 'date TBC'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LC_STYLE[e.lifecycle] || 'bg-cream text-ink-soft'}`}>{e.lifecycle}</span>
                  {canOverride(e) && <InstLifecycleControl eventId={e.event_id} current={e.lifecycle} />}
                </div>
              </div>
            ))}
            {events.length > 40 && <p className="border-t border-line py-2 text-center text-xs text-muted">+{events.length - 40} more</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
