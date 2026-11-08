'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

type Tier = { currentLabel: string; nextLabel: string | null; toNext: number; progressPct: number; nextBonus: number; ladder: Array<{ label: string; minEmp: number; maxEmp: number; bonus: number; perk: string | null }> } | null;
type Invite = { code: string; link: string; shareText: string; totalEarned: number; available: number; empanelled: boolean; referrals: { total: number; kycVerified: number; empanelled: number }; tier: Tier } | null;

// Refer & Earn widget — hands out the teacher's public invite link + code and
// shows REAL referral earnings (grows the NOSTOPS teacher network). The invite
// link carries only the public referral code — never a token.
export default function ReferralWidget({ invite }: { invite: Invite }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  if (!invite) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5 text-center" data-testid="widget-referral-locked">
        <span className="text-3xl">🌱</span>
        <p className="mt-2 text-base font-extrabold text-ink">Refer &amp; Earn unlocks with empanelment</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">Get empanelled to receive your invite code and earn referral rewards when teachers you invite join and get verified.</p>
        <Link href="/app/teacher/empanelment" className="mt-4 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          View empanelment paths →
        </Link>
      </div>
    );
  }

  const full = `${invite.shareText} ${invite.link}`;
  const copy = async (what: 'link' | 'code', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600);
    } catch {
      /* no-op */
    }
  };
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');

  return (
    <article id="widget-referral" className="rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="widget-referral">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Network</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Active</span>
      </div>
      <h3 className="mt-2 text-base font-black tracking-tight text-ink">Refer &amp; Earn — invite teachers</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">Grow the NOSTOPS network — earn referral rewards when teachers you invite join and get empanelled.</p>

      {/* Earnings (real) */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-50/60 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total earned</p>
          <p className="text-xl font-black text-ink" data-testid="referral-total-earned">{inr(invite.totalEarned)}</p>
        </div>
        <div className="rounded-xl bg-cream/60 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Available</p>
          <p className="text-xl font-black text-ink">{inr(invite.available)}</p>
        </div>
      </div>

      {/* Conversion funnel (real counts — raw link clicks aren't exposed by the backend) */}
      <div className="mt-3 grid grid-cols-3 gap-2" data-testid="referral-funnel">
        <div className="rounded-xl border border-line bg-white p-2.5 text-center">
          <p className="text-lg font-black text-ink">{invite.referrals.total}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Invited</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-2.5 text-center">
          <p className="text-lg font-black text-ink">{invite.referrals.kycVerified}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Verified</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-2.5 text-center">
          <p className="text-lg font-black text-brand-700">{invite.referrals.empanelled}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Empanelled</p>
        </div>
      </div>

      {/* Tier rank ladder (real — the invite program's own ranking) */}
      {invite.tier && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3" data-testid="referral-tier">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-black text-amber-800">🏅 {invite.tier.currentLabel} rank</span>
            {invite.tier.nextLabel && invite.tier.toNext > 0 && (
              <span className="text-[11px] font-bold text-amber-700">
                {invite.tier.toNext} more empanelled → {invite.tier.nextLabel}
                {invite.tier.nextBonus > 0 ? ` (+${inr(invite.tier.nextBonus)} bonus)` : ''}
              </span>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${invite.tier.progressPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {invite.tier.ladder.map((l) => {
              const isCurrent = l.label === invite.tier!.currentLabel;
              return (
                <span key={l.label} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isCurrent ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 ring-1 ring-amber-200'}`} title={`${l.minEmp}–${l.maxEmp} empanelled${l.perk ? ' · ' + l.perk.replace(/_/g, ' ') : ''}`}>
                  {l.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite code */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-cream/40 p-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Invite code</span>
          <span className="block truncate text-lg font-black tracking-widest text-brand-700" data-testid="referral-code">{invite.code}</span>
        </span>
        <button type="button" onClick={() => copy('code', invite.code)} className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream">
          {copied === 'code' ? 'Copied ✓' : 'Copy code'}
        </button>
      </div>

      {/* Invite link */}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white p-3">
        <span className="min-w-0 flex-1 truncate text-sm text-ink-soft" data-testid="referral-link">{invite.link}</span>
        <button type="button" onClick={() => copy('link', invite.link)} className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600" data-testid="referral-copy-link">
          {copied === 'link' ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>

      {/* Share actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => open(`https://wa.me/?text=${encodeURIComponent(full)}`)} className="rounded-lg px-3 py-2 text-xs font-bold text-white transition" style={{ backgroundColor: '#25D366' }}>
          💬 WhatsApp
        </button>
        <a href={`mailto:?subject=${encodeURIComponent('Join me on NOSTOPS')}&body=${encodeURIComponent(`${invite.shareText}\n\n${invite.link}`)}`} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream">
          ✉️ Email
        </a>
        <button type="button" onClick={() => setQrOpen((v) => !v)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream">
          {qrOpen ? 'Hide QR' : '▦ QR'}
        </button>
        <Link href="/app/teacher/wallet" className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-cream">
          Wallet →
        </Link>
      </div>

      {qrOpen && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-cream/50 p-3">
          <div className="rounded-lg bg-white p-2">
            <QRCodeCanvas value={invite.link} size={96} level="M" marginSize={2} fgColor="#0F766E" />
          </div>
          <p className="text-xs text-muted">Scan to open your invite link. New teachers who join with your code earn you rewards on empanelment.</p>
        </div>
      )}
    </article>
  );
}
