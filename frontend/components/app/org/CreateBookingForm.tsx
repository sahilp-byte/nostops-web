'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postBff } from '@/lib/auth-client';
import BatchShare from '@/components/app/org/BatchShare';

const inputCls =
  'mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

const COHORTS = [
  { id: 'company', label: 'Company', emoji: '🏢' },
  { id: 'education', label: 'Educational', emoji: '🎓' },
  { id: 'startup_network', label: 'Startup', emoji: '🚀' },
];

const DIMS = [
  { id: 'body', label: 'Body 💪' },
  { id: 'mind', label: 'Mind 🧠' },
  { id: 'special_needs', label: 'Special needs ❤️' },
];

type SessionDate = { date: string; time: string };

export default function CreateBookingForm() {
  const [cohort, setCohort] = useState('company');
  const [company, setCompany] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [title, setTitle] = useState('');
  const [dims, setDims] = useState<string[]>([]);
  const [dates, setDates] = useState<SessionDate[]>([]);
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('07:00');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ token: string; companyName: string; venue: string; capacity: number } | null>(null);

  const toggleDim = (d: string) => setDims((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  const addDate = () => {
    if (!dateInput) return;
    setDates((p) => [...p, { date: dateInput, time: timeInput }]);
    setDateInput('');
  };
  const removeDate = (i: number) => setDates((p) => p.filter((_, idx) => idx !== i));

  async function submit() {
    setErr(null);
    if (company.trim().length < 2) return setErr('Enter the organisation name.');
    if (venue.trim().length < 2) return setErr('Enter the venue.');
    const cap = parseInt(capacity, 10);
    if (!cap || cap < 18 || cap > 40) return setErr('Batch capacity must be between 18 and 40.');
    if (dates.length === 0) return setErr('Add at least one session date.');
    if (dims.length === 0) return setErr('Select at least one focus area.');

    setBusy(true);
    const r = await postBff('/bff/org/bookings', {
      company_name: company.trim(),
      venue: venue.trim(),
      venue_address: address.trim(),
      venue_city: city.trim(),
      batch_capacity: cap,
      session_dates: dates,
      yoga_dimensions: dims,
      course_title: title.trim(),
      cohort_type: cohort,
    });
    setBusy(false);
    if (r.ok && r.data?.invite_link_token) {
      setDone({ token: r.data.invite_link_token, companyName: company.trim(), venue: venue.trim(), capacity: cap });
    } else {
      setErr(r.data?.error || 'Could not create the batch.');
    }
  }

  if (done) {
    return (
      <section className="rounded-2xl border border-brand/25 bg-brand-50/50 p-6" data-testid="batch-created">
        <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-brand text-2xl text-white">✓</span>
        <h2 className="mt-3 text-lg font-black text-ink">Batch created 🎉</h2>
        <p className="mt-1 text-sm text-ink-soft">Share this link with your team. As more colleagues enroll, the group discount deepens automatically.</p>
        <div className="mt-4">
          <BatchShare token={done.token} companyName={done.companyName} venue={done.venue} capacity={done.capacity} />
        </div>
        <div className="mt-4 flex gap-2">
          <Link href="/app" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Go to overview</Link>
          <button type="button" onClick={() => setDone(null)} className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">Create another</button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cohort */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-extrabold text-ink">Cohort type</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {COHORTS.map((c) => (
            <button key={c.id} type="button" onClick={() => setCohort(c.id)} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${cohort === c.id ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-soft'}`}>
              <span className="block text-lg">{c.emoji}</span>{c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Details */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-extrabold text-ink">Organisation &amp; venue</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="block text-sm font-bold text-ink">Organisation name</label><input className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" /></div>
          <div><label className="block text-sm font-bold text-ink">Batch capacity (18–40)</label><input className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" /></div>
          <div><label className="block text-sm font-bold text-ink">Venue</label><input className={inputCls} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="HQ, 5th floor" /></div>
          <div><label className="block text-sm font-bold text-ink">City</label><input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" /></div>
        </div>
        <div className="mt-4"><label className="block text-sm font-bold text-ink">Venue address (optional)</label><input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="mt-4"><label className="block text-sm font-bold text-ink">Program title (optional)</label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Auto-set from cohort if left blank" /></div>
      </section>

      {/* Focus areas */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-extrabold text-ink">Focus areas</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIMS.map((d) => (
            <button key={d.id} type="button" onClick={() => toggleDim(d.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${dims.includes(d.id) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft'}`}>{d.label}</button>
          ))}
        </div>
      </section>

      {/* Session dates */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-extrabold text-ink">Session dates</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div><label className="block text-xs font-bold text-muted">Date</label><input type="date" className={`${inputCls} mt-1`} value={dateInput} onChange={(e) => setDateInput(e.target.value)} /></div>
          <div><label className="block text-xs font-bold text-muted">Time</label><input type="time" className={`${inputCls} mt-1`} value={timeInput} onChange={(e) => setTimeInput(e.target.value)} /></div>
          <button type="button" onClick={addDate} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">+ Add</button>
        </div>
        {dates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {dates.map((d, i) => (
              <span key={i} className="flex items-center gap-2 rounded-full border border-line bg-cream px-3 py-1 text-sm text-ink-soft">
                {d.date} · {d.time}
                <button type="button" onClick={() => removeDate(i)} className="font-black text-muted hover:text-red-600" aria-label="Remove">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{err}</p>}

      <button type="button" onClick={submit} disabled={busy} className="w-full rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60" data-testid="create-batch-cta">
        {busy ? 'Creating batch…' : 'Create batch & get invite link →'}
      </button>
    </div>
  );
}
