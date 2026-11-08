'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Phase 6 — administrator cancels a registration with a recorded reason (paid places are refunded in full).
export default function AdminRegCancel({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    if (reason.trim().length < 10) return setErr('Please give a reason of at least 10 characters.');
    setBusy(true); setErr(null);
    const r = await postBff(`/bff/spaces/registrations/${id}/admin-cancel`, { reason });
    setBusy(false);
    if (!r.ok) return setErr(r.data?.error || 'Could not cancel.');
    router.refresh();
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] rounded-lg border border-red-300 px-3 text-xs font-black text-red-700" data-testid={`admin-reg-cancel-${id}`}>Cancel</button>;
  return (
    <div className="w-56 space-y-1">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (10+ characters)" className="block min-h-[44px] w-full rounded-lg border border-line px-2 text-xs" data-testid={`admin-reg-reason-${id}`} />
      <button type="button" disabled={busy} onClick={go} className="min-h-[44px] rounded-lg bg-red-700 px-3 text-xs font-black text-white" data-testid={`admin-reg-confirm-${id}`}>Confirm cancel</button>
      {err && <p className="text-xs font-semibold text-red-700" role="alert">{err}</p>}
    </div>
  );
}
