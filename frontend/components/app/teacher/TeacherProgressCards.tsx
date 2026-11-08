import Link from 'next/link';
import OnboardingRoadmap from '@/components/app/teacher/OnboardingRoadmap';
import { instaKycPriceLabel } from '@/lib/pricing';

// Progressive "path to going live" block for the teacher dashboard, shown AFTER
// the onboarding profile is submitted. It renders the journey roadmap plus a
// single, context-aware information card for the teacher's current step:
//   profile done → InstaKYC info + CTA → empanelment info + CTA.
// Once empanelled the journey is complete and this block hides itself.
const KYC_POINTS = [
  'Unlocks your public directory listing & verified badges',
  'Aadhaar + PAN + bank + liveness selfie — about two minutes',
  'Verifies your identity and bank details',
];

const EMPANELMENT_POINTS = [
  'Recognition by the NOSTOPS Council of Yoga Gurus',
  'Access to corporate, community & institutional programmes',
  'A verified NOSTOPS Empanelled Teacher badge — no fee',
];

function InfoCard({
  theme,
  icon,
  eyebrow,
  title,
  desc,
  points,
  href,
  cta,
  testid,
}: {
  theme: 'accent' | 'brand';
  icon: string;
  eyebrow: string;
  title: string;
  desc: string;
  points: string[];
  href: string;
  cta: string;
  testid: string;
}) {
  const ring = theme === 'accent' ? 'border-accent/30 bg-accent/5' : 'border-brand/25 bg-brand-50/50';
  const chip = theme === 'accent' ? 'bg-accent text-white' : 'bg-brand text-white';
  const ctaCls = theme === 'accent' ? 'bg-accent hover:bg-accent-600' : 'bg-brand hover:bg-brand-600';
  const dot = theme === 'accent' ? 'text-accent' : 'text-brand';
  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${ring}`} data-testid={testid}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl ${chip}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted">{eyebrow}</p>
          <h3 className="mt-0.5 text-base font-extrabold tracking-tight text-ink">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{desc}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 p-0">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-sm text-ink-soft">
            <span aria-hidden className={`mt-0.5 ${dot}`}>✓</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-5 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-white transition ${ctaCls}`}
      >
        {cta} →
      </Link>
    </section>
  );
}

export default function TeacherProgressCards({
  profileComplete,
  kycComplete,
  empanelled,
  international = false,
  withdrawn = false,
}: {
  profileComplete: boolean;
  kycComplete: boolean;
  empanelled: boolean;
  /** B4.8 — outside India: InstaKYC (and its price) does not apply. */
  international?: boolean;
  /** B4.8 — a reviewer suspended / revoked empanelment: no "apply" card. */
  withdrawn?: boolean;
}) {
  // Journey finished — the richer active-teacher dashboard takes over.
  if (profileComplete && kycComplete && empanelled) return null;

  return (
    <div className="space-y-4" data-testid="teacher-progress-cards">
      <OnboardingRoadmap flags={{ profileComplete, kycDone: kycComplete, empanelled, active: empanelled }} showNextStep={false} international={international} />

      {profileComplete && !kycComplete && international && (
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" data-testid="progress-kyc-intl">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted">Next · identity check</p>
          <h3 className="mt-0.5 text-base font-extrabold tracking-tight text-ink">Not yet available in your country</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Identity verification for teachers outside India is not yet available. There is nothing to pay and nothing you
            need to do right now.
          </p>
        </section>
      )}

      {profileComplete && !kycComplete && !international && (
        <InfoCard
          theme="accent"
          icon="🛡️"
          eyebrow="Next · verify your identity"
          title="Complete NOSTOPS InstaKYC"
          desc={`A one-time ${instaKycPriceLabel()} (incl. GST) verification. Completes your identity verification step. Teacher verification and empanelment are subject to the applicable review process.`}
          points={KYC_POINTS}
          href="/app/teacher/kyc"
          cta={`Start InstaKYC · ${instaKycPriceLabel()}`}
          testid="progress-kyc-card"
        />
      )}

      {profileComplete && kycComplete && !empanelled && !withdrawn && (
        <InfoCard
          theme="brand"
          icon="🏅"
          eyebrow="Next · get empanelled"
          title="Apply for NOSTOPS Empanelment"
          desc="Empanelment is the Council's recognition of genuine, committed teachers — your gateway to corporate and community programmes."
          points={EMPANELMENT_POINTS}
          href="/app/teacher/empanelment"
          cta="Get empanelled"
          testid="progress-empanelment-card"
        />
      )}
    </div>
  );
}
