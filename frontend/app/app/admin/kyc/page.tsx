import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { getKycQueue } from '@/lib/server/admin-kyc';
import KycQueue from '@/components/app/admin/KycQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · KYC Reviews', robots: { index: false, follow: false } };

export default async function AdminKycPage() {
  await requireAdminUser();
  const data = await getKycQueue();

  const kpis = [
    { label: 'Pending reviews', value: data.counts.pending, tone: data.counts.pending > 0 ? 'text-accent-600' : 'text-ink' },
    { label: 'Approval rate', value: `${data.approvalRatePct}%`, tone: 'text-brand-700' },
    { label: 'Avg processing', value: `${data.avgProcessingHours}h`, tone: 'text-ink' },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Admin · Operations</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-ink">KYC Reviews</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Review each teacher&apos;s submitted identity and credentials, then approve to verify them or reject with a
        reason. Approving unlocks their earning tools; rejecting returns them to complete their KYC.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className={`text-2xl font-black tabular-nums ${k.tone}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <KycQueue applicants={data.applicants} />
      </div>
    </div>
  );
}
