import type { Metadata } from 'next';
import { requireAdminUser } from '@/lib/server/admin-guard';
import { festiveFetch } from '@/lib/server/festive-kyc';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Festive KYC Claims', robots: { index: false, follow: false } };

// Read-only: every Festive Complimentary InstaKYC claim (backend/festive_kyc.py GET /admin/claims),
// its KYC stage, stage history and the campaign audit trail. No phone numbers or secrets are stored.
type Hist = { stage: string; at: string | null; source: string };
type Claim = {
  claim_id: string; user_id: string; teacher_id: string | null; teacher_level: string | null; claimed_at: string | null;
  profile_percent_at_claim: number | null; original_fee_inr: number | null; promotional_fee_inr: number;
  waiver_status: string; kyc_stage: string | null; main_app_fee_settled: boolean; status_history: Hist[];
};
type Ev = { event: string; user_id?: string; teacher_id?: string | null; at: string | null; outcome?: string; reasons?: string[]; to_stage?: string; source?: string };
type Data = { name: string; starts_at: string; ends_at: string; active: boolean; claims: Claim[]; events: Ev[]; counts: Record<string, number> };

const STAGE: Record<string, string> = { not_started: 'Not started', submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', rejected: 'Needs correction' };
const LEVEL: Record<string, string> = { L1: 'L1 · Yoga Shikshak', L2: 'L2 · Yoga Pracharak', L3: 'L3 · Yoga Guru' };
const EVENT: Record<string, string> = {
  claim_applied: 'Claim applied', claim_rejected: 'Claim refused', claim_duplicate: 'Repeat claim', payment_blocked: 'Payment blocked (₹0)', kyc_status_changed: 'KYC stage changed',
};
const dt = (v: string | null | undefined) =>
  v ? `${new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} IST` : '—';

async function load(): Promise<Data | null> {
  const user = await requireAdminUser();
  try {
    const r = await festiveFetch('/admin/claims', user);
    return r.ok ? ((await r.json()) as Data) : null;
  } catch {
    return null;
  }
}

export default async function FestiveKycAdminPage() {
  const d = await load();
  if (!d) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-black tracking-tight text-ink">Festive KYC Claims</h1>
        <p className="mt-4 rounded-2xl border border-line bg-white p-6 text-sm text-ink-soft" data-testid="fk-unavailable">The claims list couldn&apos;t be loaded right now. Please try again shortly.</p>
      </div>
    );
  }
  const kpis = [
    { label: 'Claims applied', value: d.claims.length },
    { label: 'KYC approved', value: d.claims.filter((c) => c.kyc_stage === 'approved').length },
    { label: 'Refused attempts', value: d.counts.claim_rejected ?? 0 },
    { label: 'Payments blocked', value: d.counts.payment_blocked ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="fk-admin">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-ink">Festive KYC Claims</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {d.name} · {dt(d.starts_at)} – {dt(d.ends_at)} ·{' '}
          <span className={`font-bold ${d.active ? 'text-brand-700' : 'text-muted'}`}>{d.active ? 'Active' : 'Not active'}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-black text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white" data-testid="fk-claims">
        <h2 className="border-b border-line px-5 py-3 text-base font-black text-ink">Claims ({d.claims.length})</h2>
        {d.claims.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted" data-testid="fk-empty">No claims yet. Claiming opens when the campaign starts.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.claims.map((c) => (
              <li key={c.claim_id} className="px-5 py-4" data-testid={`fk-claim-${c.claim_id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-bold text-ink">{c.claim_id}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.kyc_stage === 'approved' ? 'bg-brand-50 text-brand-700' : c.kyc_stage === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-cream text-ink-soft'}`}>
                    KYC: {STAGE[c.kyc_stage || ''] || c.kyc_stage || '—'}
                  </span>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-ink-soft sm:grid-cols-3">
                  <div><dt className="inline text-muted">Teacher: </dt><dd className="inline">{c.teacher_id || '—'} ({LEVEL[c.teacher_level || ''] || c.teacher_level || '—'})</dd></div>
                  <div><dt className="inline text-muted">Claimed: </dt><dd className="inline">{dt(c.claimed_at)}</dd></div>
                  <div><dt className="inline text-muted">Profile at claim: </dt><dd className="inline">{c.profile_percent_at_claim ?? '—'}%</dd></div>
                  <div><dt className="inline text-muted">Fee: </dt><dd className="inline">₹{c.promotional_fee_inr} (standard ₹{c.original_fee_inr ?? '—'}) · waiver {c.waiver_status}</dd></div>
                  <div><dt className="inline text-muted">Main app fee settled: </dt><dd className="inline">{c.main_app_fee_settled ? 'Yes' : 'Not yet'}</dd></div>
                  <div><dt className="inline text-muted">Account: </dt><dd className="inline">{c.user_id}</dd></div>
                </dl>
                <ol className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="KYC stage history">
                  {c.status_history.map((h, i) => (
                    <li key={i} className="rounded-lg border border-line bg-cream/60 px-2.5 py-1">
                      <span className="font-bold text-ink">{STAGE[h.stage] || h.stage}</span> · {dt(h.at)} · {h.source}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white" data-testid="fk-events">
        <h2 className="border-b border-line px-5 py-3 text-base font-black text-ink">Audit trail (latest {d.events.length})</h2>
        {d.events.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No campaign activity yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {d.events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
                <span>
                  <span className="font-bold text-ink">{EVENT[e.event] || e.event}</span>
                  <span className="text-ink-soft">
                    {e.teacher_id ? ` · ${e.teacher_id}` : e.user_id ? ` · ${e.user_id}` : ''}
                    {e.reasons?.length ? ` · ${e.reasons.join(', ')}` : ''}
                    {e.to_stage ? ` · → ${STAGE[e.to_stage] || e.to_stage}${e.source ? ` (${e.source})` : ''}` : ''}
                  </span>
                </span>
                <span className="text-xs text-muted">{dt(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
