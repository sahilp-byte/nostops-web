'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Broadcast composer (PHASE 10). Sends an in-app announcement through the
// admin-guarded BFF → POST /api/admin/broadcast. A confirm step guards against
// accidental sends to a live audience.

const TARGETS: { value: string; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'seeker', label: 'Seekers' },
  { value: 'hr', label: 'Workplace leads' },
  { value: 'guru', label: 'Council gurus' },
  { value: 'coordinator', label: 'City coordinators' },
];

export default function BroadcastComposer() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('');
  const [link, setLink] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ deliveredTo: number } | null>(null);

  const valid = title.trim().length >= 3 && body.trim().length >= 3;
  const targetLabel = TARGETS.find((t) => t.value === target)?.label ?? 'Everyone';

  async function send() {
    setError(null);
    setBusy(true);
    const payload: Record<string, unknown> = { title: title.trim(), body: body.trim() };
    if (target) payload.target_role = target;
    if (link.trim()) payload.link = link.trim();
    const res = await postBff('/bff/admin/broadcast', payload);
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not send the broadcast.'); return; }
    setSent({ deliveredTo: Number(res.data?.deliveredTo) || 0 });
    setConfirming(false);
    setTitle(''); setBody(''); setLink(''); setTarget('');
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="broadcast-composer">
      {sent && (
        <div data-testid="broadcast-sent" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          ✓ Broadcast sent{sent.deliveredTo ? ` to ${sent.deliveredTo} recipients` : ''}.
        </div>
      )}
      <label className="block text-xs font-bold uppercase tracking-wide text-muted">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. New feature: Availability calendar" data-testid="broadcast-title" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />

      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted">Message</label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} placeholder="What do you want to announce?" data-testid="broadcast-body" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-muted">Audience</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} data-testid="broadcast-target" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand">
            {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-muted">Link (optional)</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/app/… or https://…" className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

      <div className="mt-4">
        {confirming ? (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <p className="text-sm font-bold text-ink">Send this announcement to <span className="text-brand-700">{targetLabel}</span>?</p>
            <p className="mt-1 text-xs text-muted">This delivers an in-app notification immediately.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={send} disabled={busy} data-testid="broadcast-confirm" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{busy ? 'Sending…' : 'Yes, send now'}</button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => { setSent(null); setConfirming(true); }} disabled={!valid} data-testid="broadcast-send" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
            📣 Send broadcast
          </button>
        )}
      </div>
    </div>
  );
}
