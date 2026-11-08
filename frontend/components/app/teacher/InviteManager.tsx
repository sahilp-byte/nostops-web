'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { postBff, sendBff } from '@/lib/auth-client';

// PROMPT 18 — GROUP BOOKING INVITATION SYSTEM.
// The host builds a guest list, shares the invitation link (copy / QR / WhatsApp
// / email), marks who's been invited, and watches the aggregate cohort funnel:
// Invited → Opened → Registered → Booked → Paid → Confirmed. Every participant
// registers independently via the public retreat link.

export type InviteItem = {
  id: string;
  name: string;
  whatsapp?: string;
  note?: string;
  status: string;
  createdAt?: string;
  invitedAt?: string;
};

type PhoneStage = 'booked' | 'paid';

const normPhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);

export default function InviteManager({
  retreatId,
  retreatTitle,
  isPublic,
  invites,
  phoneStages,
  funnel,
}: {
  retreatId: string;
  retreatTitle: string;
  isPublic: boolean;
  invites: InviteItem[];
  phoneStages: Record<string, PhoneStage>;
  funnel: { invited: number; booked: number; paid: number; confirmed: number; seatsTotal: number };
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const link = origin ? `${origin}/retreats/${retreatId}` : '';
  const inviteMsg = `You're invited to join me for ${retreatTitle} Reserve your seat here: ${link}`;

  const stages = useMemo(
    () => [
      { key: 'invited', label: 'Invited', n: funnel.invited as number | null, cap: 'links shared' },
      { key: 'opened', label: 'Opened', n: null as number | null, cap: 'shown as people book' },
      { key: 'registered', label: 'Registered', n: null as number | null, cap: 'shown as people book' },
      { key: 'booked', label: 'Booked', n: funnel.booked as number | null, cap: 'seats held' },
      { key: 'paid', label: 'Paid', n: funnel.paid as number | null, cap: 'seats paid' },
      { key: 'confirmed', label: 'Confirmed', n: funnel.confirmed as number | null, cap: 'in cohort' },
    ],
    [funnel],
  );

  function stageOf(inv: InviteItem): { label: string; cls: string } {
    const key = normPhone(inv.whatsapp);
    const ps = key.length >= 10 ? phoneStages[key] : undefined;
    if (ps === 'paid') return { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' };
    if (ps === 'booked') return { label: 'Booked', cls: 'bg-royal-50 text-royal' };
    if (inv.status === 'invited' || inv.invitedAt) return { label: 'Invited', cls: 'bg-amber-50 text-amber-700' };
    return { label: 'Added', cls: 'bg-cream text-muted' };
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function shareNative() {
    try {
      await navigator.share({ title: retreatTitle, text: `Join me for ${retreatTitle}`, url: link });
    } catch {
      /* user dismissed */
    }
  }

  async function addInvitee() {
    const nm = name.trim();
    if (nm.length < 2) { setErr('Enter a name.'); return; }
    if (phone.replace(/\D/g, '').length < 8) { setErr('Add their WhatsApp number (with country code) so they get the invite.'); return; }
    if (invites.some((i) => normPhone(i.whatsapp) && normPhone(i.whatsapp) === normPhone(phone))) {
      setErr('That number is already on your guest list.');
      return;
    }
    setBusy(true);
    setErr('');
    const res = await postBff(`/bff/retreats/${retreatId}/invites`, { invitees: [{ name: nm, whatsapp: phone.trim(), note: note.trim() }] });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not add.'); return; }
    setName(''); setPhone(''); setNote('');
    router.refresh();
  }

  async function markInvited(inviteId: string) {
    await postBff(`/bff/retreats/${retreatId}/invites/${inviteId}/mark-invited`);
    router.refresh();
  }

  async function remove(inviteId: string) {
    await sendBff(`/bff/retreats/${retreatId}/invites/${inviteId}`, 'DELETE');
    router.refresh();
  }

  return (
    <section data-testid="invite-manager" className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">✉️</span>
        <h2 className="text-lg font-black tracking-tight text-ink">Invite your group</h2>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Share one link — everyone reserves their own seat. Track who&apos;s in as the cohort fills.</p>

      {/* Share the invitation link */}
      {isPublic ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted">Invitation link</label>
            <div className="mt-1 flex items-center gap-2">
              <input readOnly value={link} className="min-w-0 flex-1 rounded-xl border border-line bg-cream/50 px-3 py-2.5 text-sm text-ink-soft outline-none" data-testid="invite-link" />
              <button type="button" onClick={copy} className="shrink-0 rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="invite-copy">{copied ? 'Copied ✓' : 'Copy'}</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(inviteMsg)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition hover:brightness-95" data-testid="invite-whatsapp">WhatsApp</a>
              <a href={`mailto:?subject=${encodeURIComponent(`Join me for ${retreatTitle}`)}&body=${encodeURIComponent(inviteMsg)}`} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream" data-testid="invite-email">Email</a>
              {canShare && <button type="button" onClick={shareNative} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream" data-testid="invite-share">Share…</button>}
            </div>
          </div>
          {link && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-white p-3" data-testid="invite-qr">
              <QRCodeSVG value={link} size={96} bgColor="#ffffff" fgColor="#0f172a" level="M" />
              <span className="mt-1 text-[10px] font-semibold text-muted">Scan to open</span>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/50 px-4 py-3 text-sm text-ink-soft">Publish this retreat to get a shareable invitation link. You can still build your guest list below now.</p>
      )}

      {/* Aggregate funnel */}
      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-wide text-muted">Cohort progress</p>
        <div className="mt-2 flex items-stretch gap-1.5 overflow-x-auto pb-1" data-testid="invite-funnel">
          {stages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className={`min-w-[84px] rounded-xl border px-3 py-2 text-center ${s.n === null ? 'border-line/60 bg-cream/40' : 'border-brand/20 bg-brand-50/40'}`} data-testid={`funnel-${s.key}`}>
                <p className={`text-lg font-black ${s.n === null ? 'text-muted' : 'text-ink'}`}>{s.n === null ? '—' : s.n}</p>
                <p className="text-[11px] font-bold text-ink-soft">{s.label}</p>
                <p className="text-[10px] leading-tight text-muted">{s.cap}</p>
              </div>
              {i < stages.length - 1 && <span className="text-muted">→</span>}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Confirmed counts against {funnel.seatsTotal} seats. Opened &amp; Registered aren&apos;t individually tracked — Booked onward is real.</p>
      </div>

      {/* Add invitee */}
      <div className="mt-5 rounded-xl border border-line bg-cream/30 p-3.5" data-testid="invite-add">
        <p className="text-xs font-black uppercase tracking-wide text-muted">Add to your guest list</p>
        <p className="mt-0.5 text-[11px] text-muted">One student at a time — name + their WhatsApp so they get a personal invite. No phonebook upload.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_1fr_1.4fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={120} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" data-testid="invite-name" />
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 20))} placeholder="WhatsApp (+91…)" className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" data-testid="invite-phone" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={200} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" data-testid="invite-note" />
          <button type="button" onClick={addInvitee} disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, '').length < 8} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50" data-testid="invite-add-btn">{busy ? 'Adding…' : 'Add'}</button>
        </div>
        {err && <p className="mt-1.5 text-xs font-semibold text-red-600" data-testid="invite-error">{err}</p>}
      </div>

      {/* Guest list */}
      {invites.length > 0 && (
        <div className="mt-4 space-y-2" data-testid="invite-list">
          {invites.map((inv) => {
            const st = stageOf(inv);
            const wa = normPhone(inv.whatsapp);
            const waHref = wa.length >= 10 ? `https://wa.me/${inv.whatsapp?.replace(/[^\d]/g, '')}?text=${encodeURIComponent(inviteMsg)}` : null;
            const invited = inv.status === 'invited' || !!inv.invitedAt;
            return (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-2.5" data-testid="invite-row">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{inv.name}</p>
                  <p className="truncate text-xs text-muted">{[inv.whatsapp, inv.note].filter(Boolean).join(' · ') || 'No contact'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                  {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-bold text-brand-700 transition hover:border-brand" data-testid="invite-row-whatsapp">WA</a>}
                  {!invited && <button type="button" onClick={() => markInvited(inv.id)} className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink-soft transition hover:bg-cream" data-testid="invite-mark">Mark invited</button>}
                  <button type="button" onClick={() => remove(inv.id)} className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink-soft transition hover:border-red-300 hover:text-red-600" data-testid="invite-remove">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
