'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Owner response to an enquiry (Phase 4 · screen 2). Accepting in principle is NOT a booking.
const OPTIONS = [
  { k: 'accept', t: 'Accept in principle', d: 'Agree in principle and continue the discussion. This is not a confirmed booking.' },
  { k: 'discuss', t: 'Discuss Further', d: 'Ask a question or clarify dates, requirements or terms.' },
  { k: 'propose_dates', t: 'Propose Alternative Dates', d: 'Suggest different dates or timings.' },
  { k: 'decline', t: 'Decline Request', d: 'You are not able to host this programme (a reason is required).' },
];

export default function OwnerResponsePanel({ id, closed, admin = false }: { id: string; closed: boolean; admin?: boolean }) {
  const heading = admin ? '↩ Response (administrator, on behalf of the venue owner)' : '↩ Your Response';
  const router = useRouter();
  const [action, setAction] = useState('accept');
  const [message, setMessage] = useState('');
  const [p, setP] = useState({ proposed_start: '', proposed_end: '', proposed_time_from: '', proposed_time_to: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  async function send() {
    setMsg(null);
    if ((action === 'decline' || action === 'discuss') && !message.trim()) return setMsg({ ok: false, text: action === 'decline' ? 'Add a reason for declining.' : 'Write your question or message.' });
    if (action === 'propose_dates' && !p.proposed_start) return setMsg({ ok: false, text: 'Choose the alternative start date.' });
    if (action === 'decline' && !window.confirm('Decline this enquiry? The enquiry will be closed.')) return;
    setBusy(true);
    const r = await postBff(`/bff/spaces/enquiries/${id}/respond`, { action, message, ...(action === 'propose_dates' ? p : {}) });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data?.error || 'Could not send your response.' });
    setMessage('');
    setP({ proposed_start: '', proposed_end: '', proposed_time_from: '', proposed_time_to: '' });
    setMsg({ ok: true, text: r.data.teacher_notified ? 'Response sent. The teacher has been notified by email.' : 'Response saved. The teacher will see it in My Enquiries.' });
    setTimeout(() => setMsg(null), 6000);
    router.refresh();
  }

  if (closed) {
    return (
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="owner-response-closed">
        <h2 className="text-xl font-black text-ink">{heading}</h2>
        <p className="mt-2 text-sm text-ink-soft">This enquiry is closed. No further responses can be sent.</p>
      </section>
    );
  }

  const input = 'mt-1 w-full min-h-[44px] rounded-xl border border-line px-3 text-sm';
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="owner-response">
      <h2 className="text-xl font-black text-ink">{heading}</h2>
      <div className="mt-3 space-y-2" role="radiogroup">
        {OPTIONS.map((o) => (
          <label key={o.k} className={`flex min-h-[56px] cursor-pointer items-start gap-3 rounded-xl border p-3 ${action === o.k ? (o.k === 'decline' ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50') : 'border-line'}`} data-testid={`resp-${o.k}`}>
            <input type="radio" name="resp" className="mt-1 h-4 w-4" checked={action === o.k} onChange={() => setAction(o.k)} />
            <span><span className="block text-sm font-black text-ink">{o.t}</span><span className="block text-xs text-ink-soft">{o.d}</span></span>
          </label>
        ))}
      </div>
      {action === 'propose_dates' && (
        <div className="mt-3 grid grid-cols-2 gap-3" data-testid="resp-proposal">
          <label className="text-xs font-bold text-ink">Start date<input type="date" min={today} className={input} value={p.proposed_start} onChange={(e) => setP({ ...p, proposed_start: e.target.value })} data-testid="resp-start" /></label>
          <label className="text-xs font-bold text-ink">End date (optional)<input type="date" min={p.proposed_start || today} className={input} value={p.proposed_end} onChange={(e) => setP({ ...p, proposed_end: e.target.value })} data-testid="resp-end" /></label>
          <label className="text-xs font-bold text-ink">From (optional)<input type="time" className={input} value={p.proposed_time_from} onChange={(e) => setP({ ...p, proposed_time_from: e.target.value })} data-testid="resp-time-from" /></label>
          <label className="text-xs font-bold text-ink">To (optional)<input type="time" className={input} value={p.proposed_time_to} onChange={(e) => setP({ ...p, proposed_time_to: e.target.value })} data-testid="resp-time-to" /></label>
        </div>
      )}
      <label className="mt-3 block text-xs font-bold text-ink">
        {action === 'decline' ? 'Reason for declining (required)' : action === 'discuss' ? 'Your question (required)' : 'Message to the teacher (optional)'}
        <textarea className="mt-1 w-full min-h-[80px] rounded-xl border border-line p-3 text-sm" maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} data-testid="resp-message" />
      </label>
      <button type="button" onClick={send} disabled={busy} className="mt-3 min-h-[52px] w-full rounded-xl bg-accent text-base font-black text-white shadow disabled:opacity-60" data-testid="resp-send">
        {busy ? 'Sending…' : '✓ Send Response'}
      </button>
      <p className="mt-2 text-xs text-muted">Accepting in principle is not a confirmed booking. The programme proceeds only after the teacher and the venue owner mutually agree.</p>
      {msg && <p className={`mt-2 text-sm font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status" data-testid="resp-msg">{msg.text}</p>}
    </section>
  );
}
