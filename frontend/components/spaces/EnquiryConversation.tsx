'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtTime } from '@/lib/spaces';
import type { EnquiryMessage } from '@/lib/server/spaces';

// Private, timestamped teacher ↔ owner conversation on a sent enquiry (Phase 4). Shared by owner and teacher views.
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const fd = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const KIND: Record<string, string> = { accept: '✅ Accepted in principle', discuss: '💬 Question', propose_dates: '📅 Alternative dates proposed', decline: '✖ Declined' };

export default function EnquiryConversation({ id, me, messages, closed, readOnly = false }: { id: string; me: 'teacher' | 'owner' | 'admin'; messages: EnquiryMessage[]; closed: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null);
    const r = await postBff(`/bff/spaces/enquiries/${id}/messages`, { text });
    setBusy(false);
    if (!r.ok) return setError(r.data?.error || 'Could not send your message.');
    setText('');
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="enq-conversation">
      <h2 className="text-xl font-black text-ink">💬 Conversation</h2>
      <p className="text-xs text-muted">Private between the teacher and the Space owner.</p>
      <ul className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && <li className="text-sm text-ink-soft" data-testid="enq-conv-empty">No messages yet.</li>}
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.from === me ? 'justify-end' : ''}`} data-testid="enq-conv-msg">
            <div className={`max-w-[85%] rounded-2xl border px-3 py-2 ${m.from === me ? 'border-orange-200 bg-orange-50' : 'border-line bg-cream/60'}`}>
              <p className="text-xs font-black text-ink">{m.name} <span className="font-semibold text-muted">· {m.from === 'owner' ? 'Space owner' : 'Teacher'} · {when(m.at)}</span></p>
              {KIND[m.kind] && <p className="mt-0.5 text-xs font-black text-brand-700">{KIND[m.kind]}</p>}
              <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{m.text}</p>
              {m.proposal && (
                <p className="mt-1 text-xs font-bold text-ink-soft">
                  {fd(m.proposal.start_date)}{m.proposal.end_date ? ` – ${fd(m.proposal.end_date)}` : ''}
                  {m.proposal.time_from && m.proposal.time_to ? ` · ${fmtTime(m.proposal.time_from)} – ${fmtTime(m.proposal.time_to)}` : ''}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {closed ? (
        <p className="mt-3 text-sm text-ink-soft" data-testid="enq-conv-closed">This enquiry is closed.</p>
      ) : readOnly ? (
        <p className="mt-3 text-sm text-ink-soft" data-testid="enq-conv-readonly">Administrator view: read only. Replies come from the teacher and the venue owner.</p>
      ) : (
        <div className="mt-4 flex items-end gap-2">
          <textarea value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" rows={2}
            className="min-h-[48px] flex-1 rounded-xl border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none" data-testid="enq-conv-input" />
          <button type="button" onClick={send} disabled={busy || !text.trim()} aria-label="Send message"
            className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-lg font-black text-white disabled:opacity-50" data-testid="enq-conv-send">➤</button>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
    </section>
  );
}
