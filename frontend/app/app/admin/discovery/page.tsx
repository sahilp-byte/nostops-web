import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getDiscoveryAnalytics, getDiscoveryCities } from '@/lib/server/discovery-admin';
import CreateCampaignClient from '@/components/admin/discovery/CreateCampaignClient';
import CampaignControls from '@/components/admin/discovery/CampaignControls';
import ClaimReminderPanel from '@/components/admin/discovery/ClaimReminderPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Teacher Discovery', robots: { index: false, follow: false } };

const FUNNEL: Array<{ key: keyof import('@/lib/server/discovery-admin').Funnel; label: string }> = [
  { key: 'discovered', label: 'Discovered' },
  { key: 'relevant', label: 'Relevant' },
  { key: 'provisional', label: 'Provisional' },
  { key: 'invited', label: 'Invited' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'profile_complete', label: 'Profile complete' },
  { key: 'applications', label: 'Applications' },
  { key: 'empanelled', label: 'Empanelled' },
];

function pct(n: number): string { return `${Math.round((n || 0) * 100)}%`; }
function fmt(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
}
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700', paused: 'bg-amber-50 text-amber-700',
  stopped: 'bg-red-50 text-red-700', completed: 'bg-slate-100 text-slate-600',
};

export default async function AdminDiscoveryPage() {
  await requireAdminUser();
  const [a, citiesResp] = await Promise.all([getDiscoveryAnalytics(), getDiscoveryCities()]);
  const cities = citiesResp.cities;
  const anyPaused = a.campaigns.some((c) => c.discovery_paused);
  const byQuery = Object.entries(a.by_query).filter(([k]) => k !== '—').sort((x, y) => y[1] - x[1]);
  const perCity = Object.entries(a.per_city);

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <p className="text-xs font-black uppercase tracking-wider text-brand-700">Growth</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Teacher Discovery</h1>
      <p className="mt-1 text-sm text-muted">How many teachers we discovered, invited, claimed and brought into NOSTOPS.</p>

      {/* HOW IT WORKS */}
      <details className="mt-4 rounded-xl border border-line bg-cream/40 p-4" data-testid="discovery-how-it-works">
        <summary className="cursor-pointer text-sm font-black text-ink">How Discovery works</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-ink-soft">
          <li><b>Discover</b> — one campaign per city searches public Google listings (names + area only) within strict request caps that auto-pause on the target/limit.</li>
          <li><b>Review</b> — each teacher is classified; use Relevant / Rejected / All to check them, and mark irrelevant/duplicate as needed.</li>
          <li><b>Invite</b> — open or copy a teacher’s claim link to share it, and “Mark invited” to track outreach. Unclaimed provisional pages stay search-hidden; the /claim hub is indexed.</li>
          <li><b>Claim &amp; graduate</b> — the teacher claims their free profile and onboards. Once their verified profile is live, “Link verified profile” redirects the provisional page to it.</li>
          <li><b>Public &amp; reminded</b> — a claimed page is public (Google, sitemap, site search, city page). The teacher gets up to 3 “finish your profile” emails until it is live.</li>
        </ol>
      </details>

      {anyPaused && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3" data-testid="discovery-paused-banner">
          <p className="text-sm font-black text-amber-800">⏸ DISCOVERY PAUSED</p>
          <p className="text-[13px] text-amber-800/90">One or more campaigns reached their target or request limit. No further Google API calls are made until resumed or the target is raised.</p>
        </div>
      )}

      {/* FUNNEL */}
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">Funnel</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="discovery-funnel">
          {FUNNEL.map((s, i) => (
            <div key={s.key} className="rounded-xl border border-line bg-white p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{i + 1}. {s.label}</p>
              <p className="mt-1 text-2xl font-black text-ink">{a.funnel[s.key]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RATES */}
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">Conversion rates</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Claim rate', v: a.rates.claim_rate, sub: 'claimed / invited' },
            { label: 'Profile completion', v: a.rates.profile_completion_rate, sub: 'completed / claimed' },
            { label: 'Application rate', v: a.rates.application_rate, sub: 'applications / claimed' },
            { label: 'Empanelment rate', v: a.rates.empanelment_rate, sub: 'empanelled / applications' },
          ].map((r) => (
            <div key={r.label} className="rounded-xl border border-line bg-white p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{r.label}</p>
              <p className="mt-1 text-2xl font-black text-brand-700">{pct(r.v)}</p>
              <p className="text-[11px] text-muted">{r.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <ClaimReminderPanel />

      {/* API USAGE */}
      <section className="mt-6 rounded-xl border border-line bg-cream/40 p-4" data-testid="discovery-usage">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">API usage</h2>
        <p className="text-[11px] text-muted">Request counts only — not a billing figure.</p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
          <Row label="API requests" v={a.usage.api_requests} />
          <Row label="Discovery requests" v={a.usage.discovery_requests} />
          <Row label="ID-only requests" v={a.usage.id_only_requests} />
          <Row label="Rich-data requests" v={a.usage.rich_data_requests} />
          <Row label="Max requests / run" v={a.usage.max_requests_per_run} />
          <Row label="Max pages / query" v={a.usage.max_pages_per_query} />
          <Row label="Monthly cap (global)" v={(a.usage as any).monthly_request_cap ?? 0} />
          <Row label="Monthly used" v={(a.usage as any).monthly_requests_used ?? 0} />
          <Row label="Monthly remaining" v={(a.usage as any).monthly_requests_remaining ?? 0} />
          <Row label="Per-campaign cap" v={(a.usage as any).campaign_request_cap_default ?? 0} />
        </div>
      </section>

      {/* CREATE CAMPAIGN */}
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">New campaign</h2>
        <CreateCampaignClient cities={cities} />
      </section>

      {/* CAMPAIGNS */}
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">Campaigns</h2>
        {a.campaigns.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line bg-cream/40 p-6 text-center text-sm text-muted">No campaigns yet. Create the Navi Mumbai pilot above.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {a.campaigns.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-white p-3" data-testid="discovery-campaign">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-ink">{c.city}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[c.status] || 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                      {c.discovery_paused && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">discovery paused</span>}
                    </p>
                    <p className="text-[12px] text-muted">{c.accepted_total}/{c.target} accepted · {c.candidates_remaining ?? Math.max(c.target - c.accepted_total, 0)} to go · requests {c.requests_used ?? 0}/{c.max_requests ?? '—'} ({c.requests_remaining ?? 0} left){c.last_stop_reason ? ` · ${c.last_stop_reason}` : ''} · created {fmt(c.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/admin/discovery/${c.id}`} className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] font-bold text-ink-soft hover:border-brand">Candidates</Link>
                    <a href={`/bff/admin/discovery/campaigns/${c.id}/export`} className="rounded-md border border-line bg-white px-2.5 py-1 text-[12px] font-bold text-ink-soft hover:border-brand">Export CSV</a>
                    <CampaignControls id={c.id} status={c.status} paused={c.discovery_paused} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PER CITY + QUERIES */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-black uppercase tracking-wider text-muted">By city</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-cream/60 text-[11px] font-black uppercase tracking-wide text-muted">
                <tr><th className="px-3 py-2">City</th><th className="px-3 py-2">Cand.</th><th className="px-3 py-2">Invited</th><th className="px-3 py-2">Claims</th><th className="px-3 py-2">Apps</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {perCity.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">No data yet.</td></tr>
                ) : perCity.map(([city, v]) => (
                  <tr key={city}><td className="px-3 py-2 font-bold text-ink">{city}</td><td className="px-3 py-2">{v.candidates}</td><td className="px-3 py-2">{v.invited ?? 0}</td><td className="px-3 py-2">{v.claims}</td><td className="px-3 py-2">{v.applications}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="text-sm font-black uppercase tracking-wider text-muted">Queries producing candidates</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
            {byQuery.length === 0 ? (
              <p className="px-3 py-4 text-center text-[13px] text-muted">No data yet.</p>
            ) : (
              <ul className="divide-y divide-line text-[13px]">
                {byQuery.map(([q, n]) => (
                  <li key={q} className="flex items-center justify-between px-3 py-2"><span className="text-ink-soft">{q}</span><span className="font-bold text-ink">{n}</span></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* CITY SUPPORT */}
      <section className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted">Supported cities</h2>
        <p className="text-[12px] text-muted">Navi Mumbai is the pilot. Other cities stay inactive until you create a campaign for them.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cities.map((c) => (
            <span key={c.city} className={`rounded-full px-3 py-1 text-[12px] font-bold ${c.active ? 'bg-emerald-50 text-emerald-700' : 'border border-line bg-white text-muted'}`}>
              {c.city}{c.is_pilot ? ' · pilot' : ''}{c.active ? ' · active' : c.campaign_count ? ' · inactive' : ''}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-1">
      <span className="text-muted">{label}</span><span className="font-black text-ink">{v}</span>
    </div>
  );
}
