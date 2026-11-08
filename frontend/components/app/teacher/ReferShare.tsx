'use client';

import { useEffect, useState } from 'react';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function ReferShare({ code, empanelled, totalEarned, pending, available, totalWithdrawn }: {
  code: string; empanelled: boolean; totalEarned: number; pending: number; available: number; totalWithdrawn: number;
}) {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  useEffect(() => { setLink(`${window.location.origin}/become-a-teacher?ref=${code}`); }, [code]);

  const message = `🧘 Join me on NOSTOPS — India's teacher-first yoga cooperative. Keep 70–85% on eligible institutional programmes. Use my invite code ${code}: ${link}`;

  async function copy(what: 'link' | 'code', text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1800); } catch { /* noop */ }
  }
  function whatsapp() { if (link) window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener'); }

  return (
    <div className="space-y-4">
      {/* Code card */}
      <section className="rounded-2xl bg-brand-700 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">Your invite code</p>
        <div className="mt-2 flex items-center gap-3">
          <p className="flex-1 text-3xl font-black tracking-widest" data-testid="referral-code">{code || '—'}</p>
          {code && <button type="button" onClick={() => copy('code', code)} className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold">{copied === 'code' ? 'Copied ✓' : 'Copy'}</button>}
        </div>
        <p className="mt-3 text-sm text-white/85">Earn referral rewards when teachers you invite get empanelled.</p>
      </section>

      {!empanelled && (
        <p className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: '#F59E0B15', color: '#B45309' }}>
          Get empanelled to start earning on your referrals — your code still works, rewards unlock on empanelment.
        </p>
      )}

      {/* Invite link + share */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <label className="text-sm font-extrabold text-ink">Your invite link</label>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-cream/50 px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-testid="referral-link">{link || '…'}</span>
          <button type="button" onClick={() => copy('link', link)} disabled={!link} className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{copied === 'link' ? 'Copied ✓' : 'Copy'}</button>
        </div>
        <button type="button" onClick={whatsapp} disabled={!link} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50" style={{ backgroundColor: '#25D366' }}>
          <span>💬</span> Share on WhatsApp
        </button>
      </section>

      {/* Rewards */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-extrabold text-ink">Referral rewards</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-brand-50/50 p-3"><p className="text-lg font-black text-brand-700">{inr(available)}</p><p className="text-xs text-muted">Available</p></div>
          <div className="rounded-xl bg-cream/70 p-3"><p className="text-lg font-black text-ink">{inr(pending)}</p><p className="text-xs text-muted">Pending</p></div>
          <div className="rounded-xl bg-cream/70 p-3"><p className="text-lg font-black text-ink">{inr(totalEarned)}</p><p className="text-xs text-muted">Total earned</p></div>
          <div className="rounded-xl bg-cream/70 p-3"><p className="text-lg font-black text-ink">{inr(totalWithdrawn)}</p><p className="text-xs text-muted">Withdrawn</p></div>
        </div>
        <a href="/app/teacher/wallet" className="mt-3 block text-center text-sm font-bold text-brand-700 hover:underline">View your wallet →</a>
      </section>
    </div>
  );
}
