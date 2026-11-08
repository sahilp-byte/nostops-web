'use client';

import { useState } from 'react';

// PROMPT (Cohort Roster) — a clean per-cohort roster for the HOST of THIS
// retreat. Shows everyone who joined via this cohort link and gives simple
// "welcome" tools (broadcast message + per-person WhatsApp). This is the host's
// own retreat data only — never a cross-teacher student list.

export type RosterMember = {
  id: string;
  name: string;
  status: string;
  phone?: string;
  email?: string;
  groupSize: number;
  joinedAt?: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  reserved: { label: 'Held', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
  expired: { label: 'Expired', cls: 'bg-cream text-muted' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmt(d?: string): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ''}` : '';
}
function firstName(n: string): string {
  return (n || '').trim().split(/\s+/)[0] || n;
}

export default function CohortRoster({
  retreatTitle,
  cohort,
  via,
  shareLink,
  members,
}: {
  retreatId: string;
  retreatTitle: string;
  cohort: string;
  via: string;
  shareLink: string;
  members: RosterMember[];
}) {
  const defaultMsg = `Namaste 🙏 Welcome to “${cohort}” for ${retreatTitle}! So glad you've joined our little group. I'll share what to prepare shortly.${via ? ` — ${via}` : ''}`;
  const [msg, setMsg] = useState(defaultMsg);
  const [copied, setCopied] = useState<string | null>(null);

  const active = members.filter((m) => !['cancelled', 'expired'].includes(m.status));
  const seats = active.reduce((s, m) => s + (m.groupSize || 1), 0);
  const paid = active.filter((m) => m.status === 'paid' || m.status === 'confirmed').length;
  const held = active.filter((m) => m.status === 'reserved').length;

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setCopied(tag);
    setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1800);
  }

  const broadcastHref = `https://wa.me/?text=${encodeURIComponent(msg)}`;

  return (
    <div className="space-y-6" data-testid="cohort-roster">
      {/* Summary */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-royal/20 bg-royal-50/40 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-royal">Joined</p>
          <p className="mt-1 text-2xl font-black text-ink">{active.length}</p>
          <p className="text-[11px] text-muted">{seats} seat{seats === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Confirmed</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{paid}</p>
          <p className="text-[11px] text-muted">paid</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-muted">Awaiting</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{held}</p>
          <p className="text-[11px] text-muted">seats held</p>
        </div>
      </section>

      {/* Welcome tools */}
      <section className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5" data-testid="cohort-welcome">
        <h2 className="text-sm font-extrabold text-ink">Welcome your cohort</h2>
        <p className="mt-1 text-xs text-ink-soft">Send a warm hello to everyone who joined. Edit the note, then broadcast on WhatsApp or copy it.</p>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          maxLength={600}
          data-testid="cohort-welcome-msg"
          className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={broadcastHref} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition hover:brightness-95" data-testid="cohort-welcome-whatsapp">Welcome all on WhatsApp →</a>
          <button type="button" onClick={() => copy(msg, 'msg')} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream" data-testid="cohort-welcome-copy">{copied === 'msg' ? 'Copied ✓' : 'Copy message'}</button>
          <button type="button" onClick={() => copy(shareLink, 'link')} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft transition hover:bg-cream" data-testid="cohort-invite-copy">{copied === 'link' ? 'Link copied ✓' : 'Copy invite link'}</button>
        </div>
      </section>

      {/* Roster */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Who&apos;s joined ({active.length})</h2>
        {members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-cream/50 p-6 text-center" data-testid="cohort-roster-empty">
            <p className="text-sm font-extrabold text-ink">No one has joined yet</p>
            <p className="mt-1 text-sm text-ink-soft">Share your cohort link above — everyone who registers with it appears here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => {
              const st = STATUS[m.status] || { label: m.status, cls: 'bg-cream text-muted' };
              const cleanPhone = (m.phone || '').replace(/[^\d]/g, '');
              const waHref = cleanPhone.length >= 10 ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Namaste ${firstName(m.name)} 🙏 ${defaultMsg}`)}` : null;
              return (
                <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3" data-testid="cohort-roster-row">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-ink">{m.name}{m.groupSize > 1 ? ` · group of ${m.groupSize}` : ''}</p>
                    <p className="truncate text-xs text-muted">{[m.email, m.phone].filter(Boolean).join(' · ') || 'No contact shared'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    {m.joinedAt && <span className="text-[11px] text-muted">{fmt(m.joinedAt)}</span>}
                    {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-bold text-brand-700 transition hover:border-brand" data-testid="cohort-member-whatsapp">Welcome →</a>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
