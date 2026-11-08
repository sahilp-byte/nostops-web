'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Venue "List Your Venue" enquiry form (Tier 2 AI onboarding · Tier 3 Marketing
// & PR). REUSES the existing Ask AI Guru support pipeline — it creates a
// category:"Venue" support request via /bff/guru/support (stateless HMAC CSRF),
// so enquiries land in the SAME admin Support Queue and trigger the same
// notification email. No new backend, no payment, no invented price.

type Interest = 'ai-onboarding' | 'marketing-pr' | 'general';

const INTEREST_LABEL: Record<Interest, string> = {
  'ai-onboarding': 'AI-Assisted Venue Onboarding (Tier 2)',
  'marketing-pr': 'Retreat Marketing & PR Support (Tier 3)',
  general: 'General venue listing enquiry',
};

const input =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function VenueEnquiryForm({ defaultInterest = 'general' }: { defaultInterest?: Interest }) {
  const tokenRef = useRef<string | null>(null);
  const [interest, setInterest] = useState<Interest>(defaultInterest);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/bff/guru/token', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((d) => {
        if (active) tokenRef.current = d?.token || null;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Please enter a valid email so we can reach you.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please tell us a little more about what you need (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    try {
      if (!tokenRef.current) {
        const tr = await fetch('/bff/guru/token', { credentials: 'same-origin' });
        tokenRef.current = (await tr.json())?.token || null;
      }
      const label = INTEREST_LABEL[interest];
      const issue = `Interest: ${label}\nVenue / organisation: ${venueName.trim() || '—'}\nCity: ${city.trim() || '—'}\n\n${message.trim()}`;
      const res = await fetch('/bff/guru/support', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-guru-csrf': tokenRef.current || '' },
        body: JSON.stringify({
          category: 'Venue',
          issue,
          email: email.trim(),
          name: name.trim() || undefined,
          summary: `Venue enquiry — ${label}`,
          context: { page_type: 'list_your_venue', route: '/list-your-venue/enquire' },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Could not send your enquiry. Please try again.');
        return;
      }
      setRef(data?.ref || 'received');
    } catch {
      setError('Could not reach us just now. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (ref) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6" data-testid="venue-enquiry-success">
        <p className="text-lg font-black text-emerald-800">Thank you — your enquiry is in. 🌿</p>
        <p className="mt-2 text-sm text-emerald-900/80">
          A NOSTOPS team member will review it and reply to <strong>{email.trim()}</strong>.
          {ref !== 'received' && <> Your reference is <strong>{ref}</strong>.</>}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/venues/submit" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
            List your venue free →
          </Link>
          <Link href="/list-your-venue" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-brand/40 bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50">
            Back to tiers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 shadow-sm" data-testid="venue-enquiry-form" noValidate>
      <div className="grid gap-4">
        <div>
          <label htmlFor="ve-interest" className="mb-1 block text-xs font-bold text-muted">I&apos;m interested in</label>
          <select id="ve-interest" className={input} value={interest} onChange={(e) => setInterest(e.target.value as Interest)} data-testid="ve-interest">
            <option value="ai-onboarding">AI-Assisted Venue Onboarding (Tier 2) — coming soon</option>
            <option value="marketing-pr">Retreat Marketing &amp; PR Support (Tier 3)</option>
            <option value="general">General venue listing enquiry</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ve-name" className="mb-1 block text-xs font-bold text-muted">Your name</label>
            <input id="ve-name" className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
          </div>
          <div>
            <label htmlFor="ve-email" className="mb-1 block text-xs font-bold text-muted">Email <span className="text-brand-700">*</span></label>
            <input id="ve-email" type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} data-testid="ve-email" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ve-venue" className="mb-1 block text-xs font-bold text-muted">Venue / organisation</label>
            <input id="ve-venue" className={input} value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={160} />
          </div>
          <div>
            <label htmlFor="ve-city" className="mb-1 block text-xs font-bold text-muted">City</label>
            <input id="ve-city" className={input} value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </div>
        </div>

        <div>
          <label htmlFor="ve-message" className="mb-1 block text-xs font-bold text-muted">How can we help? <span className="text-brand-700">*</span></label>
          <textarea id="ve-message" required rows={5} className={input} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} placeholder="Tell us about your venue or retreat and what you're looking for." data-testid="ve-message" />
        </div>

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700" role="alert">{error}</p>}

        <button type="submit" disabled={submitting} className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60" data-testid="ve-submit">
          {submitting ? 'Sending…' : 'Send enquiry'}
        </button>
        <p className="text-center text-xs text-muted">No payment and no obligation. We&apos;ll reply by email.</p>
      </div>
    </form>
  );
}
