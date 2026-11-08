'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Session-aware header CTA. The public header is server-rendered / cacheable, so
// login state is resolved on the client via GET /bff/auth/whoami (reads the
// httpOnly cookie server-side). Defaults to the logged-OUT view until the probe
// resolves, so anonymous visitors never see a "Dashboard" flash.
// On the homepage only, "Login" is a light button with a teal outline and "Sign Up" is saffron.
export default function HeaderAuthCta() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const path = usePathname() || '/';
  // Homepage and NOSTOPS Spaces use the teal-outline Login + saffron Sign Up pair from the designs.
  const home = path === '/' || path === '/spaces' || path.startsWith('/spaces/');
  const solid = home ? 'bg-[#EF7D22] hover:bg-[#D86A12]' : 'bg-brand hover:bg-brand-600';

  useEffect(() => {
    const ac = new AbortController();
    fetch('/bff/auth/whoami', { signal: ac.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuthed(!!d?.authenticated))
      .catch(() => setAuthed(false));
    return () => ac.abort();
  }, []);

  if (authed) {
    return (
      <Link
        href="/app"
        data-testid="header-dashboard"
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors sm:px-4 ${solid}`}
      >
        Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        data-testid="header-signin"
        className={
          home
            ? 'hidden rounded-lg border-2 border-[#0E4D52] bg-white px-4 py-1.5 text-sm font-bold text-[#0E3D3B] transition-colors hover:bg-[#EEF5F4] sm:inline-block'
            : 'hidden rounded-lg px-3 py-2 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50 sm:inline-block'
        }
      >
        {home ? 'Login' : 'Log in'}
      </Link>
      <Link
        href="/signup"
        data-testid="header-signup"
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors sm:px-4 ${solid}`}
      >
        {home ? 'Sign Up' : 'Sign up'}
      </Link>
    </>
  );
}
