'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { AuthCard } from '@/components/auth/ui';
import { AUTH_NEXT_KEY, safeNextPath } from '@/lib/safe-next';

// Emergent Google/Apple return handler. The session_id arrives in the URL
// fragment (not sent to the server), so we read it client-side, exchange it via
// the BFF, then scrub the URL. The session_id is never logged or persisted.
// The post-login target saved by SocialSignIn is re-validated before use.
export default function EmergentCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Completing sign-in…');
  // Run the one-time exchange once, even when React (dev Strict Mode) mounts twice.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      let next = '/app';
      try {
        next = safeNextPath(sessionStorage.getItem(AUTH_NEXT_KEY));
        sessionStorage.removeItem(AUTH_NEXT_KEY);
      } catch { /* storage blocked */ }
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const sessionId = hash.get('session_id') || query.get('session_id');
      window.history.replaceState({}, document.title, '/emergent-callback');

      if (!sessionId) {
        setStatus('No sign-in session was returned. Please try again.');
        setTimeout(() => router.replace('/login'), 1500);
        return;
      }
      const { ok } = await postBff('/bff/auth/session', { session_id: sessionId });
      if (ok) {
        // Full navigation so no cached client-side redirect can bounce back to /login.
        window.location.assign(next);
      } else {
        setStatus('Sign-in failed. Redirecting…');
        setTimeout(() => router.replace('/login'), 1500);
      }
    })();
  }, [router]);

  return (
    <AuthCard title="Signing you in">
      <p className="text-sm text-muted" role="status">{status}</p>
    </AuthCard>
  );
}
