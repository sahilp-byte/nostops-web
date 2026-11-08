// Firecracker sound for the festive celebration, synthesised with the Web Audio API (no audio file
// to download). Browsers only allow sound after the visitor has interacted with the site, so if the
// page loads "muted" the sound starts on the first tap/click/key press within the 5-second window.
// It plays once per page load and is closed afterwards.

export type FireworkAudio = { whistle: () => void; bang: (big?: boolean) => void; ladi: (count?: number) => void; setMuted: (m: boolean) => void; close: () => void };

const VOLUME = 0.32;

export function createFireworkAudio(windowMs: number, startMuted = false): FireworkAudio | null {
  const AC: typeof AudioContext | undefined =
    typeof window !== 'undefined' ? window.AudioContext || (window as any).webkitAudioContext : undefined;
  if (!AC) return null;
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  const started = performance.now();
  const master = ctx.createGain();
  master.gain.value = startMuted ? 0 : VOLUME;
  master.connect(ctx.destination);

  // Shared white-noise buffer for bangs and crackles.
  const noise = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const unlock = () => {
    if (ctx.state === 'suspended' && performance.now() - started < windowMs) ctx.resume().catch(() => {});
  };
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
  ctx.resume().catch(() => {});

  const live = () => ctx.state === 'running';

  const noiseHit = (at: number, dur: number, freq: number, q: number, gain: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(g).connect(master);
    src.start(at, Math.random() * 0.5, dur + 0.05);
  };

  return {
    whistle() {
      if (!live()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(900 + Math.random() * 300, t);
      o.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 600, t + 0.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.8);
    },
    bang(big = true) {
      if (!live()) return;
      const t = ctx.currentTime;
      // low thump + bright crack
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.35);
      g.gain.setValueAtTime(big ? 0.9 : 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.45);
      noiseHit(t, big ? 0.6 : 0.35, 900, 0.7, big ? 0.9 : 0.5);
      // crackle tail
      const n = big ? 14 : 7;
      for (let i = 0; i < n; i++) noiseHit(t + 0.12 + Math.random() * 0.7, 0.03, 2500 + Math.random() * 3500, 3, 0.25 + Math.random() * 0.25);
    },
    ladi(count = 24) {
      // A "ladi" — a string of small crackers popping in quick succession.
      if (!live()) return;
      const t = ctx.currentTime;
      let at = t;
      for (let i = 0; i < count; i++) {
        at += 0.04 + Math.random() * 0.09;
        noiseHit(at, 0.06, 1400 + Math.random() * 2600, 1.2, 0.35 + Math.random() * 0.35);
      }
    },
    setMuted(m: boolean) {
      master.gain.setValueAtTime(m ? 0 : VOLUME, ctx.currentTime);
      if (!m) ctx.resume().catch(() => {}); // called from a click, so the browser allows sound
    },
    close() {
      events.forEach((e) => window.removeEventListener(e, unlock));
      setTimeout(() => ctx.close().catch(() => {}), 1500); // let the last crackles ring out
    },
  };
}
