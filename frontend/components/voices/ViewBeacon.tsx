'use client';

import { useEffect } from 'react';

// Fire-and-forget public view counter. Runs once per mount on the public
// article page. Best-effort; never blocks or affects the reader.
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    try {
      fetch('/bff/voices/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ slug }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, [slug]);
  return null;
}
