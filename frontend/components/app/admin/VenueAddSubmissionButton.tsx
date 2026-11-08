'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';

// Admin "Add submission" — manually add a venue that reached out by email/phone
// into the review queue. Writes to the same venue_submissions store the console
// reads, so it appears immediately in whichever environment the admin is in.
const VENUE_TYPES = [
  { v: 'yoga_school', label: 'Yoga school' },
  { v: 'retreat_center', label: 'Retreat center' },
  { v: 'studio', label: 'Studio' },
  { v: 'ashram', label: 'Ashram' },
  { v: 'hotel_resort', label: 'Hotel / resort' },
  { v: 'community_hall', label: 'Community hall' },
  { v: 'other', label: 'Other' },
];

type Form = {
  venue_name: string;
  city: string;
  state: string;
  country: string;
  venue_type: string;
  website_or_maps_url: string;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string;
  address: string;
  description: string;
  source_note: string;
};

const EMPTY: Form = {
  venue_name: '',
  city: '',
  state: '',
  country: '',
  venue_type: 'yoga_school',
  website_or_maps_url: '',
  submitter_name: '',
  submitter_email: '',
  submitter_phone: '',
  address: '',
  description: '',
  source_note: 'Received via email request.',
};

export default function VenueAddSubmissionButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<Form>(EMPTY);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function close() {
    if (busy) return;
    setOpen(false);
    setErr(null);
    setF(EMPTY);
  }

  async function submit() {
    setErr(null);
    if (f.venue_name.trim().length < 2 || f.city.trim().length < 1) {
      setErr('Venue name and city are required.');
      return;
    }
    setBusy(true);
    const res = await sendBff<{ deduped?: boolean; error?: string }>('/bff/admin/venue-submissions/add', 'POST', f);
    setBusy(false);
    if (!res.ok) {
      setErr(res.data?.error || 'Could not add submission.');
      return;
    }
    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="add-submission-open"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-brand bg-white px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50"
      >
        + Add submission
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Add venue submission"
          onClick={close}
        >
          <div
            className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black tracking-tight text-ink">Add a venue submission</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  For venues that contacted you by email or phone. It enters the review queue as a new submission.
                </p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="text-2xl leading-none text-muted hover:text-ink">×</button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-bold text-ink-soft">
                Venue name *
                <input value={f.venue_name} onChange={set('venue_name')} data-testid="add-venue-name"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="e.g. Nirvana Yoga School" />
              </label>
              <label className="text-xs font-bold text-ink-soft">
                City *
                <input value={f.city} onChange={set('city')} data-testid="add-venue-city"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="e.g. Rishikesh" />
              </label>
              <label className="text-xs font-bold text-ink-soft">
                State / Province
                <input value={f.state} onChange={set('state')}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="e.g. Uttarakhand / Bali" />
              </label>
              <label className="text-xs font-bold text-ink-soft">
                Country
                <input value={f.country} onChange={set('country')} data-testid="add-venue-country"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="e.g. India, Indonesia" />
              </label>
              <label className="text-xs font-bold text-ink-soft">
                Venue type
                <select value={f.venue_type} onChange={set('venue_type')}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
                  {VENUE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-ink-soft">
                Website / maps URL
                <input value={f.website_or_maps_url} onChange={set('website_or_maps_url')}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="https://…" />
              </label>
              <label className="sm:col-span-2 text-xs font-bold text-ink-soft">
                Address
                <input value={f.address} onChange={set('address')}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="Street, area, city" />
              </label>
              <label className="text-xs font-bold text-ink-soft">
                Contact name
                <input value={f.submitter_name} onChange={set('submitter_name')}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="Who reached out" />
              </label>
              <label className="text-xs font-bold text-ink-soft">
                Contact email
                <input value={f.submitter_email} onChange={set('submitter_email')} type="email"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="name@example.com" />
              </label>
              <label className="text-xs font-bold text-ink-soft">
                Contact phone
                <input value={f.submitter_phone} onChange={set('submitter_phone')}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="+91 …" />
              </label>
              <label className="sm:col-span-2 text-xs font-bold text-ink-soft">
                Notes / description
                <textarea value={f.description} onChange={set('description')} rows={3}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" placeholder="Anything from their message worth recording" />
              </label>
              <label className="sm:col-span-2 text-xs font-bold text-ink-soft">
                Source note (internal)
                <input value={f.source_note} onChange={set('source_note')}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink" />
              </label>
            </div>

            {err && <p className="mt-3 text-sm font-semibold text-red-700" aria-live="polite" data-testid="add-venue-error">{err}</p>}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={close} disabled={busy}
                className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={busy} data-testid="add-venue-submit"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                {busy ? 'Adding…' : 'Add to queue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
