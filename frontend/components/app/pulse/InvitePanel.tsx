'use client';

import { useEffect, useState } from 'react';
import { postBff } from '@/lib/auth-client';

type Invite = { token: string; status: string; created_at: number; accepted_at: number | null };

const INTRO = "You've been invited to Teacher Pulse — a conversation among yoga teachers about the profession, the market and the future of Yoga. Join us:";

// Generate + share teacher-to-teacher invitations. No monetary rewards — this is
// a conversation/market-listening mechanism.
export default function InvitePanel({ initialInvites }: { initialInvites: Invite[] }) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [origin, setOrigin] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const linkFor = (token: string) => `${origin}/teacher-pulse/join/${token}`;

  async function create() {
    if (busy) return;
    setBusy(true);
    const r = await postBff<{ token?: string }>('/bff/pulse/invites');
    setBusy(false);
    if (r.ok && r.data.token) {
      setInvites((prev) => [{ token: r.data.token as string, status: 'PENDING', created_at: Date.now(), accepted_at: null }, ...prev]);
    }
  }

  async function copy(token: string) {
    try { await navigator.clipboard.writeText(linkFor(token)); setCopied(token); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  }

  function share(token: string) {
    const url = linkFor(token);
    if (navigator.share) navigator.share({ title: 'Teacher Pulse', text: INTRO, url }).catch(() => {});
    else copy(token);
  }

  const accepted = invites.filter((i) => i.status === 'ACCEPTED').length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-50 to-cream p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">Invite a fellow teacher</h2>
        <p className="mt-1 text-sm text-ink-soft">Grow the conversation. Generate a link and share it with a yoga teacher you trust.</p>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          data-testid="pulse-create-invite"
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? 'Creating…' : '+ Create an invitation link'}
        </button>
      </div>

      {invites.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-ink">Your invitations</h3>
            <span className="text-xs font-semibold text-muted">{accepted} accepted · {invites.length} sent</span>
          </div>
          <div className="mt-4 space-y-3">
            {invites.map((i) => {
              const url = linkFor(i.token);
              const waText = encodeURIComponent(`${INTRO} ${url}`);
              const mail = `mailto:?subject=${encodeURIComponent('Join me on NOSTOPS Teacher Pulse')}&body=${waText}`;
              return (
                <div key={i.token} className="rounded-xl border border-line p-3" data-testid="pulse-invite-row">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${i.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-cream text-muted'}`}>
                      {i.status === 'ACCEPTED' ? '✓ Accepted' : 'Awaiting acceptance'}
                    </span>
                  </div>
                  <p className="mt-2 truncate rounded-lg bg-cream px-3 py-2 text-xs text-ink-soft">{url || '…'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => copy(i.token)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream">{copied === i.token ? '✓ Copied' : 'Copy link'}</button>
                    <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream">WhatsApp</a>
                    <a href={mail} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream">Email</a>
                    <button type="button" onClick={() => share(i.token)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream">Share…</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
