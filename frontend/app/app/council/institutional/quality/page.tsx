import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getCouncilProgrammeQuality, type CouncilProgrammeQuality } from '@/lib/server/institutional';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Programme Quality · Council', robots: { index: false, follow: false } };

const TAX_STYLE: Record<string, string> = {
  MIND: 'bg-sky-50 text-sky-700',
  BODY: 'bg-emerald-50 text-emerald-700',
  SPECIAL_NEEDS: 'bg-violet-50 text-violet-700',
};

// §8 — read-only governance health signal for each programme.
const GOV_STYLE: Record<string, { label: string; cls: string }> = {
  STRONG: { label: '🌿 Performing strongly', cls: 'bg-emerald-100 text-emerald-800' },
  NEEDS_REFINEMENT: { label: '🛠 Needs refinement', cls: 'bg-amber-100 text-amber-800' },
  LOW_PARTICIPATION: { label: '📉 Low participation', cls: 'bg-rose-100 text-rose-800' },
  STEADY: { label: '• Steady', cls: 'bg-cream text-ink-soft' },
};
const SIGNAL_LABEL: Record<string, string> = {
  STRONG_REPEAT: '🔁 Strong repeat practice',
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-cream/50 px-3 py-2 text-center">
      <p className="text-base font-black text-ink">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted">No ratings yet</span>;
  const full = Math.round(value);
  return (
    <span className="text-sm font-bold text-amber-500" aria-label={`${value} out of 5`}>
      {'★'.repeat(full)}<span className="text-line">{'★'.repeat(5 - full)}</span>
      <span className="ml-1 text-ink">{value.toFixed(1)}</span>
    </span>
  );
}

function Trend({ points }: { points: CouncilProgrammeQuality['trend'] }) {
  if (!points || points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.events), 1);
  return (
    <div className="flex items-end gap-1.5" aria-hidden="true">
      {points.map((p) => (
        <div key={p.month} className="flex flex-col items-center gap-1">
          <div className="flex h-12 items-end">
            <div className="w-5 rounded-t bg-brand/70" style={{ height: `${Math.max(6, (p.events / max) * 48)}px` }} />
          </div>
          <span className="text-[9px] text-muted">{p.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function ProgrammeCard({ p }: { p: CouncilProgrammeQuality }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid={`quality-prog-${p.programme_id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-black text-ink">{p.name}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TAX_STYLE[p.taxonomy] || 'bg-cream text-ink-soft'}`}>{p.taxonomy_label}</span>
        {p.version && <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-muted">{p.version}</span>}
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${(GOV_STYLE[p.governance?.health] || GOV_STYLE.STEADY).cls}`} data-testid={`quality-gov-${p.programme_id}`}>
          {(GOV_STYLE[p.governance?.health] || GOV_STYLE.STEADY).label}
        </span>
        {p.governance?.signals?.filter((s) => SIGNAL_LABEL[s]).map((s) => (
          <span key={s} className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">{SIGNAL_LABEL[s]}</span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Metric label="Orgs" value={String(p.organisation_count)} />
        <Metric label="Events" value={String(p.event_count)} />
        <Metric label="Participation" value={String(p.participation)} />
        <Metric label="Attendance" value={`${p.attendance_rate}%`} sub={`${p.attended} present`} />
        <Metric label="Repeat" value={`${p.repeat_rate}%`} sub={`${p.repeat_participation} people`} />
        <Metric label="Cities" value={String(p.cities.length)} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Participant rating</p>
          <div className="mt-1"><Stars value={p.participant_rating} /></div>
          {p.participant_rating_count > 0 && <p className="mt-0.5 text-[10px] text-muted">{p.participant_rating_count} response{p.participant_rating_count === 1 ? '' : 's'}</p>}
          {p.participant_themes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.participant_themes.map((t) => (
                <span key={t.theme} className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{t.theme} · {t.count}</span>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Teacher feedback</p>
          <div className="mt-1"><Stars value={p.teacher_rating} /></div>
          {p.teacher_rating_count > 0 && <p className="mt-0.5 text-[10px] text-muted">{p.teacher_rating_count} teacher response{p.teacher_rating_count === 1 ? '' : 's'}</p>}
          {p.teacher_themes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.teacher_themes.map((t) => (
                <span key={t.theme} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t.theme} · {t.count}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {(p.cities.length > 0 || p.trend.length > 0) && (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          {p.cities.length > 0 && (
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Cities</p>
              <p className="mt-1 text-sm text-ink-soft">{p.cities.join(' · ')}</p>
            </div>
          )}
          {p.trend.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">Events / month</p>
              <Trend points={p.trend} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default async function CouncilProgrammeQualityPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const role = normalizeRole(user.role);
  if (role !== 'council' && role !== 'admin') redirect('/app');

  const data = await getCouncilProgrammeQuality(user);

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/app/council/institutional" className="text-xs font-bold text-brand-700 hover:underline">‹ Programme adoption</Link>
        <div className="mt-3">
          <h1 className="text-2xl font-black tracking-tight text-ink">Programme Quality Intelligence</h1>
          <p className="mt-1 text-sm text-ink-soft">
            How Council-curated programmes are performing in the field — participation, attendance, repeat practice, and what participants and teachers are saying. The knowledge layer, not a contact list.
          </p>
        </div>

        {!data ? (
          <p className="mt-6 rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">Quality data is unavailable right now.</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6" data-testid="council-quality-stats">
              <Stat label="Programmes" value={data.programme_count} />
              <Stat label="Events" value={data.total_events} />
              <Stat label="Participation" value={data.total_participation} />
              <Stat label="Attended" value={data.total_attended} />
              <Stat label="Attendance" value={`${data.overall_attendance_rate}%`} />
              <Stat label="Avg rating" value={data.overall_participant_rating != null ? data.overall_participant_rating.toFixed(1) : '—'} />
            </div>

            {/* §8 — governance signals for programme refinement decisions */}
            <section className="mt-8" data-testid="council-governance-summary">
              <h2 className="text-sm font-black uppercase tracking-wider text-ink">Programme governance</h2>
              <p className="mt-0.5 text-xs text-muted">{data.governance_note}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-line bg-emerald-50 p-4 text-center">
                  <p className="text-2xl font-black text-emerald-800">{data.governance_summary.performing_strongly}</p>
                  <p className="mt-0.5 text-xs font-bold text-emerald-700">🌿 Performing strongly</p>
                </div>
                <div className="rounded-2xl border border-line bg-amber-50 p-4 text-center">
                  <p className="text-2xl font-black text-amber-800">{data.governance_summary.needs_refinement}</p>
                  <p className="mt-0.5 text-xs font-bold text-amber-700">🛠 Needs refinement</p>
                </div>
                <div className="rounded-2xl border border-line bg-rose-50 p-4 text-center">
                  <p className="text-2xl font-black text-rose-800">{data.governance_summary.low_participation}</p>
                  <p className="mt-0.5 text-xs font-bold text-rose-700">📉 Low participation</p>
                </div>
                <div className="rounded-2xl border border-line bg-sky-50 p-4 text-center">
                  <p className="text-2xl font-black text-sky-800">{data.governance_summary.strong_repeat}</p>
                  <p className="mt-0.5 text-xs font-bold text-sky-700">🔁 Strong repeat practice</p>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-black uppercase tracking-wider text-ink">Programmes <span className="text-muted">({data.programmes.length})</span></h2>
              <p className="mt-0.5 text-xs text-muted">Sorted by reach and participation.</p>
              <div className="mt-3 space-y-3">
                {data.programmes.length === 0
                  ? <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">No programme activity yet.</p>
                  : data.programmes.map((p) => <ProgrammeCard key={p.programme_id} p={p} />)}
              </div>
            </section>

            <p className="mt-6 rounded-xl bg-cream/60 px-4 py-3 text-center text-xs italic text-muted" data-testid="quality-privacy-note">🔒 {data.privacy_note}</p>
            <p className="mt-2 text-center text-xs italic text-muted">{data.council_attribution}</p>
          </>
        )}
      </div>
    </div>
  );
}
