'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

const input = 'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

// Invite a teacher to co-host at one of the owner's listings, agreeing the venue
// economics (owner share %). Private to owner + teacher — never public.
export default function InvitePartner({ listings }: { listings: { id: string; title: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [retreatId, setRetreatId] = useState(listings[0]?.id || '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [ownerShare, setOwnerShare] = useState('70');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const shareNum = parseInt(ownerShare, 10);
  const valid = retreatId && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && shareNum >= 0 && shareNum <= 100;

  async function send() {
    setErr(null);
    if (!valid) { setErr('Choose a listing, a valid teacher email, and a 0–100 share.'); return; }
    setBusy(true);
    const r = await sendBff('/bff/venue/partnerships', 'POST', {
      retreat_id: retreatId, partner_email: email.trim(), partner_name: name.trim(),
      model: 'co_host', owner_share_pct: shareNum, note: note.trim(),
    });
    if (!r.ok) { setBusy(false); setErr(r.data?.error || 'Could not send the invitation.'); return; }
    setBusy(false); setDone(true); setEmail(''); setName(''); setNote('');
    router.refresh();
  }

  if (listings.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand/20 bg-brand-50/40 p-4" data-testid="invite-partner">
      <button type="button" onClick={() => { setOpen((v) => !v); setDone(false); }} className="flex w-full items-center justify-between gap-3 text-left" data-testid="invite-partner-toggle">
        <span>
          <span className="block text-sm font-black text-ink">Invite a teacher to co-host</span>
          <span className="block text-[11px] text-muted">Agree the venue’s share of the seat price — kept private between you and the teacher.</span>
        </span>
        <span className="shrink-0 text-lg text-brand-700">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-brand/20 pt-3">
          <div>
            <label className="block text-xs font-bold text-muted" htmlFor="ip-listing">Listing</label>
            <select id="ip-listing" className={input} value={retreatId} onChange={(e) => setRetreatId(e.target.value)} data-testid="invite-listing">
              {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="block text-xs font-bold text-muted" htmlFor="ip-email">Teacher email</label><input id="ip-email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoCapitalize="none" placeholder="teacher@example.com" data-testid="invite-email" /></div>
            <div><label className="block text-xs font-bold text-muted" htmlFor="ip-name">Teacher name <span className="font-normal">· optional</span></label><input id="ip-name" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anjali" /></div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted" htmlFor="ip-share">Your (venue) share of the seat price: <span className="font-black text-ink">{Number.isFinite(shareNum) ? shareNum : 0}%</span></label>
            <input id="ip-share" type="range" min={0} max={100} value={Number.isFinite(shareNum) ? shareNum : 0} onChange={(e) => setOwnerShare(e.target.value)} className="mt-2 w-full accent-brand" data-testid="invite-share" />
            <p className="mt-0.5 text-[11px] text-muted">The teacher keeps the remainder after the NOSTOPS platform fee.</p>
          </div>
          <div><label className="block text-xs font-bold text-muted" htmlFor="ip-note">Note <span className="font-normal">· optional</span></label><textarea id="ip-note" className={`${input} min-h-[56px] resize-y`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Terms, what the venue provides, dates flexibility…" /></div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert">{err}</p>}
          {done && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700">✓ Invitation sent. The teacher can accept or counter your terms.</p>}
          <button type="button" onClick={send} disabled={busy || !valid} className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="invite-send">{busy ? 'Sending…' : 'Send invitation'}</button>
        </div>
      )}
    </div>
  );
}
