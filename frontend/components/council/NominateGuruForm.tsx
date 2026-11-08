'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';

// Public "Nominate a Guru" form (signed-in members only — the page renders it only with a
// session; the BFF and backend check again). The nominator's name/email come from the session.
const INPUT =
  'w-full min-h-[44px] rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';
const LABEL = 'block text-sm font-bold text-ink';
const HINT = 'mt-1 text-xs text-muted';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

const EMPTY = {
  nominee_name: '',
  nominee_lineage: '',
  nominee_city: '',
  nominee_decades: '',
  citation: '',
  references: '',
  nominee_email: '',
  nominee_phone: '',
  relationship: '',
  nominator_phone: '',
};

type Field = keyof typeof EMPTY;

export default function NominateGuruForm({ nominator }: { nominator: { name: string; email: string } }) {
  const [f, setF] = useState(EMPTY);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentFor, setSentFor] = useState<string | null>(null);

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function problem(): string | null {
    if (f.nominee_name.trim().length < 2) return "Please enter the Guru's name.";
    if (f.citation.trim().length < 30) return 'Please tell us, in at least 30 characters, why this Guru belongs on the Council.';
    if (f.nominee_email.trim() && !EMAIL_RE.test(f.nominee_email.trim())) return "Please check the Guru's email address, or leave it empty.";
    if (!confirm) return 'Please tick the confirmation box.';
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = problem();
    if (p) {
      setError(p);
      return;
    }
    setError(null);
    setBusy(true);
    const res = await postBff('/bff/nominations', { ...f, nominee_decades: f.nominee_decades ? Number(f.nominee_decades) : null, confirm });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) {
      setError(res.data?.error || 'Could not send your nomination. Please try again.');
      return;
    }
    setSentFor(f.nominee_name.trim());
    setF(EMPTY);
    setConfirm(false);
  }

  if (sentFor) {
    return (
      <div data-testid="nominate-success" className="card p-6 md:p-8">
        <p className="text-3xl" aria-hidden>🙏</p>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Thank you. Your nomination is in.</h2>
        <p className="mt-2 text-muted">
          We&apos;ve received your nomination of <strong className="text-ink">{sentFor}</strong> and sent a confirmation to {nominator.email}.
          The NOSTOPS team reviews it first; you can follow every step in your dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app/nominations" data-testid="nominate-track-link" className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
            Follow my nominations
          </Link>
          <button type="button" onClick={() => setSentFor(null)} data-testid="nominate-another" className="min-h-[44px] rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream">
            Nominate another Guru
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate data-testid="nominate-form" className="card space-y-8 p-6 md:p-8">
      <fieldset className="space-y-4">
        <legend className="text-lg font-extrabold tracking-tight">About the Guru</legend>
        <div>
          <label htmlFor="nominee_name" className={LABEL}>Guru&apos;s name <span className="text-red-600">*</span></label>
          <input id="nominee_name" data-testid="nominee-name" value={f.nominee_name} onChange={set('nominee_name')} maxLength={120} className={`${INPUT} mt-1.5`} placeholder="e.g. Acharya Jane Doe" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nominee_lineage" className={LABEL}>Lineage or tradition</label>
            <input id="nominee_lineage" data-testid="nominee-lineage" value={f.nominee_lineage} onChange={set('nominee_lineage')} maxLength={200} className={`${INPUT} mt-1.5`} placeholder="e.g. Kaivalyadhama, Lonavala" />
          </div>
          <div>
            <label htmlFor="nominee_city" className={LABEL}>City</label>
            <input id="nominee_city" data-testid="nominee-city" value={f.nominee_city} onChange={set('nominee_city')} maxLength={100} className={`${INPUT} mt-1.5`} placeholder="Where they teach" />
          </div>
        </div>
        <div className="sm:max-w-xs">
          <label htmlFor="nominee_decades" className={LABEL}>Decades of practice</label>
          <select id="nominee_decades" data-testid="nominee-decades" value={f.nominee_decades} onChange={set('nominee_decades')} className={`${INPUT} mt-1.5`}>
            <option value="">Not sure</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d === 10 ? '10 or more decades' : `${d} decade${d > 1 ? 's' : ''}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="citation" className={LABEL}>Why does this Guru belong on the Council? <span className="text-red-600">*</span></label>
          <textarea id="citation" data-testid="nominee-citation" value={f.citation} onChange={set('citation')} maxLength={1200} rows={5} className={`${INPUT} mt-1.5`} placeholder="Their teaching, lineage, conduct and the students or communities they serve." required />
          <p className={HINT}>{f.citation.trim().length < 30 ? `At least 30 characters (${f.citation.trim().length}/30)` : `${f.citation.length}/1200`}</p>
        </div>
        <div>
          <label htmlFor="references" className={LABEL}>Books, talks, ashrams or notable students</label>
          <textarea id="references" data-testid="nominee-references" value={f.references} onChange={set('references')} maxLength={600} rows={3} className={`${INPUT} mt-1.5`} placeholder="Optional. Anything that helps the Council learn about their work." />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-extrabold tracking-tight">The Guru&apos;s contact details <span className="text-sm font-semibold text-muted">(optional)</span></legend>
        <p className="-mt-2 rounded-xl bg-cream px-4 py-3 text-sm text-ink-soft">
          🔒 Seen only by the NOSTOPS team, and used only to invite the Guru if the Council approves. Never shown on the website.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nominee_email" className={LABEL}>Guru&apos;s email</label>
            <input id="nominee_email" type="email" data-testid="nominee-email" value={f.nominee_email} onChange={set('nominee_email')} maxLength={160} className={`${INPUT} mt-1.5`} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="nominee_phone" className={LABEL}>Guru&apos;s phone</label>
            <input id="nominee_phone" type="tel" data-testid="nominee-phone" value={f.nominee_phone} onChange={set('nominee_phone')} maxLength={20} className={`${INPUT} mt-1.5`} autoComplete="off" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-extrabold tracking-tight">About you</legend>
        <p className="-mt-2 text-sm text-muted" data-testid="nominator-identity">
          Nominating as <strong className="text-ink">{nominator.name}</strong>{nominator.email ? ` (${nominator.email})` : ''}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="relationship" className={LABEL}>How do you know the Guru?</label>
            <input id="relationship" data-testid="nominator-relationship" value={f.relationship} onChange={set('relationship')} maxLength={140} className={`${INPUT} mt-1.5`} placeholder="e.g. Their student for 8 years" />
          </div>
          <div>
            <label htmlFor="nominator_phone" className={LABEL}>Your phone</label>
            <input id="nominator_phone" type="tel" data-testid="nominator-phone" value={f.nominator_phone} onChange={set('nominator_phone')} maxLength={20} className={`${INPUT} mt-1.5`} placeholder="Optional" />
          </div>
        </div>
      </fieldset>

      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" data-testid="nominate-confirm" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand" />
        <span>
          These details are true to the best of my knowledge. I understand NOSTOPS may contact the Guru about this
          nomination, and that nothing about them is published unless they agree.
        </span>
      </label>

      {error && (
        <p role="alert" data-testid="nominate-error" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
      )}

      <button type="submit" disabled={busy} data-testid="nominate-submit" className="min-h-[48px] w-full rounded-xl bg-brand px-6 py-3 text-base font-bold text-white transition hover:bg-brand-600 disabled:opacity-60 sm:w-auto">
        {busy ? 'Sending…' : 'Send nomination'}
      </button>
    </form>
  );
}
