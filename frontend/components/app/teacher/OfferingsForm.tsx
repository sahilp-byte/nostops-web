'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const DURATIONS = [30, 45, 60, 90, 120];

export default function OfferingsForm({ enabled: initEnabled, rateInr, durationMin, tierMin, tierMax, tierLabel, feePct }: {
  enabled: boolean; rateInr: number; durationMin: number; tierMin: number; tierMax: number; tierLabel: string; feePct: number;
}) {
  const router = useRouter();
  const keepPct = Math.max(0, 100 - (feePct || 15));
  const [enabled, setEnabled] = useState(initEnabled);
  const [rate, setRate] = useState(String(rateInr || tierMin));
  const [duration, setDuration] = useState(durationMin || 60);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [gate, setGate] = useState<string | null>(null);

  const rateNum = parseInt(rate, 10) || 0;
  // Teachers set their OWN fee (PART 10 — no platform-imposed minimum). We only
  // apply the backend's absolute sanity floor (₹500); the tier range is shown as
  // guidance and the backend stays the source of truth when saving.
  const RATE_FLOOR = 500;
  const RATE_CEIL = 100000;
  const rateValid = rateNum >= RATE_FLOOR && rateNum <= RATE_CEIL;
  const yourShare = Math.round(rateNum * (keepPct / 100));
  const nostopsShare = rateNum - yourShare;

  const chips = useMemo(() => {
    const set = new Set<number>([tierMin, Math.round((tierMin + tierMax) / 2), tierMax]);
    return [...set].filter((v) => v >= tierMin && v <= tierMax).sort((a, b) => a - b);
  }, [tierMin, tierMax]);

  async function save() {
    setMsg(null);
    setGate(null);
    if (enabled && !rateValid) { setMsg({ text: `Enter your rate — at least ${inr(RATE_FLOOR)}.`, ok: false }); return; }
    setBusy(true);
    const r = await sendBff('/bff/teacher/premium-config', 'PUT', { enabled, rate_inr: rateNum, duration_minutes: duration });
    setBusy(false);
    if (r.ok) { setMsg({ text: enabled ? `1:1 sessions live at ${inr(rateNum)}/session ✓` : '1:1 sessions turned off.', ok: true }); router.refresh(); return; }
    const err = r.data?.error || 'Could not save.';
    if (/profile|stage|empanel|complete/i.test(err)) setGate(err);
    else setMsg({ text: err, ok: false });
  }

  return (
    <div className="space-y-4">
      {gate && (
        <div className="rounded-2xl border p-4" style={{ borderColor: '#F59E0B55', backgroundColor: '#F59E0B0F' }}>
          <p className="text-sm font-extrabold" style={{ color: '#B45309' }}>🔒 {gate}</p>
          <p className="mt-1 text-sm text-ink-soft">Finish your profile to unlock paid 1:1 sessions.</p>
          <Link href="/app/teacher/profile/edit" className="mt-2 inline-block rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">Complete my profile →</Link>
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-base font-extrabold text-ink">Private 1:1 sessions</h2>
            <p className="text-sm text-ink-soft">Offer paid one-on-one sessions on your public profile. NOSTOPS keeps {feePct || 15}% to host &amp; secure the booking.</p>
            {tierLabel && <p className="mt-1 text-xs font-bold text-brand-700">{tierLabel} · suggested {inr(tierMin)}–{inr(tierMax)}/session · you set your own fee</p>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className="relative h-7 w-12 shrink-0 rounded-full transition"
            style={{ backgroundColor: enabled ? '#0D9488' : '#E5E7EB' }}
            data-testid="offering-toggle"
          >
            <span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: enabled ? '26px' : '4px' }} />
          </button>
        </div>
      </section>

      {enabled && (
        <>
          <section className="rounded-2xl border border-line bg-white p-5">
            <label className="text-sm font-extrabold text-ink">Your rate per session</label>
            <div className="mt-2 flex items-center rounded-xl border border-line bg-white px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <span className="text-lg font-black text-ink">₹</span>
              <input inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, '').slice(0, 5))} className="w-full bg-transparent px-2 py-2.5 text-lg font-black text-ink outline-none" data-testid="offering-rate" />
              <span className="text-sm text-muted">/ session</span>
            </div>
            {!rateValid && <p className="mt-1 text-xs font-semibold text-red-600">Enter a rate of at least {inr(RATE_FLOOR)} — you set your own fee.</p>}
            <p className="mt-1 text-xs text-muted">This is your own declared fee — shown to seekers on your profile, the directory and at booking. NOSTOPS never sets a minimum.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((v) => (
                <button key={v} type="button" onClick={() => setRate(String(v))} className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-ink-soft hover:bg-brand-50">{inr(v)}</button>
              ))}
            </div>

            <label className="mt-5 block text-sm font-extrabold text-ink">Session length</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button key={d} type="button" onClick={() => setDuration(d)} className="rounded-full border px-3 py-1.5 text-sm font-bold transition" style={{ borderColor: duration === d ? '#0D9488' : '#E5E7EB', backgroundColor: duration === d ? '#0D948815' : '#fff', color: duration === d ? '#0F766E' : '#475569' }}>{d} min</button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-brand/20 bg-brand-50/50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">You keep {keepPct}%</p>
            <div className="mt-2 flex items-baseline justify-between">
              <div><p className="text-2xl font-black text-brand-700">{inr(yourShare)}</p><p className="text-xs text-muted">to you, per session</p></div>
              <div className="text-right"><p className="text-sm font-bold text-ink-soft">{inr(nostopsShare)}</p><p className="text-xs text-muted">NOSTOPS · {feePct || 15}%</p></div>
            </div>
          </section>
        </>
      )}

      {msg && <p className="rounded-lg px-3 py-2 text-sm font-bold" style={{ backgroundColor: msg.ok ? '#0D948812' : '#EF444412', color: msg.ok ? '#0F766E' : '#B91C1C' }}>{msg.text}</p>}

      <button type="button" onClick={save} disabled={busy || (enabled && !rateValid)} className="w-full rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="offering-save">
        {busy ? 'Saving…' : 'Save offering'}
      </button>
    </div>
  );
}
