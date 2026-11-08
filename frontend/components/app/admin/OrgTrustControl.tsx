'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// §10 — admin organisation verification control (approved manual exception).
// Verifying an organisation unlocks search-indexable public event pages for it.
export default function OrgTrustControl({ organisationId, current }: { organisationId: string; current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function set(trust_state: 'VERIFIED' | 'UNVERIFIED') {
    setErr('');
    setBusy(trust_state);
    const res = await sendBff(`/bff/institutional/admin/organisations/${encodeURIComponent(organisationId)}/trust`, 'PATCH', { trust_state });
    setBusy('');
    if (!res.ok) { setErr(res.data?.error || 'Could not update.'); return; }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1" data-testid={`org-trust-${organisationId}`}>
      {current !== 'VERIFIED'
        ? <button type="button" disabled={!!busy} onClick={() => set('VERIFIED')} data-testid={`org-verify-${organisationId}`}
            className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50">
            {busy === 'VERIFIED' ? '…' : 'Verify'}
          </button>
        : <button type="button" disabled={!!busy} onClick={() => set('UNVERIFIED')} data-testid={`org-unverify-${organisationId}`}
            className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
            {busy === 'UNVERIFIED' ? '…' : 'Unverify'}
          </button>}
      {err && <span className="text-[10px] font-semibold text-red-600">{err}</span>}
    </div>
  );
}
