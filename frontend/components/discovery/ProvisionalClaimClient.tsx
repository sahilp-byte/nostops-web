'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendBff } from '@/lib/auth-client';
import NetworkVideo from '@/components/discovery/NetworkVideo';
import CoordinatorsNearYou from '@/components/discovery/CoordinatorsNearYou';
import type { ProvisionalProfile } from '@/lib/server/discovery';
import type { CityCoordinator } from '@/lib/server/city-coordinator';

// Teacher-facing provisional profile + FREE claim. Discovery data (name /
// locality / city, sourced from Google Places) is shown ONLY as a factual
// starting point and is clearly separated from the professional profile the
// teacher will build after claiming — we never auto-overwrite teacher input.
// The page answers "Why should I claim this?" BEFORE asking the teacher to claim.

// What a teacher can build after claiming (photo & biography intentionally excluded here).
const WHAT_YOU_CAN_BUILD = [
  'Parampara / Yoga Tradition', 'Qualifications', 'Teaching Experience', 'Specialisations',
  'Languages', 'Teaching Locations', 'Individual Teaching', 'Group Classes', 'Corporate Yoga',
  'Retreats', 'Workshops', 'Online Teaching', 'Teaching Philosophy',
];

// Who can discover a teacher — the four key audiences (always visible) + others.
const AUDIENCES = [
  { t: 'Yoga Seekers', d: 'People looking for yoga teachers, classes, workshops and other yoga-related learning opportunities.' },
  { t: 'Companies', d: 'Companies looking for yoga programmes and teachers for their employees, teams and workplace initiatives.' },
  { t: 'Educational Institutions', d: 'Schools, colleges, universities and other educational institutions that may require yoga teaching, programmes, workshops or ongoing engagements.' },
  { t: 'Start-up Networking Groups', d: 'Start-up communities, founder networks, entrepreneur groups and networking organisations that may seek yoga programmes, workshops or wellbeing sessions for their communities.' },
];
const OTHER_AUDIENCES = ['Retreat organisers', 'Venues', 'Workshop organisers', 'Other organisations seeking yoga teachers', 'NOSTOPS teacher-network opportunities'];

// The teaching ENGAGEMENTS these audiences can mean (distinct from the audiences above).
const KEY_OPPORTUNITIES = [
  { t: 'Corporate Yoga', d: 'Yoga programmes for companies, employees and workplace teams.' },
  { t: 'Yoga for Educational Institutions', d: 'Yoga programmes, classes, workshops and ongoing teaching for schools, colleges, universities and other educational institutions.' },
  { t: 'Yoga for Start-up Networking Groups', d: 'Yoga sessions, workshops and programmes for start-up communities, founders, entrepreneurs and networking groups.' },
];
const OTHER_OPPORTUNITIES = ['Yoga Classes', 'Workshops', 'Retreats', 'Venue-based programmes', 'Online teaching', 'Community programmes', 'Other teaching engagements'];

export default function ProvisionalClaimClient({
  profile,
  signedIn,
  claimPath,
  loginHref,
  onboardingHref,
  coordinator,
  cityLabel,
}: {
  profile: ProvisionalProfile;
  signedIn: boolean;
  claimPath: string;
  loginHref: string;
  onboardingHref: string;
  coordinator?: CityCoordinator | null;
  cityLabel?: string;
}) {
  const [state, setState] = useState(profile.claim_state);
  const [isClaimer, setIsClaimer] = useState(profile.is_claimer);
  const [authorised, setAuthorised] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function claim() {
    setErr(null);
    if (!authorised) { setErr('Please confirm you are this teacher or an authorised representative.'); return; }
    setBusy(true);
    const r = await sendBff(claimPath, 'POST', { is_authorised: true });
    setBusy(false);
    if (!r.ok) { setErr(r.data?.error || 'Could not claim this profile.'); if (r.status === 409) setState('CLAIMED'); return; }
    setState('CLAIMED');
    setIsClaimer(true);
  }

  const place = [profile.locality, profile.city].filter(Boolean).join(', ');

  // ── AFTER CLAIM (this account) — CLAIMED, PROFILE IN PROGRESS ──────────────
  if (state === 'CLAIMED' && isClaimer) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center" data-testid="claim-inprogress-owner">
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">Profile claimed · in progress</span>
          <h1 className="mt-3 text-2xl font-black text-ink">{profile.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">{place}</p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
            This profile is now yours. Here&apos;s what happens next on your way to a full, verified NOSTOPS profile.
          </p>

          {/* What happens next */}
          <ol className="mx-auto mt-5 max-w-md space-y-3 text-left" data-testid="whats-next">
            {[
              { t: 'Complete your professional profile', d: 'Add your tradition, qualifications, experience, specialisations, languages and teaching locations.' },
              { t: 'Verify your identity', d: 'A quick verification confirms you are a genuine teacher.' },
              { t: 'Council empanelment', d: 'The NOSTOPS Council of Gurus reviews and empanels your profile.' },
              { t: 'Your profile goes live', d: 'Your page graduates to a full, verified NOSTOPS profile that seekers, studios, retreats and organisations can discover.' },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 text-[13px] font-black text-amber-800">{i + 1}</span>
                <div>
                  <p className="text-sm font-black text-ink">{s.t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Full-page navigation (not client-side) so the server re-reads the
              session and picks up the freshly-granted `teacher` role. */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.assign(onboardingHref)}
              data-testid="claim-complete-cta"
              className="inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-white hover:bg-brand-600"
            >
              Complete my profile →
            </button>
            <p className="text-[12px] text-muted">
              We&apos;re activating your teacher tools. If they don&apos;t appear,{' '}
              <a href={loginHref} className="font-bold text-brand-700 underline">sign out and sign back in</a>.
            </p>
          </div>
        </div>
        <Attribution />
      </main>
    );
  }

  // ── CLAIMED BY SOMEONE ELSE — CLAIMED, PROFILE IN PROGRESS (public) ────────
  if (state === 'CLAIMED') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-line bg-white p-6 text-center" data-testid="claim-inprogress-public">
          <span className="inline-block rounded-full bg-cream px-3 py-1 text-[11px] font-black uppercase tracking-wide text-muted">Claimed · profile in progress</span>
          <h1 className="mt-3 text-xl font-black text-ink">{profile.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">{place}</p>
          <p className="mx-auto mt-4 max-w-md text-sm text-ink-soft">This teacher has claimed their NOSTOPS profile and is completing it. Check back soon to see their full verified profile.</p>
          <Link href="/teachers" className="mt-4 inline-block text-sm font-bold text-brand-700 underline">Explore NOSTOPS teachers →</Link>
        </div>
        <Attribution />
      </main>
    );
  }

  // ── UNCLAIMED PROVISIONAL — two-column teacher journey ─────────────────────
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start">
        {/* HERO — shown first; left column (row 1) on desktop */}
        <section className="rounded-2xl border border-line bg-cream/40 p-6 lg:col-start-1 lg:row-start-1" data-testid="provisional-hero">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-white text-lg font-black text-muted">
                {(profile.name || 'Y').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted">We found you</p>
                <h1 className="mt-0.5 truncate text-2xl font-black leading-tight text-ink">{profile.name}</h1>
                <p className="text-sm text-ink-soft">{place || profile.city}</p>
              </div>
            </div>
            <span className="mt-4 inline-block rounded-full border border-line bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-muted">
              Unclaimed · from a public listing
            </span>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              NOSTOPS is building a teacher-first yoga network that helps genuine yoga teachers become easier to
              discover. While mapping the yoga community{profile.city ? ` in ${profile.city}` : ''}, we found this public listing for your
              teaching practice and created a provisional profile so that the teaching already being offered in your
              community can be represented and discovered.
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
              This profile has not yet been claimed by the teacher.
            </p>
        </section>

        {/* SUPPORTING CONTENT — right column (spans both rows) on desktop; directly under the hero on mobile */}
        <div className="space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
          <NetworkVideo
            heading="Why Join the NOSTOPS Network?"
            caption="Understand how NOSTOPS is building a teacher-first network around genuine yoga teachers, their teaching and the traditions they carry."
            maxWidthClass="max-w-[240px]"
          />
          {/* CITY COORDINATORS NEAR ME when a coordinator exists for the
              visitor's detected city; otherwise the "Need a hand?" support
              card (Rashmi — matches the provisional-page design). */}
          {coordinator ? (
            <CoordinatorsNearYou
              coordinators={[coordinator]}
              cityLabel={cityLabel || null}
              heading="City coordinators near me"
            />
          ) : (
            <div className="rounded-2xl border border-line bg-white p-5" data-testid="provisional-support">
              <p className="text-[11px] font-black uppercase tracking-wider text-brand-700">Need a hand?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Have a question about this profile or need help claiming it? Tap{' '}
                <span className="font-bold text-brand-700">✨ Ask AI Guru</span> at the bottom of the screen — it can raise a
                support request to our team if you need a person.
              </p>
            </div>
          )}
        </div>

        {/* MAIN JOURNEY — left column (row 2) on desktop */}
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-2">
          {/* 2. WHY DID NOSTOPS CREATE THIS PROFILE? */}
          <section className="rounded-2xl border border-line bg-white p-6" data-testid="why-created">
            <h2 className="text-lg font-black text-ink">Why did NOSTOPS create this profile?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Yoga teachers are already teaching in cities, neighbourhoods, studios, homes, organisations and
              communities across India. Many teachers already have an online presence, but their teaching can still
              be difficult for genuine Yoga Seekers and organisations to discover.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              NOSTOPS is mapping this existing yoga teaching ecosystem so that teachers can decide for themselves
              whether they want to claim, complete and manage their presence on the NOSTOPS network. A provisional
              profile is therefore simply an invitation.
            </p>
            <p className="mt-3 border-l-2 border-brand/40 pl-3 text-sm font-semibold italic text-ink">
              Your teaching already exists. NOSTOPS helps people discover it.
            </p>
          </section>

          {/* 3. WHAT YOU CAN BUILD AFTER CLAIMING */}
          <section className="rounded-2xl border border-line bg-white p-6" data-testid="what-you-can-build">
            <h2 className="text-lg font-black text-ink">What you can build after claiming?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Claiming your profile gives you the opportunity to turn this provisional listing into your own
              professional NOSTOPS teaching profile.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {WHAT_YOU_CAN_BUILD.map((x) => (
                <span key={x} className="rounded-full border border-line bg-cream px-3 py-1 text-[12px] font-semibold text-ink-soft">{x}</span>
              ))}
            </div>
          </section>

          {/* 4. WHO CAN DISCOVER YOUR TEACHING? */}
          <section className="rounded-2xl border border-line bg-white p-6" data-testid="who-can-discover">
            <h2 className="text-lg font-black text-ink">Who can discover your teaching?</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {AUDIENCES.map((a) => (
                <div key={a.t} className="rounded-xl border border-line bg-cream/40 p-4">
                  <p className="text-sm font-black text-ink">{a.t}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{a.d}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              Your teaching may also be discovered by {OTHER_AUDIENCES.slice(0, -1).join(', ')} and {OTHER_AUDIENCES[OTHER_AUDIENCES.length - 1]}.
            </p>
          </section>

          {/* 5. TEACHING ENGAGEMENT OPPORTUNITIES */}
          <section className="rounded-2xl border border-line bg-white p-6" data-testid="teaching-opportunities">
            <h2 className="text-lg font-black text-ink">What kinds of teaching opportunities can your profile support?</h2>
            <ol className="mt-3 space-y-3">
              {KEY_OPPORTUNITIES.map((o, i) => (
                <li key={o.t} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-black text-brand-700">{i + 1}</span>
                  <div>
                    <p className="text-sm font-black text-ink">{o.t}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{o.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              {OTHER_OPPORTUNITIES.map((x) => (
                <span key={x} className="rounded-full border border-line bg-cream px-3 py-1 text-[12px] font-semibold text-ink-soft">{x}</span>
              ))}
            </div>
          </section>

          {/* 6. KEY NOSTOPS MESSAGE */}
          <section className="rounded-2xl border border-brand/20 bg-brand-50/60 p-6 text-center" data-testid="key-message">
            <p className="text-base font-black leading-snug tracking-tight text-brand-700">
              YOUR TEACHING ALREADY EXISTS.<br />NOSTOPS HELPS PEOPLE DISCOVER IT.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
              A completed profile helps people understand what you teach, where you teach, the traditions and methods
              you carry, and the kinds of teaching engagements you offer.
            </p>
            <p className="mx-auto mt-2 max-w-xl text-[12px] leading-relaxed text-muted">
              NOSTOPS helps people discover your teaching. We do not guarantee bookings, income or opportunities.
              Eligibility for opportunities depends on your profile, verification, teaching information and the
              requirements of each engagement.
            </p>
          </section>

          {/* 7. CLAIM CTA — existing auth + claim flow (unchanged) */}
          <section id="claim" className="rounded-2xl border border-brand/30 bg-white p-6" data-testid="claim-section">
            <h2 className="text-lg font-black text-ink">Claim your teaching profile — FREE</h2>
            <p className="mt-1 text-sm text-ink-soft">No payment. No credit card.</p>
            {signedIn ? (
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-2 text-[13px] text-ink-soft">
                  <input type="checkbox" checked={authorised} onChange={(e) => setAuthorised(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[color:var(--brand,#b45309)]" data-testid="claim-authorise" />
                  <span>I confirm I am {profile.name}, or an authorised representative of this teaching.</span>
                </label>
                {err && <p className="text-[13px] font-bold text-red-600" data-testid="claim-error">{err}</p>}
                <button type="button" onClick={claim} disabled={busy} className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-50" data-testid="claim-submit">
                  {busy ? 'Claiming…' : 'Claim your profile — FREE'}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <Link href={loginHref} className="block w-full rounded-xl bg-brand px-5 py-3 text-center text-sm font-black text-white hover:bg-brand-600" data-testid="claim-login">
                  Claim your profile — FREE
                </Link>
                <p className="mt-2 text-center text-[12px] text-ink-soft">You&apos;ll sign in or create a free account, then confirm it&apos;s you.</p>
              </div>
            )}
          </section>

          {/* 8. PROVISIONAL DISCLAIMER */}
          <section className="rounded-2xl border border-line bg-cream/30 p-5" data-testid="provisional-disclaimer">
            <h2 className="text-sm font-black text-ink">About this provisional profile</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              This profile was created by NOSTOPS using publicly available information to help map the local yoga
              teaching community. It has not been claimed by the teacher. The existence of this provisional profile
              does not mean that the teacher has joined NOSTOPS, is verified by NOSTOPS, is empanelled by the NOSTOPS
              Council of Gurus, or is affiliated with NOSTOPS.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Location information via Google. This provisional profile is not affiliated with, sponsored by, or
              endorsed by Google.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function Attribution() {
  return (
    <p className="mx-auto mt-6 max-w-xl text-center text-[11px] leading-relaxed text-muted">
      Location information via Google. This is a provisional profile created by NOSTOPS to map the local
      yoga community — it is not affiliated with, sponsored by, or endorsed by Google, and does not indicate
      that the teacher has joined NOSTOPS.
    </p>
  );
}
