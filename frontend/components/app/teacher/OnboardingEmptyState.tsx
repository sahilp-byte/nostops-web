import Link from 'next/link';

// Gentle "let's get you set up" state shown on the teacher dashboard and the
// Edit Profile page (matches the mobile reference). A single, friendly CTA that
// starts the onboarding wizard — no hard redirect, so the teacher stays in control.
// Two tones:
//  • CLAIMED  — the teacher arrived by claiming a public listing (we greet them by
//    listing name so they know the claim worked and they're continuing that journey).
//  • ORGANIC  — a first-time teacher who signed up directly (SEO / referral / organic);
//    a warm cooperative welcome rather than a cold "not onboarded yet".
// Both show the same quick checklist of what they'll set up, so there are no surprises.

const CHECKLIST: { icon: string; label: string }[] = [
  { icon: '📿', label: 'Your parampara (lineage) & guru' },
  { icon: '🎯', label: 'The yoga styles & specialisations you teach' },
  { icon: '✍️', label: 'A short bio in your own voice' },
  { icon: '🌐', label: 'Your public teacher page & handle' },
];

export default function OnboardingEmptyState({
  claimedName,
  claimedCity,
}: {
  claimedName?: string;
  claimedCity?: string;
} = {}) {
  const claimed = !!claimedName;
  const place = [claimedName, claimedCity].filter(Boolean).join(' · ');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-14 text-center" data-testid="onboarding-empty-state">
      <span aria-hidden className="grid h-20 w-20 place-items-center rounded-full bg-accent/10 text-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      </span>

      {claimed && (
        <span className="mt-5 inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800" data-testid="claimed-badge">
          Profile claimed · in progress
        </span>
      )}

      <h2 className={`${claimed ? 'mt-3' : 'mt-5'} text-xl font-black tracking-tight text-ink`}>
        {claimed ? 'Finish setting up your profile' : 'Welcome to NOSTOPS 🙏'}
      </h2>

      {claimed && place && <p className="mt-1 text-sm font-bold text-ink-soft" data-testid="claimed-listing">{place}</p>}

      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {claimed
          ? 'Your listing is claimed. Just a few quick steps to go live — it’s free, and you can refine it anytime.'
          : 'Let’s set up your teacher profile. A few quick steps and you’re live — it’s free, and you can refine it anytime.'}
      </p>

      {/* Quick checklist — what they'll add, so there are no surprises */}
      <div className="mt-6 w-full rounded-2xl border border-line bg-white p-5 text-left" data-testid="onboarding-checklist">
        <p className="text-xs font-black uppercase tracking-wide text-muted">Here’s what you’ll add</p>
        <ul className="mt-3 space-y-2.5">
          {CHECKLIST.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-sm">{item.icon}</span>
              <span className="text-sm font-semibold leading-6 text-ink">{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-xs font-semibold text-muted">
          <span aria-hidden>⏱️</span> About 3–4 minutes · free · edit anytime
        </p>
      </div>

      <Link
        href="/app/teacher/onboarding"
        data-testid="start-onboarding-cta"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-accent px-8 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-accent-600"
      >
        {claimed ? 'Complete my profile' : 'Start Onboarding'}
      </Link>
    </div>
  );
}
