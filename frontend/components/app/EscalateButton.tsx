'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

const CATEGORIES = [
  { key: 'EXCEPTION', label: 'Exception / something went wrong' },
  { key: 'COMPLAINT', label: 'Complaint' },
  { key: 'TEACHER_ISSUE', label: 'Teacher issue' },
  { key: 'VENUE_PROBLEM', label: 'Venue problem' },
  { key: 'COMMERCIAL', label: 'Commercial / pricing' },
  { key: 'QUALITY_ISSUE', label: 'Quality issue' },
  { key: 'OTHER', label: 'Something else' },
];

export default function EscalateButton({ eventId }: { eventId?: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('EXCEPTION');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (message.trim().length < 3) { setErr('Please describe the issue.'); return; }
    setBusy(true);
    const res = await postBff('/bff/institutional/support/escalate', { category, message: message.trim(), event_id: eventId || null });
    setBusy(false);
    if (!res.ok) { setErr(res.data?.error || 'Could not send your request.'); return; }
    setDone(res.data?.reference || 'sent');
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} data-testid="escalate-open"
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream"
      >
        🆘 Need help?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" data-testid="escalate-modal">
            {done ? (
              <div className="py-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-2xl">✓</div>
                <h3 className="mt-3 text-lg font-black text-ink">We&rsquo;re on it</h3>
                <p className="mt-1 text-sm text-ink-soft">Our team has received your request. Reference <span className="font-bold text-ink">{done}</span>.</p>
                <button type="button" onClick={() => { setOpen(false); setDone(null); setMessage(''); }} className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-brand-700">Done</button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-ink">Contact NOSTOPS</h3>
                    <p className="mt-0.5 text-xs text-muted">A human will review exceptions, complaints, teacher/venue, commercial & quality issues.</p>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-xl text-muted">×</button>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="esc-cat" className="mb-1 block text-xs font-bold text-ink-soft">What&rsquo;s this about?</label>
                    <select id="esc-cat" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="escalate-category"
                      className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand">
                      {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="esc-msg" className="mb-1 block text-xs font-bold text-ink-soft">Details</label>
                    <textarea id="esc-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} data-testid="escalate-message"
                      placeholder="Tell us what happened…" className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand" />
                  </div>
                </div>
                {err && <p className="mt-2 text-sm font-semibold text-red-600" data-testid="escalate-error">{err}</p>}
                <button type="button" onClick={submit} disabled={busy} data-testid="escalate-submit"
                  className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50">
                  {busy ? 'Sending…' : 'Send to NOSTOPS'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
