import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { checkClaimLink } from '@/lib/server/teacher-claim';
import { getSessionToken } from '@/lib/server/session';
import ClaimProgress from '@/components/claim/ClaimProgress';
import ClaimValid from '@/components/claim/ClaimValid';
import type { ClaimLinkState } from '@/lib/teacher-claim';

// Stage 5A — secure claim-page SHELL. Opening or refreshing this page only performs the non-consuming
// GET check; claim / link / OTP run only from explicit button presses (Stage 5C, ClaimJourney → BFF POST).
// Lives outside the (public) layout: no site chrome, no attribution capture. Analytics and Ask Guru
// skip /teachers/claim/*; next.config sets no-store, no-referrer and noindex headers for this route.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'Claim your teacher profile · NOSTOPS',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

type Props = { params: Promise<{ token: string }> };

const COPY: Record<ClaimLinkState, { title: string; body: string; done: number }> = {
  valid: {
    title: 'Your invitation is valid',
    body: 'Thank you for opening your invitation. The secure steps to claim your profile will appear here soon. Nothing has been changed yet, and you don’t need to do anything right now. Please keep this link private.',
    done: 1,
  },
  invalid: {
    title: 'This invitation link can’t be used',
    body: 'The link may be incomplete, expired or already used. Please contact NOSTOPS support and we’ll help you get a new invitation.',
    done: 0,
  },
  unavailable: {
    title: 'We couldn’t check your invitation just now',
    body: 'Our service is temporarily unavailable. Your invitation has not been used. Please try again in a few minutes.',
    done: 0,
  },
};

export default async function TeacherClaimPage({ params }: Props) {
  const { token } = await params;
  const { state, profile } = await checkClaimLink(token);
  const signedIn = !!(await getSessionToken());
  const c = COPY[state];
  return (
    <main className="min-h-screen bg-gradient-to-b from-cream via-[#FFF7EC] to-[#FDEFE3] px-4 py-8 sm:py-14" data-testid="claim-page" data-state={state}>
      <div className="mx-auto max-w-xl">
        <div className="flex justify-center">
          <Image src="/brand/nostops-logo.png" alt="NOSTOPS" width={150} height={44} priority className="h-10 w-auto" />
        </div>
        <section className="mt-8 rounded-3xl border border-line bg-white/90 p-6 shadow-sm sm:p-10">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">Teacher profile invitation</p>
          <h1 className="mt-3 text-center font-['SP_Serif',Georgia,serif] text-[28px] leading-tight text-brand-700 sm:text-[34px]">
            Your Yoga Journey Continues with NOSTOPS
          </h1>
          <p className="mt-4 text-center font-['SP_Sans',system-ui,sans-serif] text-[15px] leading-relaxed text-ink-soft">
            Your existing teaching profile is ready to be claimed on NOSTOPS. Complete the secure verification process to access your
            professional profile and continue participating in the yoga teaching community.
          </p>
          {state === 'valid' && profile ? (
            <ClaimValid token={token} profile={profile} signedIn={signedIn} />
          ) : (<>
          <ClaimProgress done={c.done} />
          <div
            className={`mt-8 rounded-2xl p-5 font-['SP_Sans',system-ui,sans-serif] ${state === 'valid' ? 'bg-brand-50' : 'bg-[#FFF4E5]'}`}
            role={state === 'valid' ? 'status' : 'alert'}
            data-testid={`claim-state-${state}`}
          >
            <h2 className="font-['SP_Serif',Georgia,serif] text-lg text-brand-700">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{c.body}</p>
            {state === 'unavailable' ? (
              <a href="" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white" data-testid="claim-retry">
                Try again
              </a>
            ) : null}
            {state === 'invalid' ? (
              <Link href="/support" prefetch={false} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white" data-testid="claim-support">
                Contact NOSTOPS support
              </Link>
            ) : null}
          </div>
          </>)}
        </section>
        <p className="mt-6 text-center text-xs text-muted">This page is private to you. It is not listed in search engines.</p>
      </div>
    </main>
  );
}
