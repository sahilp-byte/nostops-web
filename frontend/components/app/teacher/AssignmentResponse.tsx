'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// §12 — the offered teacher accepts or declines. A decline auto-reassigns the
// event to the next-nearest teacher on the engine side.
export default function AssignmentResponse({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'ACCEPT' | 'DECLINE'>('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState<'' | 'accepted' | 'declined' | 'declined_reassigned'>('');

  async function respond(action: 'ACCEPT' | 'DECLINE') {
    setErr('');
    setBusy(action);
    const res = await postBff('/bff/institutional/teacher/respond', { event_id: eventId, action });
    setBusy('');
    if (!res.ok) {
      setErr(res.data?.error || 'Could not submit your response.');
      return;
    }
    if (action === 'ACCEPT') setDone('accepted');
    else setDone(res.data?.reassigned ? 'declined_reassigned' : 'declined');
    router.refresh();
  }

  if (done === 'accepted') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800" data-testid="assignment-accepted">
        ✓ You&rsquo;ve accepted this programme. The organiser can see you&rsquo;re confirmed.
      </div>
    );
  }
  if (done === 'declined' || done === 'declined_reassigned') {
    return (
      <div className="rounded-2xl border border-line bg-cream/70 p-4 text-sm font-semibold text-ink-soft" data-testid="assignment-declined">
        You declined this programme.{' '}
        {done === 'declined_reassigned' ? 'We&rsquo;ve offered it to another teacher nearby.' : 'We&rsquo;ll keep matching it to another teacher.'}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5" data-testid="assignment-response">
      <p className="text-sm font-black text-ink">You&rsquo;ve been offered this programme</p>
      <p className="mt-1 text-xs text-ink-soft">
        Please accept to confirm you&rsquo;ll lead it. If you can&rsquo;t, decline and we&rsquo;ll offer it to the next-nearest teacher.
      </p>
      {err && <p className="mt-3 text-sm font-semibold text-red-600" data-testid="assignment-error">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button" onClick={() => respond('ACCEPT')} disabled={!!busy}
          data-testid="assignment-accept"
          className="min-h-[44px] flex-1 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >{busy === 'ACCEPT' ? 'Accepting…' : 'Accept'}</button>
        <button
          type="button" onClick={() => respond('DECLINE')} disabled={!!busy}
          data-testid="assignment-decline"
          className="min-h-[44px] flex-1 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-cream disabled:opacity-50"
        >{busy === 'DECLINE' ? 'Declining…' : 'Decline'}</button>
      </div>
    </div>
  );
}
