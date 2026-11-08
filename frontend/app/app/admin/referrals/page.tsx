import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getReferralAnalytics } from '@/lib/server/admin-referrals';
import { inr } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Referrals', robots: { index: false, follow: false } };

export default async function AdminReferralsPage() {
  await requireAdminUser();
  const a = await getReferralAnalytics();
  const maxFunnel = Math.max(1, ...a.funnel.map((f) => f.count));

  const kpis = [
    { label: 'Total referrals', value: a.summary.totalReferrals },
    { label: 'Conversion', value: `${Math.round(a.summary.conversionRate * 100)}%` },
    { label: 'Pipeline value', value: `₹${inr(a.summary.totalBatchValue)}` },
    { label: 'Students reached', value: a.summary.totalStudents },
    { label: 'Active pilots', value: a.summary.activePilots },
    { label: 'Referrers', value: a.summary.uniqueReferrers },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Money &amp; Growth</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">Referrals</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">Platform-wide referral performance — how leads move from a referral through to a converted workplace booking.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-2xl font-black tabular-nums text-ink">{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-extrabold text-ink">Conversion funnel</h2>
        <div className="mt-4 space-y-2.5">
          {a.funnel.map((f) => (
            <div key={f.stage}>
              <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                <span>{f.stage}</span><span className="tabular-nums">{f.count}</span>
              </div>
              <div className="mt-1 h-2.5 w-full rounded-full bg-cream">
                <div className="h-2.5 rounded-full" style={{ width: `${Math.max(3, Math.round((f.count / maxFunnel) * 100))}%`, backgroundColor: f.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {a.monthly.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-base font-extrabold text-ink">Monthly trend</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs font-bold uppercase text-muted"><th className="py-1">Month</th><th className="py-1 text-right">Referrals</th><th className="py-1 text-right">Converted</th></tr></thead>
              <tbody>
                {a.monthly.map((m) => (
                  <tr key={m.label} className="border-t border-line"><td className="py-2 font-semibold text-ink">{m.label}</td><td className="py-2 text-right tabular-nums text-ink-soft">{m.referrals}</td><td className="py-2 text-right tabular-nums text-brand-700">{m.converted}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
