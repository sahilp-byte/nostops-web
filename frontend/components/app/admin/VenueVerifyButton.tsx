'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Admin verify toggle — sets a "NOSTOPS Verified" trust flag that surfaces on
// the venue's public pages (directory + retreat listings).
export default function VenueVerifyButton({
  id,
  name,
  city,
  venuePartnerId,
  verified: initialVerified,
}: {
  id: string;
  name: string;
  city?: string;
  venuePartnerId?: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setErr(null);
    const next = !verified;
    const res = await sendBff<{ error?: string }>('/bff/admin/venue-verify', 'POST', { id, verified: next, name, city, venuePartnerId });
    if (!res.ok) {
      setErr(res.data?.error || 'Could not update.');
    } else {
      setVerified(next);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        data-testid="verify-venue"
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
          verified ? 'border border-brand/30 bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-brand text-white hover:bg-brand-600'
        }`}
      >
        {busy ? 'Saving…' : verified ? '✓ Verified · tap to remove' : '🛡️ Mark Verified'}
      </button>
      {err && <p className="text-xs font-semibold text-red-600" aria-live="polite">{err}</p>}
    </div>
  );
}
