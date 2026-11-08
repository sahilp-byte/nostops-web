'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

const inputCls =
  'w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand';

export default function ParticipantAuthForm({
  eventSlug = null,
  sessionId = null,
  heading = 'Register with your email',
  sub = "We'll email you a secure one-time link to confirm — no password needed.",
}: {
  eventSlug?: string | null;
  sessionId?: string | null;
  heading?: string;
  sub?: string;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const clean = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    const res = await postBff('/bff/institutional/participant/request', {
      email: clean,
      name: name.trim() || null,
      event_slug: eventSlug,
      session_id: sessionId,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.data?.error || 'Could not send the link. Please try again.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-center" data-testid="participant-check-email">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">📧</div>
        <h3 className="mt-3 text-lg font-black text-ink">Check your email</h3>
        <p className="mt-1 text-sm text-ink-soft">
          We&apos;ve sent a secure sign-in link to <span className="font-bold text-ink">{email.trim()}</span>.
          Open it on this device to confirm your registration. The link expires in 20 minutes.
        </p>
        <button
          type="button"
          onClick={() => { setSent(false); }}
          className="mt-4 text-sm font-bold text-brand-700 hover:underline"
          data-testid="participant-resend"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6" data-testid="participant-auth-form">
      <h3 className="text-lg font-black text-ink">{heading}</h3>
      <p className="mt-1 text-sm text-muted">{sub}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="p-name" className="mb-1 block text-xs font-bold text-ink-soft">Your name <span className="font-normal text-muted">(optional)</span></label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav Sharma" className={inputCls} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="p-email" className="mb-1 block text-xs font-bold text-ink-soft">Email address</label>
          <input
            id="p-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
            autoComplete="email"
            required
            data-testid="participant-email"
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-red-600" data-testid="participant-auth-error">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        data-testid="participant-send-link"
      >
        {busy ? 'Sending link…' : 'Email me a secure link'}
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        By continuing you agree to NOSTOPS&apos; <a href="/terms" className="underline">Terms</a> and{' '}
        <a href="/privacy" className="underline">Privacy Policy</a>.
      </p>
    </form>
  );
}
