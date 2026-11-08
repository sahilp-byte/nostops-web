'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// §1 — compact 1-tap Accept / Decline for a PROPOSED offer, rendered inline on
// the teacher's Institutional Events list (no need to open the event first).
// A decline auto-reassigns the event to the next-best teacher on the engine side.
export default function AssignmentResponseInline({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'' | 'ACCEPT' | 'DECLINE'>('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState<'' | 'accepted' | 'declined'>('');

  async function respond(action: 'ACCEPT' | 'DECLINE') {
    setErr('');
    setBusy(action);
    const res = await postBff('/bff/institutional/teacher/respond', { event_id: eventId, action });
    setBusy('');
    if (!res.ok) {
      setErr(res.data?.error || 'Could not submit your response.');
      return;
    }
    setDone(action === 'ACCEPT' ? 'accepted' : 'declined');
    router.refresh();
  }

  if (done === 'accepted') {
    return (
      <p className="text-sm font-bold text-emerald-700" data-testid={`inline-accepted-${eventId}`}>
        ✓ Accepted — the organiser can see you&rsquo;re confirmed.
      </p>
    );
  }
  if (done === 'declined') {
    return (
      <p className="text-sm font-semibold text-ink-soft" data-testid={`inline-declined-${eventId}`}>
        You declined — we&rsquo;ll offer it to another teacher nearby.
      </p>
    );
  }

  return (
    <div data-testid={`inline-respond-${eventId}`}>
      <p className="text-xs font-bold text-amber-800">You&rsquo;ve been offered this programme — accept to confirm.</p>
      {err && <p className="mt-1 text-xs font-semibold text-red-600" data-testid={`inline-error-${eventId}`}>{err}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button" onClick={() => respond('ACCEPT')} disabled={!!busy}
          data-testid={`inline-accept-${eventId}`}
          className="min-h-[44px] flex-1 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >{busy === 'ACCEPT' ? 'Accepting…' : 'Accept'}</button>
        <button
          type="button" onClick={() => respond('DECLINE')} disabled={!!busy}
          data-testid={`inline-decline-${eventId}`}
          className="min-h-[44px] flex-1 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-cream disabled:opacity-50"
        >{busy === 'DECLINE' ? 'Declining…' : 'Decline'}</button>
      </div>
    </div>
  );
}
