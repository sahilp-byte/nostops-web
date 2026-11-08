'use client';
import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

/** International identity verification (Didit). Begins a session server-side
 *  (payment must be confirmed first). Surfaces the engine's response honestly. */
export default function DiditStart() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setMsg(null);
    // Ensure an application exists, then start the Didit session.
    await postBff('/bff/teacher/verification/create');
    const res = await postBff<{ url?: string; error?: string }>('/bff/teacher/verification/didit-session');
    setBusy(false);
    if (res.ok && res.data?.url) {
      window.location.href = res.data.url;
      return;
    }
    setMsg(res.data?.error || 'Identity verification will begin once your payment is confirmed.');
  }

  return (
    <div>
      <button
        type="button"
        onClick={begin}
        disabled={busy}
        className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {busy ? 'Starting…' : 'Begin identity verification'}
      </button>
      {msg && <p className="mt-2 text-sm text-amber-700">{msg}</p>}
    </div>
  );
}
