'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';

const METHODS = [
  { key: 'business_email', label: 'Business email at the venue’s own domain' },
  { key: 'website_domain', label: 'I manage the venue’s website' },
  { key: 'google_business', label: 'I manage its Google Business Profile' },
  { key: 'business_document', label: 'Business registration or licence' },
  { key: 'authorization_letter', label: 'Authorisation letter from the owner / management' },
  { key: 'other', label: 'Other evidence' },
];
const RELATIONSHIPS = ['Owner', 'Manager', 'Authorised representative'];
const input = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none';
type Doc = { name: string; type: string; base64: string };

function readFile(f: File): Promise<Doc> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ name: f.name, type: f.type, base64: String(r.result) });
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export default function ClaimVenueForm({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [relationship, setRelationship] = useState('Owner');
  const [methods, setMethods] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [gbp, setGbp] = useState('');
  const [note, setNote] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const toggle = (k: string) => setMethods((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));
  async function onFiles(list: FileList | null) {
    setError(null);
    const files = Array.from(list || []).slice(0, 3);
    if (files.some((f) => f.size > 4 * 1024 * 1024)) return setError('Each document must be 4 MB or smaller.');
    setDocs(await Promise.all(files.map(readFile)));
  }
  async function submit() {
    setError(null);
    if (!methods.length) return setError('Choose at least one type of evidence.');
    setBusy(true);
    const { ok, data } = await postBff('/bff/venue/claims', { venue_id: venueId, relationship, evidence_methods: methods, business_email: email, website, google_business_url: gbp, note, documents: docs });
    setBusy(false);
    if (!ok) return setError(data?.error || 'Could not submit the claim.');
    setDone(data?.claim?.status === 'disputed' ? 'disputed' : 'review');
  }

  if (done) {
    return (
      <div className="card p-6" data-testid="claim-submitted">
        <h2 className="text-lg font-black text-ink">Claim submitted for {venueName}</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {done === 'disputed'
            ? 'This venue already has an owner or another open claim, so our team will review both and contact you.'
            : 'Our team will review your evidence. You can edit the listing only after an administrator approves your claim.'}
        </p>
        <Link href="/app/venue" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">Go to Venue Studio</Link>
      </div>
    );
  }
  return (
    <div className="card space-y-5 p-6" data-testid="claim-form">
      <div>
        <label className="text-sm font-bold text-ink" htmlFor="cl-rel">Your relationship to the venue</label>
        <select id="cl-rel" className={input} value={relationship} onChange={(e) => setRelationship(e.target.value)} data-testid="claim-relationship">
          {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="text-sm font-bold text-ink">Evidence you can provide (choose one or more)</legend>
        <div className="mt-2 space-y-2">
          {METHODS.map((m) => (
            <label key={m.key} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm text-ink-soft">
              <input type="checkbox" checked={methods.includes(m.key)} onChange={() => toggle(m.key)} data-testid={`claim-method-${m.key}`} />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="text-sm font-bold text-ink" htmlFor="cl-email">Business email</label><input id="cl-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourvenue.com" data-testid="claim-email" /></div>
        <div><label className="text-sm font-bold text-ink" htmlFor="cl-web">Venue website</label><input id="cl-web" className={input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" data-testid="claim-website" /></div>
      </div>
      <div><label className="text-sm font-bold text-ink" htmlFor="cl-gbp">Google Business Profile link</label><input id="cl-gbp" className={input} value={gbp} onChange={(e) => setGbp(e.target.value)} placeholder="https://maps.google.com/…" data-testid="claim-gbp" /></div>
      <div>
        <label className="text-sm font-bold text-ink" htmlFor="cl-docs">Supporting documents (PDF or image, up to 3, max 4 MB each)</label>
        <input id="cl-docs" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="mt-2 block text-sm" onChange={(e) => onFiles(e.target.files)} data-testid="claim-docs" />
        <p className="mt-1 text-xs text-muted">Documents are private and seen only by NOSTOPS administrators.</p>
      </div>
      <div><label className="text-sm font-bold text-ink" htmlFor="cl-note">Anything else our team should know?</label><textarea id="cl-note" rows={3} className={input} value={note} onChange={(e) => setNote(e.target.value)} data-testid="claim-note" /></div>
      {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
      <p className="text-xs text-muted">Every claim is reviewed by an administrator. Evidence supports the decision; it does not grant ownership on its own.</p>
      <button type="button" onClick={submit} disabled={busy} className="inline-flex min-h-11 items-center rounded-xl bg-orange-700 px-5 text-sm font-bold text-white hover:bg-orange-800 disabled:opacity-60" data-testid="claim-submit">
        {busy ? 'Submitting…' : 'Submit claim for review'}
      </button>
    </div>
  );
}
