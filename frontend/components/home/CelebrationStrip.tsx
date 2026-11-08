import Link from 'next/link';
import { kalam } from './fonts';

// Festive strip under the hero: the general celebration message on the left and the separate
// teacher-only Free InstaKYC panel on the right. The whole panel links to the public campaign page
// /festive-free-kyc (never straight to a dashboard or claim endpoint).
const CONFETTI = [
  { l: '2%', t: '18%', c: '#EF7D22', r: 20 }, { l: '6%', t: '70%', c: '#8FB3A6', r: 45 }, { l: '11%', t: '35%', c: '#F5B544', r: 10 },
  { l: '28%', t: '8%', c: '#EF7D22', r: 60 }, { l: '47%', t: '82%', c: '#0E4D52', r: 30 }, { l: '52%', t: '12%', c: '#F5B544', r: 75 },
  { l: '58%', t: '62%', c: '#EF7D22', r: 15 }, { l: '62%', t: '28%', c: '#8FB3A6', r: 50 }, { l: '93%', t: '15%', c: '#0E4D52', r: 35 },
  { l: '96%', t: '66%', c: '#EF7D22', r: 65 }, { l: '89%', t: '84%', c: '#F5B544', r: 25 }, { l: '36%', t: '88%', c: '#8FB3A6', r: 80 },
];

function PartyPopper() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" aria-hidden>
      <path d="M8 58 22 20l22 22z" fill="#EF7D22" />
      <path d="M8 58 22 20l6 6L13 56z" fill="#F5B544" />
      <path d="M34 14c2-5 6-7 10-6M42 26c6-3 11-2 14 2M30 6l2 6M50 16l5-3M54 34l6 1" stroke="#EF7D22" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function CelebrationStrip() {
  return (
    <section className="bg-[#FCFAF6]" data-testid="home-celebration">
      <div className="mx-auto max-w-[1480px] px-3 sm:px-5">
        <div className="relative mt-3 grid items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-r from-[#FFF7EC] via-[#FFFAF3] to-[#FFF7EC] px-5 py-6 md:grid-cols-[1fr_auto] lg:px-12">
          {CONFETTI.map((p, i) => (
            <span key={i} aria-hidden className="absolute h-2 w-2.5 rounded-[2px] opacity-80" style={{ left: p.l, top: p.t, background: p.c, transform: `rotate(${p.r}deg)` }} />
          ))}
          <div className="relative flex items-center gap-4">
            <PartyPopper />
            <div>
              <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#0E4D52] sm:text-[28px]" data-testid="celebration-title">
                NOSTOPS <span className={`${kalam.className} text-[30px] font-bold text-[#EF7D22] sm:text-[38px]`}>Celebrates</span> the Spirit of Yoga!
              </h2>
              <p className="mt-1 text-[15px] text-[#24474A] sm:text-base">More people. More well-being. A stronger, healthier India.</p>
            </div>
          </div>
          <Link
            href="/festive-free-kyc"
            data-testid="celebration-free-kyc"
            aria-label="Special for Indian Yoga Teachers: Free InstaKYC from 1 Nov – 31 Dec 2026"
            className="relative flex min-h-[72px] items-center gap-4 rounded-2xl border border-[#F6D7B8] bg-white/90 px-5 py-3 shadow-[0_8px_24px_-12px_rgba(240,122,26,0.4)] transition hover:bg-white"
          >
            <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0" aria-hidden>
              <rect x="6" y="18" width="36" height="26" rx="3" fill="#F07A1A" />
              <rect x="3" y="12" width="42" height="9" rx="2" fill="#F5A04A" />
              <rect x="21" y="12" width="6" height="32" fill="#fff" />
              <path d="M24 12c-4-8-13-8-12-2 1 4 8 2 12 2zm0 0c4-8 13-8 12-2-1 4-8 2-12 2z" fill="#F07A1A" />
            </svg>
            <span>
              <span className="block text-xs font-semibold text-[#24474A] sm:text-[13px]">Special for Indian Yoga Teachers</span>
              <span className="block text-lg font-extrabold text-[#0E3D3B] sm:text-xl">Free InstaKYC from 1 Nov – 31 Dec 2026</span>
            </span>
            <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 shrink-0 text-[#F07A1A]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
