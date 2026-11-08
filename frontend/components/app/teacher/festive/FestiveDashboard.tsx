import Link from 'next/link';
import Image from 'next/image';
import { kalam } from '@/components/home/fonts';
import FestiveClaimButton from '@/components/app/teacher/festive/FestiveClaimButton';
import { kycStageLabel, type FestiveStatus, type FestiveView } from '@/lib/festive-view';

// Teacher dashboard — Festive Complimentary InstaKYC block (banner, profile ring, offer panel,
// "Next steps to reach 80%", why-verify). Every number and state comes from the backend status;
// `items` are the same profile checklist items the backend score was computed from.
export type ChecklistItem = { key: string; label: string; done: boolean; href: string };

const Check = ({ on = true }: { on?: boolean }) => (
  <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 ${on ? 'text-[#2E9E6A]' : 'text-[#C9D3D1]'}`} fill="currentColor" aria-hidden="true">
    {on ? (
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
    ) : (
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    )}
  </svg>
);

const OrangeTick = () => (
  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#F07A1A] text-[11px] font-black text-white" aria-hidden="true">✓</span>
);

function Gift() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14 shrink-0" aria-hidden="true">
      <rect x="6" y="18" width="36" height="26" rx="3" fill="#F07A1A" />
      <rect x="3" y="12" width="42" height="9" rx="2" fill="#F5A04A" />
      <rect x="21" y="12" width="6" height="32" fill="#fff" />
      <path d="M24 12c-4-8-13-8-12-2 1 4 8 2 12 2zm0 0c4-8 13-8 12-2-1 4-8 2-12 2z" fill="#F07A1A" />
    </svg>
  );
}

function Ring({ pct, min }: { pct: number; min: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const reached = p >= min;
  return (
    <svg viewBox="0 0 110 110" className="h-28 w-28 shrink-0" role="img" aria-label={`Profile ${Math.round(p)}% complete`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="#E6EFED" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={reached ? '#0F5E5A' : '#F07A1A'} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 55 55)" />
      {/* 80 % marker */}
      <line x1="55" y1="4" x2="55" y2="14" stroke="#0E3D3B" strokeWidth="2" transform={`rotate(${(min / 100) * 360} 55 55)`} />
      <text x="55" y="61" textAnchor="middle" className="fill-[#0E3D3B]" style={{ fontSize: 24, fontWeight: 900 }}>{Math.round(p)}%</text>
    </svg>
  );
}

const OFFER_POINTS = ['No KYC fee', 'For eligible Indian yoga teachers', 'All teacher levels', 'At least 80% profile completion', 'KYC verification continues as usual'];
const WHY = [
  'Higher visibility to students and organisations',
  'Build trust and credibility',
  'More opportunities for classes, programmes and retreats',
  'Be part of a trusted national yoga community',
];

function OfferAction({ status, view }: { status: FestiveStatus; view: FestiveView }) {
  const btn = 'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-black shadow-md transition';
  switch (view.mode) {
    case 'complete_profile':
      return <Link href="/app/teacher/profile/edit" className={`${btn} bg-[#F07A1A] text-white hover:bg-[#DD6A0E]`} data-testid="festive-action-complete-profile">Complete Your Profile</Link>;
    case 'upcoming':
      return (
        <div>
          <span role="button" aria-disabled="true" className={`${btn} cursor-not-allowed bg-[#F07A1A] text-white opacity-60`} data-testid="festive-action-upcoming">Claim Your Free KYC</span>
          <p className="mt-2 text-sm font-semibold text-[#0F5E5A]" role="status">You qualify on profile — claiming opens on 1 November 2026.</p>
        </div>
      );
    case 'claim':
      return <FestiveClaimButton testid="festive-action-claim" />;
    case 'applied':
      return (
        <div data-testid="festive-action-applied">
          <p className="text-lg font-black text-[#0F5E5A]">✓ Complimentary KYC Applied</p>
          <p className="mt-1 text-sm text-[#3E5553]">Your festive InstaKYC fee waiver has been applied. Continue with the normal KYC verification process.</p>
          <Link href="/app/teacher/kyc" className={`${btn} mt-3 bg-[#0F5E5A] text-white hover:bg-[#0B4A47]`}>Continue KYC verification</Link>
        </div>
      );
    case 'in_review':
    case 'rejected':
      return (
        <div data-testid="festive-action-status">
          <p className="text-sm text-[#3E5553]">Fee waived · KYC status</p>
          <p className="text-lg font-black text-[#0E3D3B]">{kycStageLabel(status.kyc_stage)}</p>
          <Link href="/app/teacher/kyc" className={`${btn} mt-3 border-2 border-[#0F5E5A] bg-white text-[#0E3D3B] shadow-none hover:bg-[#EEF6F4]`}>
            {view.mode === 'rejected' ? 'Correct your KYC' : 'View KYC status'}
          </Link>
        </div>
      );
    case 'completed':
      return <p className="text-lg font-black text-[#0F5E5A]" data-testid="festive-action-completed">✓ KYC Completed</p>;
    default:
      return null;
  }
}

export default function FestiveDashboard({ status, view, items }: { status: FestiveStatus; view: FestiveView; items: ChecklistItem[] }) {
  if (view.mode === 'hidden') return null;
  if (view.mode === 'ended') {
    return (
      <section className="rounded-2xl border border-[#F3D9C4] bg-[#FFF8F0] p-5 text-sm text-[#3E5553]" data-testid="festive-ended">
        <p className="font-black text-[#0E3D3B]">The festive complimentary InstaKYC campaign has ended.</p>
        <p className="mt-1">Standard InstaKYC pricing{status.standard_fee_inr != null ? ` (₹${status.standard_fee_inr})` : ''} applies. <Link href="/app/teacher/kyc" className="font-bold text-[#0F5E5A] underline">Go to KYC</Link></p>
      </section>
    );
  }
  if (view.mode === 'completed') {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-[#CFE6DF] bg-[#F1F8F6] p-5" data-testid="festive-completed">
        <Check />
        <p className="text-sm font-bold text-[#0E3D3B]">KYC Completed{status.claim ? ' — your festive ₹0 InstaKYC waiver was used.' : '.'}</p>
      </section>
    );
  }
  const pct = status.profile_percent;
  const min = status.min_profile_percent;
  const pending = items.filter((i) => !i.done);

  return (
    <div id="festive-kyc" className="scroll-mt-24 space-y-5" data-testid="festive-dashboard" data-mode={view.mode}>
      {view.showBanner && (
        <section className="relative overflow-hidden rounded-3xl border border-[#F3E3CC] bg-gradient-to-r from-[#FFF7EC] via-[#FFFAF3] to-[#FFF1E2]" data-testid="festive-banner">
          <div className="absolute inset-y-0 right-0 hidden w-[38%] sm:block">
            <Image src="/brand/home/hero.jpg" alt="" fill sizes="320px" className="object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#FFF7EC] via-[#FFF7EC]/30 to-transparent" />
          </div>
          <div className="relative p-6 sm:max-w-[66%] sm:p-8">
            <p className="text-sm font-black tracking-tight text-[#0E3D3B] sm:text-base">
              NOSTOPS <span className={`${kalam.className} text-2xl text-[#F07A1A] sm:text-3xl`}>Festive Season Celebration!</span>
            </p>
            <h2 className="mt-1 text-3xl font-black leading-tight tracking-tight text-[#0E3D3B] sm:text-4xl">Your InstaKYC is on us!</h2>
            <p className="mt-2 text-[15px] text-[#3E5553] sm:text-base">
              Complete at least {min}% of your yoga teacher profile and get your InstaKYC absolutely FREE.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm font-semibold text-[#24474A] sm:flex-row sm:flex-wrap sm:gap-x-5">
              <li className="flex items-center gap-2"><OrangeTick />For all teacher levels</li>
              <li className="flex items-center gap-2"><OrangeTick />Available to eligible Indian yoga teachers</li>
              <li className="flex items-center gap-2"><OrangeTick />Offer valid from 1 Nov – 31 Dec 2026</li>
            </ul>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#EDE6DA] bg-white p-6" data-testid="festive-profile">
          <h3 className="text-lg font-black text-[#0E3D3B]">Your Profile Completion</h3>
          <div className="mt-4 flex items-center gap-5">
            <Ring pct={pct} min={min} />
            <div>
              <p className="font-black text-[#0E3D3B]">{pct >= 100 ? 'Your profile is complete!' : pct >= min ? `Great — you’ve reached ${min}%!` : 'You’re doing great!'}</p>
              <p className="mt-1 text-sm text-[#3E5553]">
                {pct >= 100 ? 'Seekers and organisations can find and trust you.' : pct >= min ? 'Keep going to 100% so seekers and organisations can find and trust you.' : `Complete ${min}% of your profile to unlock complimentary InstaKYC.`}
              </p>
              {pending.length > 0 && (
                <a href="#festive-next-steps" className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-[#0F5E5A] hover:underline">View pending sections →</a>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#F3D9C4] bg-gradient-to-br from-[#FFF6EC] to-white p-6" data-testid="festive-offer">
          <div className="flex items-center gap-4">
            <Gift />
            <div>
              <p className="text-2xl font-black text-[#0E3D3B]">FREE InstaKYC</p>
              <p className="text-sm font-bold text-[#3E5553]">1 Nov – 31 Dec 2026</p>
            </div>
          </div>
          <ul className="mt-4 grid gap-1.5 text-sm text-[#24474A] sm:grid-cols-2">
            {OFFER_POINTS.map((p) => <li key={p} className="flex items-center gap-2"><Check />{p}</li>)}
          </ul>
          <div className="mt-5"><OfferAction status={status} view={view} /></div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section id="festive-next-steps" className="scroll-mt-24 rounded-3xl border border-[#EDE6DA] bg-white p-6" data-testid="festive-checklist">
          <h3 className="text-lg font-black text-[#0E3D3B]">{pct >= min ? 'Your profile sections' : `Next Steps to Reach ${min}%`}</h3>
          <ul className="mt-3 divide-y divide-[#F1ECE3]">
            {items.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3 py-2.5" data-testid={`festive-item-${i.key}`} data-done={i.done}>
                <span className="flex items-center gap-2.5 text-sm text-[#24474A]"><Check on={i.done} />{i.label}</span>
                {i.done ? (
                  <span className="text-xs font-bold text-[#2E9E6A]">Done</span>
                ) : (
                  <Link href={i.href} className="inline-flex min-h-[36px] items-center rounded-lg bg-[#FFF1E2] px-3 text-xs font-black text-[#B4530A] hover:bg-[#FDE7D2]">Add →</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-[#EDE6DA] bg-white p-6" data-testid="festive-why">
          <h3 className="text-lg font-black text-[#0E3D3B]">Why Get Verified on NOSTOPS?</h3>
          <ul className="mt-3 space-y-3">
            {WHY.map((w) => <li key={w} className="flex items-center gap-3 text-sm text-[#24474A]"><OrangeTick />{w}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
