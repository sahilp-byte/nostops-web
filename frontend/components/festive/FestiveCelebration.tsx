'use client';

import { useEffect, useRef, useState } from 'react';
import { createFireworkAudio } from '@/components/festive/firework-audio';

// Festive onload effect (homepage + /festive-free-kyc): 20 seconds of confetti showers and
// firecrackers with synthesised firecracker sound, once per page load. The show changes every
// 3 seconds (scattered rockets → corner confetti cannons + ladi → golden rain → ring bursts →
// grand volley → ...). Plain canvas, pointer-events off, skipped for prefers-reduced-motion,
// removes itself when done.
const DURATION = 20000;
const MUTE_KEY = 'nostops_festive_muted';
const PHASE_MS = 3000;
const FADE = 1200;
const MAX_CONFETTI = 700;
const COLORS = ['#F07A1A', '#F5B521', '#E8466B', '#0F5E5A', '#FFD166', '#FF8FA3', '#FFFFFF'];
const GOLD = ['#F5B521', '#FFD166', '#FFE8A3', '#F07A1A', '#FFFFFF'];
const SPARK = ['#FFD166', '#F5B521', '#FF9F43', '#FF6B6B', '#FFE8A3', '#7FD8C5', '#C3A6FF'];

type Confetti = { x: number; y: number; w: number; h: number; vx: number; vy: number; g: number; rot: number; vr: number; sway: number; phase: number; color: string; round: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Rocket = { x: number; y: number; vy: number; targetY: number; color: string; kind: 'round' | 'ring' | 'willow' };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// Phase scripts (repeat every 6 × 3 s). Rates are per-frame chances / ms intervals.
const PHASES = [
  { name: 'scatter', launchEvery: 380, volley: 1, confettiEvery: 220, confettiN: 14, palette: COLORS, cannons: false, kind: 'round' as const },
  { name: 'cannons', launchEvery: 900, volley: 1, confettiEvery: 160, confettiN: 10, palette: COLORS, cannons: true, kind: 'willow' as const },
  { name: 'golden-rain', launchEvery: 520, volley: 2, confettiEvery: 90, confettiN: 22, palette: GOLD, cannons: false, kind: 'willow' as const },
  { name: 'rings', launchEvery: 450, volley: 2, confettiEvery: 260, confettiN: 12, palette: COLORS, cannons: false, kind: 'ring' as const },
  { name: 'ladi', launchEvery: 700, volley: 1, confettiEvery: 140, confettiN: 16, palette: COLORS, cannons: true, kind: 'round' as const },
  { name: 'grand-volley', launchEvery: 260, volley: 3, confettiEvery: 120, confettiN: 20, palette: COLORS, cannons: false, kind: 'round' as const },
];

export default function FestiveCelebration() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0); // 0 = automatic on load; each replay increments
  const [muted, setMutedState] = useState(false);
  const mutedRef = useRef(false);
  const audioRef = useRef<ReturnType<typeof createFireworkAudio>>(null);

  useEffect(() => {
    const m = localStorage.getItem(MUTE_KEY) === '1';
    mutedRef.current = m;
    setMutedState(m);
  }, []);

  const toggleMute = () => {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMutedState(m);
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    audioRef.current?.setMuted(m);
  };
  const replay = () => {
    setDone(false);
    setRun((r) => r + 1);
  };

  useEffect(() => {
    // Respect reduced motion: no automatic show (the replay button still lets people opt in).
    if (run === 0 && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDone(true);
      return;
    }
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const small = W < 640;
    const scale = small ? 0.55 : 1;
    const confetti: Confetti[] = [];
    const sparks: Spark[] = [];
    const rockets: Rocket[] = [];

    const addConfetti = (n: number, palette: string[]) => {
      for (let i = 0; i < n && confetti.length < MAX_CONFETTI; i++) {
        confetti.push({
          x: rand(0, W), y: rand(-H * 0.3, -10), w: rand(6, 11), h: rand(8, 15),
          vx: rand(-0.6, 0.6), vy: rand(1.8, 3.8), g: 0, rot: rand(0, Math.PI * 2), vr: rand(-0.14, 0.14),
          sway: rand(0.6, 1.8), phase: rand(0, Math.PI * 2), color: pick(palette), round: Math.random() < 0.25,
        });
      }
    };
    // Confetti cannons shooting up and inwards from both bottom corners.
    const cannon = (n: number, palette: string[]) => {
      for (const side of [0, 1]) {
        for (let i = 0; i < n && confetti.length < MAX_CONFETTI; i++) {
          const x = side ? W + 5 : -5;
          confetti.push({
            x, y: H + 5, w: rand(6, 10), h: rand(8, 14),
            vx: (side ? -1 : 1) * rand(2.5, 7) * (small ? 0.7 : 1), vy: -rand(9, 15) * (small ? 0.85 : 1), g: 0.18,
            rot: rand(0, Math.PI * 2), vr: rand(-0.2, 0.2), sway: rand(0.3, 1), phase: rand(0, Math.PI * 2),
            color: pick(palette), round: Math.random() < 0.3,
          });
        }
      }
    };
    const burst = (x: number, y: number, base: string, kind: Rocket['kind']) => {
      const n = Math.round((kind === 'ring' ? 60 : 80) * (small ? 0.65 : 1));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.04, 0.04);
        const sp = kind === 'ring' ? rand(4.2, 4.8) : rand(1.6, small ? 4.6 : 6.2);
        const max = kind === 'willow' ? rand(80, 120) : rand(48, 82);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: max, max, color: kind === 'willow' ? pick(GOLD) : Math.random() < 0.6 ? base : pick(SPARK), size: rand(1.4, 2.7) });
      }
    };

    const audio = createFireworkAudio(DURATION, mutedRef.current);
    audioRef.current = audio;
    const launch = (kind: Rocket['kind']) => {
      rockets.push({ x: rand(W * 0.1, W * 0.9), y: H + 10, vy: -rand(9, 13), targetY: rand(H * 0.1, H * 0.45), color: pick(SPARK), kind });
      if (Math.random() < 0.7) audio?.whistle();
    };

    addConfetti(Math.round(160 * scale), COLORS);
    const start = performance.now();
    let lastLaunch = -1000;
    let lastConfetti = 0;
    let lastPhase = -1;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.max(0, now - start); // the first frame's timestamp can precede `start`
      const pi = Math.floor(t / PHASE_MS);
      const ph = PHASES[pi % PHASES.length];
      const showing = t < DURATION - 1600; // stop spawning so the last bursts finish before the fade

      if (pi !== lastPhase && showing) {
        lastPhase = pi;
        // Every 3 s: a fresh signature moment for the phase.
        if (ph.cannons) {
          cannon(Math.round(60 * scale), ph.palette);
          audio?.bang(true);
        }
        if (ph.name === 'ladi') audio?.ladi(small ? 18 : 30);
        if (ph.name === 'grand-volley') for (let i = 0; i < (small ? 3 : 6); i++) launch('round');
        if (ph.name === 'golden-rain') addConfetti(Math.round(120 * scale), GOLD);
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = t > DURATION - FADE ? Math.max(0, (DURATION - t) / FADE) : 1;

      if (showing && t - lastLaunch > ph.launchEvery / (small ? 0.75 : 1)) {
        for (let i = 0; i < (small ? Math.max(1, ph.volley - 1) : ph.volley); i++) launch(ph.kind);
        lastLaunch = t;
      }
      if (showing && t - lastConfetti > ph.confettiEvery) {
        addConfetti(Math.round(ph.confettiN * scale), ph.palette);
        lastConfetti = t;
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy *= 0.985;
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x - 1, r.y, 2, 9);
        if (Math.random() < 0.7) sparks.push({ x: r.x + rand(-1, 1), y: r.y + 10, vx: rand(-0.3, 0.3), vy: rand(0.5, 1.5), life: 18, max: 18, color: '#FFD166', size: 1.2 });
        if (r.y <= r.targetY || r.vy > -2) {
          burst(r.x, r.y, r.color, r.kind);
          audio?.bang(r.kind !== 'ring' || Math.random() < 0.5);
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.97;
        s.vy = s.vy * 0.97 + 0.06;
        s.life -= 1;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const a = s.life / s.max;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.6 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.phase += 0.05;
        if (c.g) {
          // cannon piece: ballistic until it slows, then flutters down like the rest
          c.vy += c.g;
          c.vx *= 0.985;
          if (c.vy > 2.6) c.g = 0;
        }
        c.x += c.vx + Math.sin(c.phase) * c.sway * 0.5;
        c.y += c.vy;
        c.rot += c.vr;
        if (c.y > H + 30 && !c.g) {
          confetti.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        if (c.round) {
          ctx.beginPath();
          ctx.arc(0, 0, c.w / 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.phase)));
        }
        ctx.restore();
      }

      if (t < DURATION) raf = requestAnimationFrame(tick);
      else {
        audio?.close();
        setDone(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio?.close();
      window.removeEventListener('resize', resize);
    };
  }, [run]);

  const btn =
    'grid h-11 w-11 place-items-center rounded-full border border-[#F3D9C4] bg-white/95 text-[#0E3D3B] shadow-md backdrop-blur transition hover:bg-[#FFF1E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F07A1A]';
  return (
    <>
      {!done && <canvas ref={ref} aria-hidden="true" data-testid="festive-celebration" className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />}
      <div className="fixed right-3 top-[76px] z-[61] flex gap-2 sm:right-5" data-testid="festive-controls">
        <button type="button" onClick={toggleMute} className={btn} aria-pressed={muted} aria-label={muted ? 'Turn celebration sound on' : 'Mute celebration sound'} title={muted ? 'Sound on' : 'Mute'} data-testid="festive-mute">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
            {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
          </svg>
        </button>
        <button type="button" onClick={replay} disabled={!done} className={`${btn} disabled:opacity-50`} aria-label="Replay the festive celebration" title="Replay celebration" data-testid="festive-replay">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />
          </svg>
        </button>
      </div>
    </>
  );
}
