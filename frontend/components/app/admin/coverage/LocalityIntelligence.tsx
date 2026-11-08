import type { LocalityCounts } from '@/lib/server/spaces-coverage';
import { CoverageError } from '@/components/app/admin/coverage/CoverageUI';

// Phase 8B.3 — consolidated locality intelligence: Spaces by model, active Community Partners and
// teachers in three groups, for the locality and (deduplicated by the backend) for its whole PIN.
// Counts only — no names, contacts or other personal data.
type Row = { label: string; hint?: string; get: (c: LocalityCounts) => number; strong?: boolean };
const GROUPS: { title: string; testId: string; rows: Row[] }[] = [
  {
    title: 'Approved Spaces', testId: 'intel-spaces', rows: [
      { label: 'All approved', get: (c) => c.spaces.approved, strong: true },
      { label: 'Commercial', get: (c) => c.spaces.commercial },
      { label: 'Subsidised', get: (c) => c.spaces.subsidised },
      { label: 'Community', get: (c) => c.spaces.community },
    ],
  },
  { title: 'Community Partners', testId: 'intel-partners', rows: [{ label: 'Active partners', get: (c) => c.partners, strong: true }] },
  {
    title: 'Yoga teachers', testId: 'intel-teachers', rows: [
      { label: 'Verified & eligible', get: (c) => c.teachers.verified_eligible, strong: true },
      { label: 'Special Needs qualified', hint: 'of verified & eligible', get: (c) => c.teachers.special_needs_qualified ?? 0 },
      { label: 'Registered, not yet verified', get: (c) => c.teachers.registered_not_verified },
      { label: 'Inactive / ineligible', get: (c) => c.teachers.ineligible },
    ],
  },
];

const unclassified = (c: LocalityCounts) => c.spaces.approved - c.spaces.commercial - c.spaces.subsidised - c.spaces.community;

export default function LocalityIntelligence({ locality, pin, counts, pinCounts, pinError, pinLocalities }: {
  locality: string; pin: string; counts: LocalityCounts; pinCounts: LocalityCounts | null; pinError: string; pinLocalities: number;
}) {
  const stale = counts.teachers.stale;
  const pinStale = pinCounts?.teachers.stale ?? 0;
  return (
    <section className="sp-card p-5" data-testid="locality-intelligence">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px]">Locality intelligence</h2>
        <p className="text-xs text-[#6E6A63]">Live counts · QA and test records excluded</p>
      </div>
      {pinError && <div className="mt-3"><CoverageError message={pinError} testId="intel-pin-error" /></div>}
      {(stale > 0 || pinStale > 0) && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="intel-stale-warning">
          Some teacher statuses have not been refreshed from the main NOSTOPS backend in the last 24 hours ({stale} in {locality}, {pinStale} across PIN {pin}).
          Counts use the last recorded status. Refresh times for this locality&apos;s teachers are shown in the teachers panel; other localities of the PIN are listed on their own pages.
        </p>
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-xl border border-[#EEDFC8] bg-[#FFFDF8]" data-testid={g.testId}>
            <p className="border-b border-[#EEDFC8] px-3 py-2 text-sm font-bold text-[#0F4C4A]">{g.title}</p>
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-[#6E6A63]">
                <tr><th className="px-3 pb-1 pt-2 text-left font-semibold"><span className="sr-only">Measure</span></th><th className="px-2 pb-1 pt-2 text-right font-semibold">Locality</th><th className="whitespace-nowrap px-3 pb-1 pt-2 text-right font-semibold" title={`Unique across PIN ${pin}`}>PIN {pin}</th></tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.label} className="border-t border-[#F3EADB]">
                    <td className={`px-3 py-2 ${r.strong ? 'font-semibold text-[#1C2A47]' : 'text-[#3B4762]'}`}>{r.label}{r.hint && <span className="block text-[11px] text-[#6E6A63]">{r.hint}</span>}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${r.strong ? 'text-lg font-bold text-[#1C2A47]' : ''}`}>{r.get(counts)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#3B4762]">{pinCounts ? r.get(pinCounts) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {(unclassified(counts) > 0 || (pinCounts && unclassified(pinCounts) > 0)) && (
        <p className="mt-3 text-xs text-[#8A2A22]" data-testid="intel-unclassified">Some approved Spaces have no recognised model (commercial, subsidised or community) and are counted only in &quot;All approved&quot;.</p>
      )}
      {pinCounts && (
        <p className="mt-3 text-xs text-[#6E6A63]" data-testid="intel-pin-note">
          PIN figures are unique across all {pinLocalities} localities of PIN {pin}: a Space, partner or teacher linked to several localities in this PIN is counted once, not added up.
        </p>
      )}
    </section>
  );
}
