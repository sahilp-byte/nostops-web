'use client';

import { useState } from 'react';
import { postBff } from '@/lib/auth-client';

function track(event: string, params: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', event, params);
  }
}

// Public waitlist / enquiry capture for a retreat (used when a retreat is sold
// out — the backend accepts name/email/phone via /retreats/{id}/waitlist).
export default function EnquiryForm({ retreatId }: { retreatId: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Please enter your name.');
    if (!email.includes('@')) return setError('Please enter a valid email.');
    setStatus('sending');
    const res = await postBff(`/bff/retreats/${retreatId}/waitlist`, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    if (res.ok) {
      setStatus('done');
      track('retreat_waitlist_join', { retreat_id: retreatId });
    } else {
      setStatus('error');
      setError((res.data as any)?.error || 'Could not submit right now. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl bg-brand-50 p-4 text-center">
        <p className="text-sm font-bold text-brand-700">You&apos;re on the waitlist 🙏</p>
        <p className="mt-1 text-xs text-ink-soft">We&apos;ll reach out if a seat opens up.</p>
      </div>
    );
  }

  const inputCls =
    'min-h-[44px] w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <input aria-label="Your name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      <input aria-label="Email" type="email" inputMode="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      <input aria-label="Phone (optional)" inputMode="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-60"
      >
        {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  );
}
