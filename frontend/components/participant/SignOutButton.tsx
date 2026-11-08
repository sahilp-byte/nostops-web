'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function out() {
    setBusy(true);
    await postBff('/bff/institutional/participant/logout');
    // Full reload on purpose: clears any client state left from the signed-out session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/participant';
  }
  return (
    <button
      type="button"
      onClick={out}
      disabled={busy}
      className="text-sm font-bold text-brand-700 hover:underline disabled:opacity-50"
      data-testid="participant-signout"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
