'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

type Fields = { venue_name: string; venue_type: string; city: string; state: string; address: string; website_or_maps_url: string; google_business_url: string; description: string; capacity: string };

// PROMPT 31 — correct / enrich a submission before publication. Wired to the
// intended PATCH endpoint; disabled with an honest note until it ships. The
// original submission is preserved by the backend (provenance/history) — this
// only proposes corrected values.
export default function VenueEditForm({
  id,
  initial,
  backendReady,
}: {
  id: string;
  initial: Partial<Fields>;
  backendReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Fields>({
    venue_name: initial.venue_name || '',
    venue_type: initial.venue_type || '',
    city: initial.city || '',
    state: initial.state || '',
    address: initial.address || '',
    website_or_maps_url: initial.website_or_maps_url || '',
    google_business_url: initial.google_business_url || '',
    description: initial.description || '',
    capacity: initial.capacity || '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const inputCls = 'mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60';
  const isHttpUrl = (u: string) => /^https?:\/\//i.test((u || '').trim());

  async function runImport() {
    setImporting(true);
    setImportMsg(null);
    setPhoneHint(null);
    const res = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/import-draft`, { url: f.website_or_maps_url });
    setImporting(false);
    if (!res.ok) {
      setImportMsg((res.data && (res.data.error as string)) || 'Could not run website import.');
      return;
    }
    const proposed = (res.data?.proposed && typeof res.data.proposed === 'object' ? res.data.proposed : {}) as Record<string, string>;
    const keys = Object.keys(proposed);
    if (keys.length === 0) {
      setImportMsg((res.data?.message as string) || 'No suggestions found on that website. You can still edit manually.');
      return;
    }
    setF((p) => ({
      ...p,
      description: proposed.description ?? p.description,
      address: proposed.address ?? p.address,
    }));
    if (proposed.submitter_phone) setPhoneHint(proposed.submitter_phone);
    const applied = [proposed.description && 'description', proposed.address && 'address'].filter(Boolean).join(' & ');
    setImportMsg(`Prefilled ${applied || 'fields'} below — unverified. Review, then Save. Nothing is published until you approve.`);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await postBff(`/bff/admin/venue-submissions/${encodeURIComponent(id)}/edit`, f);
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: 'ok', text: 'Saved.' });
      router.refresh();
    } else {
      setMsg({ kind: 'err', text: (res.data && (res.data.error as string)) || 'Could not save.' });
    }
  }

  return (
    <section className="mt-8" data-testid="edit-before-publication">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black tracking-tight text-ink">Edit before publication</h2>
          <p className="mt-1 text-sm text-muted">Correct or enrich details. The original submission is always retained.</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="edit-toggle">
          {open ? 'Close' : 'Edit details'}
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-2xl border border-line bg-white p-5">
          {!backendReady && (
            <p className="mb-4 rounded-xl bg-accent/10 p-3 text-xs font-semibold text-accent-600">Editing activates once the backend moderation API is live. Your changes will save then — nothing is lost.</p>
          )}
          {/* Admin "Run website import" — reviewable prefill from the venue's own site. */}
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5" data-testid="admin-import-panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-indigo-900">✨ Run website import</p>
                <p className="mt-0.5 text-xs text-ink-soft">Pull description, address &amp; phone from the Website/Maps link above. Suggestions are unverified — they prefill the draft for you to review and Save. Nothing is published.</p>
              </div>
              <button type="button" onClick={runImport} disabled={importing || busy} className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="admin-import-run">
                {importing ? 'Reading website…' : 'Run import'}
              </button>
            </div>
            {importMsg && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-900/80" data-testid="admin-import-msg">{importMsg}</p>}
            {phoneHint && <p className="mt-2 text-xs text-ink-soft">Suggested phone (unverified): <span className="font-bold text-ink">{phoneHint}</span> — add it in the submitter details if correct.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-muted">Venue name<input value={f.venue_name} onChange={set('venue_name')} disabled={!backendReady || busy} className={inputCls} data-testid="edit-name" /></label>
            <label className="text-xs font-bold text-muted">Venue type<input value={f.venue_type} onChange={set('venue_type')} disabled={!backendReady || busy} className={inputCls} /></label>
            <label className="text-xs font-bold text-muted">City<input value={f.city} onChange={set('city')} disabled={!backendReady || busy} className={inputCls} /></label>
            <label className="text-xs font-bold text-muted">State<input value={f.state} onChange={set('state')} disabled={!backendReady || busy} className={inputCls} /></label>
            <label className="text-xs font-bold text-muted sm:col-span-2">Address<input value={f.address} onChange={set('address')} disabled={!backendReady || busy} className={inputCls} /></label>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-muted" htmlFor="edit-maps">Website or Google Maps URL</label>
              <input id="edit-maps" value={f.website_or_maps_url} onChange={set('website_or_maps_url')} disabled={!backendReady || busy} placeholder="https://maps.app.goo.gl/… or https://venue.com" className={inputCls} data-testid="edit-maps" />
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[11px] font-normal text-muted">The ordinary website or Google Maps link shown on the public venue page.</p>
                {isHttpUrl(f.website_or_maps_url) && <a href={f.website_or_maps_url.trim()} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-brand-700 hover:underline" data-testid="edit-maps-open">Open ↗</a>}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-muted" htmlFor="edit-gbp">Google Business Listing Maps URL</label>
              <input id="edit-gbp" value={f.google_business_url} onChange={set('google_business_url')} disabled={!backendReady || busy} placeholder="https://g.page/… or https://maps.google.com/?cid=…" className={inputCls} data-testid="edit-gbp" />
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[11px] font-normal text-muted">Optional — the venue&apos;s Google Business Profile / listing link, kept separate from the ordinary URL.</p>
                {isHttpUrl(f.google_business_url) && <a href={f.google_business_url.trim()} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-brand-700 hover:underline" data-testid="edit-gbp-open">Open in Google Maps ↗</a>}
              </div>
            </div>
            <label className="text-xs font-bold text-muted">Capacity<input value={f.capacity} onChange={set('capacity')} inputMode="numeric" disabled={!backendReady || busy} className={inputCls} /></label>
            <label className="text-xs font-bold text-muted sm:col-span-2">Description<textarea value={f.description} onChange={set('description')} rows={3} disabled={!backendReady || busy} className={inputCls} /></label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" disabled={!backendReady || busy} onClick={save} data-testid="edit-save" className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
              Save changes
            </button>
            {msg && <span className={`text-sm font-semibold ${msg.kind === 'ok' ? 'text-brand-700' : 'text-red-700'}`}>{msg.text}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
