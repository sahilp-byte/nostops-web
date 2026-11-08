'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// When arriving via an invite link (?invite=TOKEN), silently accept it once and
// show a warm welcome. Ensures membership + links inviter → invitee.
export default function AcceptInvite() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('invite');
  const [welcome, setWelcome] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    (async () => {
      await postBff(`/bff/pulse/invites/${token}/accept`);
      setWelcome(true);
      router.replace('/app/pulse');
    })();
  }, [token, router]);

  if (!welcome) return null;
  return (
    <div className="rounded-2xl border border-brand/25 bg-gradient-to-br from-brand-50 to-cream p-5 text-center" data-testid="pulse-welcome">
      <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-2xl">🙏</span>
      <h2 className="mt-2 text-lg font-black tracking-tight text-ink">Welcome to Teacher Pulse</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">You&apos;re in. Start a conversation or listen and learn from fellow teachers.</p>
      <button type="button" onClick={() => setWelcome(false)} className="mt-3 text-xs font-bold text-brand-700">Got it</button>
    </div>
  );
}
