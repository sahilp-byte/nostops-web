'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import PublicSubmitForm, { type SubmitInitial } from '@/components/venues/PublicSubmitForm';
import VenueShareCard from '@/components/venues/VenueShareCard';

const label = 'block text-sm font-extrabold text-ink';
const input = 'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

// Friendly, owner-facing view of the internal moderation status.
type Tone = 'amber' | 'green' | 'red' | 'slate';
function statusMeta(status?: string): { label: string; tone: Tone; blurb: string; editable: boolean; live?: boolean } {
  switch ((status || 'submitted').toLowerCase()) {
    case 'submitted':
    case 'resubmitted':
    case 'in_review':
      return { label: 'In review', tone: 'amber', blurb: 'Our team is reviewing your venue for suitability. We\u2019ll reach out if we need anything — you can keep editing below in the meantime.', editable: true };
    case 'needs_info':
    case 'needs_information':
    case 'changes_requested':
      return { label: 'Needs a little more info', tone: 'amber', blurb: 'We\u2019ve asked for a detail or two. Please update the form below and save to send it back for review.', editable: true };
    case 'approved':
      return { label: 'Approved', tone: 'green', blurb: 'Great news — your venue has been approved. You can still update it below: changes are reviewed by our team before they replace your listing.', editable: true };
    case 'published':
      return { label: 'Published · Live', tone: 'green', blurb: 'Your venue is live and discoverable on NOSTOPS. You can update it below — your live listing stays as it is until our team approves the changes.', editable: true, live: true };
    case 'rejected':
      return { label: 'Not approved', tone: 'red', blurb: 'This submission wasn\u2019t approved for listing. If you have questions, reach out to our team on WhatsApp or by email.', editable: false };
    case 'duplicate':
      return { label: 'Already listed', tone: 'slate', blurb: 'This venue is already in the NOSTOPS database, so we\u2019ve closed this submission.', editable: false };
    case 'archived':
      return { label: 'Archived', tone: 'slate', blurb: 'This submission has been archived. Request a fresh link or contact us if you\u2019d like to reopen it.', editable: false };
    case 'hidden':
      return { label: 'Not currently visible', tone: 'slate', blurb: 'This venue is temporarily hidden from NOSTOPS. Contact our team for details.', editable: false };
    default:
      return { label: 'In review', tone: 'amber', blurb: 'Our team is reviewing your venue.', editable: true };
  }
}
const TONE: Record<Tone, string> = {
  amber: 'border-amber-300 bg-amber-50 text-amber-900',
  green: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  red: 'border-red-300 bg-red-50 text-red-900',
  slate: 'border-line bg-cream text-ink',
};
const DOT: Record<Tone, string> = { amber: 'bg-amber-500', green: 'bg-emerald-500', red: 'bg-red-500', slate: 'bg-slate-400' };

function StatusBanner({ status }: { status?: string }) {
  const m = statusMeta(status);
  return (
    <div className={`rounded-2xl border p-5 ${TONE[m.tone]}`} data-testid="submission-status">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">Submission status</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT[m.tone]}`} />
        <span className="text-xl font-black tracking-tight" data-testid="submission-status-label">{m.label}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed opacity-90">{m.blurb}</p>
      {m.live && <Link href="/venues" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline">See it on NOSTOPS →</Link>}
    </div>
  );
}

// Request-a-link form (no token yet): email + CAPTCHA -> emails a magic link.
function RequestLinkForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [capImg, setCapImg] = useState('');
  const [capToken, setCapToken] = useState('');
  const [capAns, setCapAns] = useState('');
  const [capLoading, setCapLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function loadCaptcha() {
    setCapLoading(true); setCapAns('');
    try {
      const res = await fetch('/bff/venue/captcha', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      setCapImg(d?.image || ''); setCapToken(d?.token || '');
    } catch { setCapImg(''); setCapToken(''); } finally { setCapLoading(false); }
  }
  useEffect(() => { loadCaptcha(); }, []);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function submit() {
    setErr(null);
    if (!emailOk) { setErr('Enter the email you used when you submitted the venue.'); return; }
    if (capAns.trim().length < 4 || !capToken) { setErr('Please type the characters shown in the verification image.'); return; }
    setBusy(true);
    const r = await sendBff('/bff/venue/public-submissions/request-edit', 'POST', { email: email.trim(), company, captcha_token: capToken, captcha_answer: capAns.trim() });
    setBusy(false);
    if (!r.ok) { setErr((r.data as { error?: string })?.error || 'Could not send the link. Please try again.'); loadCaptcha(); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-brand/20 bg-brand-50/50 p-8 text-center" data-testid="edit-link-sent">
        <p className="text-4xl" aria-hidden>📩</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-ink">Check your email</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">If we have a venue submission for that email, we&apos;ve sent a secure link to edit it. The link expires in 45 minutes.</p>
        <Link href="/venues" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">Back to venues</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-7" data-testid="request-edit-form">
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="re-company">Company (leave empty)</label>
        <input id="re-company" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div>
        <label className={label} htmlFor="re-email">Your email *</label>
        <input id="re-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} placeholder="The email you submitted with" data-testid="re-email" />
        <p className="mt-1.5 text-xs text-muted">We&apos;ll email a secure, one-time link to edit your venue submission — no account needed.</p>
      </div>
      <div className="border-t border-line pt-5">
        <label className={label} htmlFor="re-captcha">Verification *</label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex h-[64px] w-[176px] items-center justify-center overflow-hidden rounded-xl border border-line bg-cream" aria-hidden>
            {capLoading ? <span className="text-xs font-bold text-muted">Loading…</span> : capImg
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={capImg} alt="" className="h-full w-full object-contain" data-testid="captcha-image" />
              : <span className="text-xs font-bold text-red-500">Unavailable</span>}
          </div>
          <button type="button" onClick={loadCaptcha} disabled={capLoading} className="min-h-[44px] rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50">↻ New code</button>
          <input id="re-captcha" className={`${input} mt-0 w-[160px] uppercase tracking-[0.3em]`} value={capAns} onChange={(e) => setCapAns(e.target.value.replace(/\s/g, '').slice(0, 8))} maxLength={8} autoComplete="off" spellCheck={false} placeholder="CODE" data-testid="captcha-input" />
        </div>
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert" data-testid="re-error">{err}</p>}
      <button type="button" onClick={submit} disabled={busy || !emailOk} className="w-full min-h-[48px] rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="re-submit">
        {busy ? 'Sending…' : 'Email me an edit link'}
      </button>
    </div>
  );
}

export default function SubmitEditClient({ tier2Preview = false }: { tier2Preview?: boolean }) {
  const params = useSearchParams();
  const token = (params.get('token') || '').trim();
  const [state, setState] = useState<'loading' | 'form' | 'invalid'>(token ? 'loading' : 'form');
  const [initial, setInitial] = useState<SubmitInitial | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!token || loaded.current) return;
    loaded.current = true;
    (async () => {
      try {
        const res = await fetch(`/bff/venue/public-submissions/by-token?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d?.submission) { setInitial(d.submission as SubmitInitial); setState('form'); }
        else setState('invalid');
      } catch { setState('invalid'); }
    })();
  }, [token]);

  if (token && state === 'loading') {
    return <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm font-bold text-muted" data-testid="edit-loading">Opening your submission…</p>;
  }
  if (token && state === 'invalid') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center" data-testid="edit-invalid">
          <p className="text-3xl" aria-hidden>⏳</p>
          <h2 className="mt-2 text-lg font-black text-ink">This edit link has expired</h2>
          <p className="mt-1 text-sm text-ink-soft">Edit links work once and expire after 45 minutes. Request a fresh one below.</p>
        </div>
        <RequestLinkForm />
      </div>
    );
  }
  if (token && state === 'form' && initial) {
    const m = statusMeta(initial.status);
    return (
      <div className="space-y-6">
        <StatusBanner status={initial.status} />
        {m.live && initial.venue_name && (
          <VenueShareCard name={initial.venue_name} city={initial.city} />
        )}
        {m.editable && (
          <Link href={`/venues/submit/thank-you?e=${encodeURIComponent(token)}`} className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-50/50 p-4 transition hover:border-brand" data-testid="open-toolkit-link">
            <span>
              <span className="block text-sm font-black text-ink">🌱 Grow with NOSTOPS — your free venue toolkit</span>
              <span className="block text-xs text-ink-soft">Website widgets, invitation note, WhatsApp sharing, QR code and your invitation counts.</span>
            </span>
            <span aria-hidden className="text-brand-700">→</span>
          </Link>
        )}
        {m.editable ? (
          <PublicSubmitForm mode="edit" token={token} initial={initial} tier2Preview={tier2Preview} />
        ) : (
          <div className="rounded-2xl border border-line bg-white p-6 text-center" data-testid="edit-closed">
            <p className="text-sm text-ink-soft">This submission can no longer be edited from here.</p>
            <Link href="/venues" className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">Back to venues</Link>
          </div>
        )}
      </div>
    );
  }
  return <RequestLinkForm />;
}
