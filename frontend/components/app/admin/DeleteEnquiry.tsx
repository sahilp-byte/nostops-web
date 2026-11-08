'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Permanent delete for spam / test enquiries — detail page only, behind a
// "type DELETE" step. Nothing is kept afterwards.
export default function DeleteEnquiry({ id, enquiryRef }: { id: string; enquiryRef: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const remove = async () => {
    setBusy(true);
    setErr('');
    const { ok, data } = await sendBff<{ error?: string }>(`/bff/admin/org-enquiries/${encodeURIComponent(id)}`, 'DELETE', { confirm: typed });
    if (ok) {
      router.replace('/app/admin/org-enquiries');
      router.refresh();
      return;
    }
    setBusy(false);
    setErr(data?.error || 'Could not delete. Please try again.');
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-5" data-testid="enq-delete">
      <p className="text-xs font-black uppercase tracking-wide text-red-700">Delete enquiry</p>
      <p className="mt-1 text-sm text-ink-soft">For spam or test enquiries. This permanently removes {enquiryRef} and cannot be undone.</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
          data-testid="enq-delete-open"
        >
          Delete this enquiry…
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-semibold text-ink" htmlFor="enq-delete-confirm">
            Type <span className="font-black">DELETE</span> to confirm
          </label>
          <input
            id="enq-delete-confirm"
            value={typed}
            onChange={(ev) => setTyped(ev.target.value)}
            autoComplete="off"
            maxLength={20}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm text-ink focus:border-red-600 focus:outline-none"
            data-testid="enq-delete-input"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={typed !== 'DELETE' || busy}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-40"
              data-testid="enq-delete-confirm"
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setTyped(''); setErr(''); }}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-bold text-muted transition hover:bg-cream"
              data-testid="enq-delete-cancel"
            >
              Cancel
            </button>
          </div>
          {err && <p className="text-sm font-semibold text-red-700" data-testid="enq-delete-error">{err}</p>}
        </div>
      )}
    </div>
  );
}
