'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Policy V2 — the teacher asks for the Council interaction once every free-path
// item is met. It opens a case for a person to handle; it never grants anything.
export default function RequestCouncilInteraction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function go() {
    setBusy(true);
    setMsg(null);
    const r = await postBff('/bff/empanelment/apply');
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: 'Request sent. A Council member will contact you for the interaction.' });
      router.refresh();
    } else setMsg({ ok: false, text: r.data?.error || 'Could not send your request.' });
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={go} disabled={busy} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60 sm:w-auto" data-testid="merit-apply">
        {busy ? 'Sending…' : 'Ask for the Council interaction →'}
      </button>
      {msg && <p className={`mt-2 text-sm font-semibold ${msg.ok ? 'text-brand-700' : 'text-red-600'}`} role="status">{msg.text}</p>}
    </div>
  );
}
