'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

export default function AccountMenu({
  name,
  personaLabel,
  initial,
  avatarUrl,
}: {
  name: string;
  personaLabel: string;
  initial: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function signOut() {
    setBusy(true);
    await postBff('/bff/auth/logout');
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 transition hover:bg-cream"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" data-testid="header-avatar" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-black text-white">{initial}</span>
        )}
        <span className="hidden text-sm font-semibold text-ink sm:inline">{name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-bold text-ink">{name}</p>
            <p className="text-xs font-semibold text-brand-700">{personaLabel}</p>
          </div>
          <Link
            role="menuitem"
            href="/app/settings"
            onClick={() => setOpen(false)}
            className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-soft transition hover:bg-cream"
          >
            Settings
          </Link>
          <Link
            role="menuitem"
            href="/"
            onClick={() => setOpen(false)}
            data-testid="account-menu-website"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-soft transition hover:bg-cream"
          >
            NOSTOPS website
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            disabled={busy}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink-soft transition hover:bg-cream disabled:opacity-60"
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
