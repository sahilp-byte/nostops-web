import Link from 'next/link';
import { instaKycPriceLabel } from '@/lib/pricing';

export type VerificationFlags = { kycVerified: boolean; kycPaid: boolean; isEmpanelled: boolean };

export function verificationSteps(f: VerificationFlags, t: (k: string) => string = (k) => k, empanelmentDetail?: string) {
  return [
    { key: 'kyc', label: t('Complete InstaKYC'), detail: t('Aadhaar OKYC · PAN · Bank verification'), done: f.kycVerified, href: '/app/teacher/kyc', cta: t('Start InstaKYC') },
    { key: 'pay', label: t('One-time verification payment'), detail: `${instaKycPriceLabel()} ${t('(incl. GST) — part of InstaKYC')}`, done: f.kycPaid, href: '/app/teacher/kyc', cta: t('Pay & verify') },
    { key: 'emp', label: t('Get empanelled'), detail: empanelmentDetail || t('Free-track (merit) or Fast-track Council review'), done: f.isEmpanelled, href: '/app/teacher/empanelment', cta: t('View empanelment') },
  ];
}

// Shared 3-step "get verified" checklist. Used on the teacher home (progress
// card) and the locked-feature screen. Purely presentational.
export default function VerificationChecklist({ flags, title, empanelmentDetail, t = (k) => k }: { flags: VerificationFlags; title?: string; empanelmentDetail?: string; t?: (k: string) => string }) {
  const steps = verificationSteps(flags, t, empanelmentDetail);
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  const tone = pct >= 100 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:p-6" data-testid="verification-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-ink">{title ?? t('Get verified')}</h2>
          <p className="mt-0.5 text-sm text-muted">{done}/{steps.length} {t('steps complete')} · {t('unlocks your earning tools')}</p>
        </div>
        <span className="text-2xl font-black tabular-nums" style={{ color: tone }} data-testid="verification-pct">{pct}%</span>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: tone }} />
      </div>

      <ol className="mt-4 space-y-3 p-0">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black text-white"
              style={{ backgroundColor: s.done ? '#0D9488' : '#CBD5E1' }}
            >
              {s.done ? '✓' : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-ink">{s.label}</span>
              <span className="block text-xs text-muted">{s.detail}</span>
            </span>
            {s.done ? (
              <span className="shrink-0 text-xs font-bold text-brand-700">{t('Done')}</span>
            ) : (
              <Link href={s.href} className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
