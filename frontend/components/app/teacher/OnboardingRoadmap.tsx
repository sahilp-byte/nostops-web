import Link from 'next/link';
import { instaKycPriceLabel } from '@/lib/pricing';

// High-level 5-stage journey map for the teacher dashboard:
// Registration → Profile → KYC → Empanelment → Active. States are derived from
// real backend flags only. The "current" stage is the first incomplete one in
// canonical order, with a clear next-step CTA. Purely presentational.
export type RoadmapFlags = {
  profileComplete: boolean;
  kycDone: boolean; // kyc identity verified AND paid
  empanelled: boolean;
  active: boolean; // fully verified + live/publicly visible
};

type Stage = { key: string; label: string; short: string; done: boolean; href?: string; cta?: string };

export default function OnboardingRoadmap({ flags, t = (k) => k, showNextStep = true, international = false }: { flags: RoadmapFlags; t?: (k: string) => string; showNextStep?: boolean; international?: boolean }) {
  // B4.8 — outside India InstaKYC does not apply and no price is shown.
  const kycStage: Stage = international
    ? { key: 'kyc', label: t('Identity check'), short: t('ID'), done: flags.kycDone, href: '/app/teacher/get-verified', cta: t('Identity check — not yet available in your country') }
    : { key: 'kyc', label: t('InstaKYC'), short: t('KYC'), done: flags.kycDone, href: '/app/teacher/kyc', cta: `${t('Complete InstaKYC')} · ${instaKycPriceLabel()}` };
  const stages: Stage[] = [
    { key: 'reg', label: t('Registration'), short: t('Register'), done: true },
    { key: 'profile', label: t('Profile'), short: t('Profile'), done: flags.profileComplete, href: '/app/teacher/profile/edit', cta: t('Complete your profile') },
    kycStage,
    { key: 'emp', label: t('Empanelment'), short: t('Empanel'), done: flags.empanelled, href: '/app/teacher/empanelment', cta: t('Get empanelled') },
    { key: 'active', label: t('Active Teacher'), short: t('Active'), done: flags.active, cta: t('Active teacher') },
  ];
  const currentIndex = stages.findIndex((s) => !s.done);
  const allDone = currentIndex === -1;
  const current = allDone ? null : stages[currentIndex];
  const doneCount = stages.filter((s) => s.done).length;

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="onboarding-roadmap">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold tracking-tight text-ink">{t('Your journey to going live')}</h2>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">{doneCount}/{stages.length}</span>
      </div>

      {/* Stepper */}
      <ol className="mt-4 flex items-start justify-between gap-1 p-0" aria-label="Onboarding progress">
        {stages.map((s, i) => {
          const isCurrent = i === currentIndex;
          const bg = s.done ? '#0D9488' : isCurrent ? '#F59E0B' : '#CBD5E1';
          const connectorDone = i < currentIndex || allDone;
          return (
            <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center" aria-current={isCurrent ? 'step' : undefined}>
              <div className="flex w-full items-center">
                <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : ''}`} style={{ backgroundColor: connectorDone ? '#0D9488' : '#E2E8F0' }} />
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black text-white ring-4"
                  style={{ backgroundColor: bg, ['--tw-ring-color' as any]: isCurrent ? '#F59E0B22' : 'transparent' }}
                >
                  {s.done ? '✓' : i + 1}
                </span>
                <span className={`h-0.5 flex-1 ${i === stages.length - 1 ? 'opacity-0' : ''}`} style={{ backgroundColor: i < currentIndex || allDone ? '#0D9488' : '#E2E8F0' }} />
              </div>
              <span className={`mt-1.5 text-center text-[10px] font-bold leading-tight sm:text-xs ${s.done ? 'text-brand-700' : isCurrent ? 'text-amber-700' : 'text-muted'}`}>
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Next step / celebration */}
      {showNextStep && (allDone ? (
        <p className="mt-4 rounded-xl bg-brand-50/70 px-4 py-3 text-sm font-bold text-brand-700">
          {t("🎉 You're an active NOSTOPS teacher — visible to seekers and open for bookings.")}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-ink">
            <span className="text-muted">{t('Next step')} · </span>{current?.cta}
          </p>
          {current?.href && (
            <Link href={current.href} className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="roadmap-next-cta">
              {t('Continue →')}
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
