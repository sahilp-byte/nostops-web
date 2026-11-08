'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBff } from '@/lib/auth-client';
import { DIMENSIONS, DIMENSION_BY_ID, type DimensionId } from '@/lib/yoga-dimensions';

// Guided Yoga-Seeker journey (open to seekers worldwide): region context →
// introductory content → requirement (matrix) selection → hand-off to the
// EXISTING discovery (/app/discover) filtered by the chosen focus, then the
// existing profile → book → pay → confirm. No parallel system.
type Region = 'india' | 'intl';
const REGION_KEY = 'nostops.region.v1';

function persistRegion(r: Region) {
  try {
    localStorage.setItem(REGION_KEY, r);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `nostops_region=${r}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

const PROMISES = (intl: boolean) => [
  { icon: '🌐', title: intl ? 'Any timezone, any morning' : 'Your timezone, your schedule', body: 'Book a certified teacher for a 1:1 that fits your day — the calendar handles the timezone math.' },
  { icon: '🏅', title: 'Only Council-empanelled teachers', body: 'Every teacher is verified and empanelled by the NOSTOPS Council of Gurus — not a self-declared listing.' },
  { icon: '🛡️', title: 'Fair payments for teachers', body: 'Fair for teachers: your teacher’s share is recorded as reserved earnings. Its availability is subject to session completion and NOSTOPS’ applicable payment and verification rules.' },
  { icon: '🤝', title: 'A cooperative, not a marketplace', body: 'Teachers own their pricing, their students, and a real say in how the platform is run.' },
];

const STEPS = (intl: boolean) => [
  { n: '01', title: 'Choose your teacher', body: 'Filter by tradition, language, city of origin, and specialisation.' },
  { n: '02', title: intl ? 'Pick a time in your timezone' : 'Pick a time that suits you', body: intl ? 'The calendar auto-converts to IST for the teacher — no math required.' : 'The calendar shows available slots in your local time.' },
  { n: '03', title: 'Meet on secure video', body: 'Join from any device. Sessions are private, unrecorded, and end-to-end secured.' },
  { n: '04', title: 'Stay with your teacher', body: 'Rebook weekly, monthly, or seasonal packages directly with the same teacher.' },
];

const LINEAGES = ['Hatha & Ashtanga', 'Iyengar Alignment', 'Pranayama & Breath', 'Meditation & Dhyana', 'Ayurveda Lifestyle', 'Yoga for Corporates'];

const COOP = [
  'Teachers set their own rate — no forced discounting.',
  'NOSTOPS keeps a small, capped platform fee — the rest is the teacher’s.',
  'Reviews are verified from real completed sessions — no fake ratings.',
  'The Council of Gurus, not investors, sets the empanelment bar.',
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{children}</p>;
}

export default function BookJourney({
  firstName,
  counts,
  totalTeachers,
  empanelled,
}: {
  firstName: string;
  counts: Record<DimensionId, number>;
  totalTeachers: number;
  empanelled: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'region' | 'explore'>('region');
  const [region, setRegion] = useState<Region | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);
  // Multi-select: the seeker may pick ONE, TWO or ALL THREE matrices, plus any
  // number of optional specific sub-requirements.
  const [selDims, setSelDims] = useState<Set<DimensionId>>(new Set());
  const [selReqs, setSelReqs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(REGION_KEY);
    } catch {
      /* ignore */
    }
    if (saved === 'india' || saved === 'intl') {
      setRegion(saved);
      setStep('explore');
    }
  }, []);

  function choose(r: Region) {
    setRegion(r);
    persistRegion(r);
    setStep('explore');
  }

  function detect() {
    setDetectMsg(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDetectMsg('Location isn’t available on this device — please choose below.');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const r = await getBff<{ country?: string }>(`/bff/geo/reverse?lat=${latitude.toFixed(3)}&lng=${longitude.toFixed(3)}`);
        setDetecting(false);
        const country = (r.ok ? r.data?.country : '') || '';
        const isIndia = /india/i.test(country) || country.trim().toUpperCase() === 'IN';
        choose(isIndia ? 'india' : country ? 'intl' : 'india');
      },
      () => {
        setDetecting(false);
        setDetectMsg('Couldn’t detect your region — please choose below.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  function explore(dim: DimensionId | null) {
    const q = new URLSearchParams({ book: '1' });
    if (dim) q.set('dimension', dim);
    router.push(`/app/discover?${q.toString()}`);
  }

  function toggleDim(id: DimensionId) {
    setSelDims((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        // Drop that matrix's sub-requirements too.
        setSelReqs((r) => {
          const rr = new Set(r);
          for (const s of DIMENSION_BY_ID[id].subs) rr.delete(s.id);
          return rr;
        });
      } else {
        n.add(id);
      }
      return n;
    });
  }

  function toggleReq(id: string) {
    setSelReqs((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function findTeachers() {
    const dims = [...selDims];
    const reqs = [...selReqs];
    // Remember the seeker's focus so it can be shown to the teacher on the
    // booking (and surfaced to admins) — reason travels with the booking note.
    try {
      localStorage.setItem(
        'nostops.focus.v1',
        JSON.stringify({ dims, reqs, labels: dims.map((d) => DIMENSION_BY_ID[d].short) }),
      );
    } catch {
      /* ignore */
    }
    const q = new URLSearchParams({ book: '1' });
    if (dims.length) q.set('dims', dims.join(','));
    if (reqs.length) q.set('reqs', reqs.join(','));
    router.push(`/app/discover?${q.toString()}`);
  }

  // ---- Step 1: region context ----
  if (step === 'region') {
    return (
      <div className="py-6" data-testid="journey-region">
        <Eyebrow>Book a 1:1 session</Eyebrow>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Let’s find your teacher, {firstName}</h1>
        <p className="mt-2 text-ink-soft">First, where are you practising from? This only helps us tailor your guidance.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => choose('india')} data-testid="region-india" className="card group p-6 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
            <span className="text-3xl" aria-hidden="true">🇮🇳</span>
            <p className="mt-3 text-lg font-black text-ink group-hover:text-brand-700">I’m in India</p>
            <p className="mt-1 text-sm text-muted">Practise online or in person, in your timezone. Pay securely in ₹.</p>
          </button>
          <button type="button" onClick={() => choose('intl')} data-testid="region-intl" className="card group p-6 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
            <span className="text-3xl" aria-hidden="true">🌏</span>
            <p className="mt-3 text-lg font-black text-ink group-hover:text-brand-700">I’m outside India</p>
            <p className="mt-1 text-sm text-muted">Connect online 1:1 with a verified teacher, scheduled in your local time.</p>
            <p className="mt-1 text-xs font-semibold text-amber-700" data-testid="region-intl-payment-note">International payment isn&apos;t available yet: sessions are paid in ₹ with an India billing address for now.</p>
          </button>
        </div>

        <div className="mt-4">
          <button type="button" onClick={detect} disabled={detecting} data-testid="region-detect" className="text-sm font-bold text-brand-700 transition hover:underline disabled:opacity-60">
            {detecting ? 'Detecting…' : '📍 Detect my region automatically'}
          </button>
          {detectMsg && <p className="mt-1 text-sm font-semibold text-amber-700">{detectMsg}</p>}
        </div>
      </div>
    );
  }

  const intl = region === 'intl';

  // ---- Step 2: intro content + requirement selection + supporting content ----
  return (
    <div className="pb-6" data-testid="journey-explore">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-royal to-brand p-7 text-white sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <button type="button" onClick={() => setStep('region')} className="relative text-xs font-bold text-white/80 hover:text-white">‹ Change region</button>
        <p className="relative mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur">
          {intl ? '✨ Practise from anywhere' : '🧘 1:1 with a verified teacher'}
        </p>
        <h1 className="relative mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          {intl ? 'Wherever you are, keep your practice — and your teacher — with you.' : 'Your practice, your teacher — one breath at a time.'}
        </h1>
        <p className="relative mt-3 max-w-2xl text-white/85">
          {intl
            ? 'NOSTOPS brings 1:1 sessions with Council-empanelled teachers, trained in authentic yoga traditions, to seekers around the world — on your timezone, at premium quality.'
            : 'Book a 1:1 session with a Council-empanelled teacher trained in an authentic yoga tradition — online or in person, in your timezone.'}
        </p>
        {intl && (
          <p className="relative mt-2 max-w-2xl text-sm font-semibold text-white/90" data-testid="intl-payment-note">
            International payment isn&apos;t available yet: sessions can be paid only in ₹ with an India billing address for now.
          </p>
        )}
        <a href="#smartmatch" className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-ink shadow-lg transition hover:bg-cream">
          Book a 1:1 session →
        </a>
      </section>

      {/* SmartMatch — requirement selection (multi-select) */}
      <section id="smartmatch" className="mt-10 scroll-mt-6">
        <Eyebrow>Smartmatch · just for you</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Find your teacher in 3 taps.</h2>
        <p className="mt-2 text-ink-soft">Pick one or more focuses — you can choose all three — then optionally get specific.</p>
        <p className="mt-2 text-sm text-muted">A personal session is a supportive space to explore yoga for your wellbeing — not a medical treatment.</p>

        <div className="mt-5 space-y-4">
          {DIMENSIONS.map((d) => {
            const on = selDims.has(d.id);
            return (
              <div key={d.id} className="card overflow-hidden p-0" style={{ borderLeft: `4px solid ${d.color}` }}>
                <button
                  type="button"
                  onClick={() => toggleDim(d.id)}
                  aria-pressed={on}
                  data-testid={`matrix-${d.id}`}
                  className="flex w-full items-start gap-3 p-5 text-left transition hover:bg-cream/50"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: `${d.color}14` }} aria-hidden="true">
                    {d.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-ink">{d.label}</span>
                      {counts[d.id] > 0 && <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-ink-soft">{counts[d.id]} teachers</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{d.blurb}</span>
                  </span>
                  <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-black ${on ? 'border-brand bg-brand text-white' : 'border-line text-transparent'}`}>
                    ✓
                  </span>
                </button>
                {on && (
                  <div className="border-t border-line bg-cream/40 px-5 py-4" data-testid={`subs-${d.id}`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Get specific (optional)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {d.subs.map((s) => {
                        const son = selReqs.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleReq(s.id)}
                            aria-pressed={son}
                            data-testid={`req-${s.id}`}
                            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${son ? 'bg-brand text-white' : 'bg-white text-ink-soft ring-1 ring-line hover:ring-brand'}`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 z-10 mt-5 bg-gradient-to-t from-white via-white to-transparent pb-1 pt-3">
          <button
            type="button"
            onClick={findTeachers}
            disabled={selDims.size === 0}
            data-testid="find-teacher"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-brand-600 disabled:opacity-50"
          >
            {selDims.size === 0 ? 'Select at least one focus' : `Find my teacher${selDims.size > 1 ? ` (${selDims.size} focuses)` : ''} →`}
          </button>
          <div className="mt-2 text-center">
            <button type="button" onClick={() => explore(null)} data-testid="explore-all" className="text-sm font-bold text-brand-700 hover:underline">
              Not sure? Browse all teachers →
            </button>
          </div>
        </div>

        {intl && (
          <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-xs text-muted">
            Prices show an indicative amount in your currency; sessions are billed securely in Indian Rupees (₹).
          </p>
        )}
      </section>

      {/* Why it's different */}
      <section className="mt-10">
        <Eyebrow>Why it’s different</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Four promises we make — and mean.</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROMISES(intl).map((p) => (
            <div key={p.title} className="card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-xl" aria-hidden="true">{p.icon}</span>
              <p className="mt-3 font-black text-ink">{p.title}</p>
              <p className="mt-1 text-sm text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">From your first tap to your first Namaste — in four steps.</h2>
        <div className="card mt-4 divide-y divide-line p-2">
          {STEPS(intl).map((s) => (
            <div key={s.n} className="flex gap-4 p-4">
              <span className="text-sm font-black text-brand-700">{s.n}</span>
              <div>
                <p className="font-black text-ink">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Traditions preserved */}
      <section className="mt-10">
        <Eyebrow>Traditions preserved</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Many lineages. Hundreds of teachers. One authentic source.</h2>
        <p className="mt-2 text-ink-soft">Every teacher signs the NOSTOPS Council Charter — a commitment to teach in the tradition they were trained in, not a diluted version.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LINEAGES.map((l) => (
            <span key={l} className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">{l}</span>
          ))}
        </div>
      </section>

      {/* Cooperative model */}
      <section className="mt-10">
        <Eyebrow>The cooperative model</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Why we call ourselves a Teacher-First Cooperative</h2>
        <div className="mt-4 rounded-2xl bg-brand-50 p-6">
          <p className="text-lg font-black text-ink">Great teaching shouldn’t depend on where a teacher lives — or who owns the platform.</p>
          <p className="mt-2 text-sm text-ink-soft">
            NOSTOPS is designed the opposite way: teachers hold the pricing, the students they build a relationship with belong to <strong>them</strong>, and every session moves them closer to full empanelment, higher tiers, and a bigger say in governance.
          </p>
          <ul className="mt-4 space-y-2">
            {COOP.map((c) => (
              <li key={c} className="flex gap-2 text-sm text-ink-soft">
                <span aria-hidden="true" className="text-brand-700">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Numbers */}
      <section className="mt-10">
        <Eyebrow>The cooperative, in numbers</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Built with teachers, not on top of them.</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="card p-5 text-center">
            <p className="text-2xl font-black text-ink">{totalTeachers > 0 ? `${totalTeachers}+` : '—'}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">Verified teachers</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-black text-ink">{empanelled > 0 ? `${empanelled}+` : '—'}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">Empanelled</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-2xl font-black text-ink">100%</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">Verified & KYC</p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="mt-10">
        <Eyebrow>The mission</Eyebrow>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Bringing people everywhere home to authentic practice.</h2>
        <div className="card mt-4 p-6">
          <p className="text-sm text-ink-soft">
            We’re partnering with organisations and communities around the world to reintroduce people to authentic yoga, breathwork, and Ayurvedic living. Every 1:1 session you take helps fund a teacher’s empanelment and training.
          </p>
          <Link href="/about" className="mt-4 inline-flex items-center gap-1 rounded-xl border border-line px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:border-brand hover:text-brand-600">
            Read the mission →
          </Link>
        </div>
      </section>

      {/* Closing */}
      <section className="mt-10 text-center">
        <h2 className="text-2xl font-black tracking-tight text-ink">Authentic practice, wherever you are.</h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-soft">
          Come to it — one 1:1 session at a time. From any city, on your timezone, with a teacher trained in an authentic tradition.
        </p>
        <a href="#smartmatch" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-brand-600">
          Choose your focus →
        </a>
      </section>
    </div>
  );
}
