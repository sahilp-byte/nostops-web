'use client';
// "Create Again" (Prompt 3 §12) / "Renew Programme" (§15) — duplicate a prior
// event into a new DRAFT (date/time cleared) and open it in the creator.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

export default function CreateAgainButton({
  eventId,
  label = '↻ Create again',
  variant = 'ghost',
}: {
  eventId: string;
  label?: string;
  variant?: 'ghost' | 'primary';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setBusy(true); setErr('');
    try {
      const res = await postBff(`/bff/institutional/events/${eventId}/duplicate`);
      if (!res.ok) { setErr(res.data?.error || 'Could not duplicate.'); setBusy(false); return; }
      router.push(`/app/org/events/new?event=${res.data.event.event_id}`);
    } catch { setErr('Something went wrong.'); setBusy(false); }
  }

  const cls = variant === 'primary'
    ? 'inline-flex min-h-[44px] items-center rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50'
    : 'inline-flex min-h-[44px] items-center rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50';

  return (
    <div className="flex flex-col items-start">
      <button type="button" onClick={go} disabled={busy} data-testid={`create-again-${eventId}`} className={cls}>
        {busy ? 'Creating…' : label}
      </button>
      {err && <span className="mt-1 text-[11px] text-rose-600">{err}</span>}
    </div>
  );
}
