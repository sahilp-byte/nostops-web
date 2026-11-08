'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Session-aware "Reserve your seat" CTA for the PUBLIC retreat page (which is
// server-rendered / ISR-cached). Login state is resolved on the client via
// GET /bff/auth/whoami. Signed-in seekers go straight to the in-app reserve
// flow; anonymous visitors go through /login and return to the same reserve
// page afterwards. Defaults to the logged-out target until the probe resolves.
export default function RetreatReserveCta({
  retreatId,
  label,
  className,
  cohort,
  via,
  mode,
}: {
  retreatId: string;
  label: string;
  className?: string;
  cohort?: string;
  via?: string;
  mode?: 'group' | 'individual';
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/bff/auth/whoami', { signal: ac.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuthed(!!d?.authenticated))
      .catch(() => setAuthed(false));
    return () => ac.abort();
  }, []);

  const q = new URLSearchParams();
  if (cohort) q.set('cohort', cohort);
  if (via) q.set('via', via);
  if (mode) q.set('mode', mode);
  const qs = q.toString();
  const appPath = `/app/retreats/${retreatId}${qs ? `?${qs}` : ''}`;
  const target = authed ? appPath : `/login?next=${encodeURIComponent(appPath)}`;

  return (
    <Link href={target} className={className} data-testid="reserve-cta">
      {label}
    </Link>
  );
}
