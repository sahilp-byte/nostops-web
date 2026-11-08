'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import type { OwnedVenue } from '@/lib/server/venue-ownership';
import { fieldLabels, prettyType } from '@/lib/venue-fields';
import VenueReviewSubmit from '@/components/app/venue/VenueReviewSubmit';

// Venue Profile & Settings — the approved owner's dashboard for one Global Venue.
// Only fields the owner actually changed are sent; sensitive ones go through Review & Submit → admin review.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const SENSITIVE = ['name', 'city', 'state', 'address', 'country', 'capacity', 'description', 'photos', 'venue_type', 'best_for'];
const VENUE_TYPES = ['Yoga Studio', 'Yoga & Wellness Centre', 'Retreat Centre', 'Resort', 'Ashram / Traditional space',
  'Training & Learning Centre', 'Community Space', 'Farm / Nature Retreat', 'Hotel / Hospitality', 'Other'];
const BEST_FOR = ['retreats', 'workshops', 'teacher_training', 'yoga_camps', 'wellness_programmes', 'corporate_offsites'];
const input = 'mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const lbl = 'text-sm font-bold text-ink';
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const btnOutline = 'inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-brand-700 bg-white px-3.5 text-xs font-bold text-brand-700 hover:bg-brand-50';

type Form = {
  contact_phone: string; contact_email: string; website_or_maps_url: string; amenities: string; things_to_carry: string; getting_there: string;
  name: string; city: string; state: string; address: string; country: string; capacity: string; description: string; venue_type: string;
  open_months: string[]; photos: string[]; best_for: string[]; open_to_partnerships: boolean;
};

function initForm(venue: OwnedVenue): Form {
  const p = (venue.pending?.fields || {}) as Record<string, any>;
  const pick = (k: keyof OwnedVenue) => (k in p ? p[k as string] : venue[k]);
  return {
    contact_phone: venue.contact_phone || '', contact_email: venue.contact_email || '', website_or_maps_url: venue.website_or_maps_url || '',
    amenities: (venue.amenities || []).join(', '), things_to_carry: (venue.things_to_carry || []).join(', '), getting_there: venue.getting_there?.text || '',
    name: pick('name') || '', city: pick('city') || '', state: pick('state') || '', address: pick('address') || '', country: pick('country') || '',
    capacity: String(pick('capacity') ?? ''), description: pick('description') || '', venue_type: pick('venue_type') || '',
    open_months: venue.open_months || [], photos: (pick('photos') as string[]) || [], best_for: (pick('best_for') as string[]) || [],
    open_to_partnerships: venue.open_to_partnerships !== false,
  };
}

function toBody(f: Form, venue: OwnedVenue): Record<string, unknown> {
  const cap = Number(f.capacity);
  return {
    contact_phone: f.contact_phone.trim(), contact_email: f.contact_email.trim(), website_or_maps_url: f.website_or_maps_url.trim(),
    amenities: list(f.amenities), things_to_carry: list(f.things_to_carry), open_months: [...f.open_months].sort(),
    getting_there: { ...(venue.getting_there || {}), text: f.getting_there.trim() }, open_to_partnerships: f.open_to_partnerships,
    name: f.name.trim(), city: f.city.trim(), state: f.state.trim(), address: f.address.trim(), country: f.country.trim(),
    description: f.description.trim(), photos: f.photos, venue_type: f.venue_type, best_for: f.best_for,
    capacity: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : null,
  };
}

function SideCard({ title, icon, children, action, testid }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode; testid?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-sm" data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-serif text-base font-black text-brand-700"><span aria-hidden>{icon}</span>{title}</h3>{action}
      </div>
      <div className="mt-2 text-sm text-ink-soft">{children}</div>
    </section>
  );
}

export default function VenueProfileDashboard({ venue }: { venue: OwnedVenue }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Form>(() => initForm(venue));
  const [f, setF] = useState<Form>(saved);
  const [base, setBase] = useState(venue.updated_at || '');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const toggle = (k: 'open_months' | 'best_for', v: string) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  const changed = useMemo(() => {
    const a = toBody(f, venue), b = toBody(saved, venue);
    return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  }, [f, saved, venue]);
  const sensitive = changed.filter((k) => SENSITIVE.includes(k));
  const isLive = venue.status === 'published' || venue.status === 'approved';

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    const base64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
    const { ok, data } = await postBff('/bff/venue/photo', { base64 });
    if (!ok) return setMsg({ ok: false, text: data?.error || 'Could not upload the photo.' });
    setF((s) => ({ ...s, photos: [...s.photos, data.url].slice(0, 10) }));
  }

  async function send() {
    setBusy(true); setMsg(null);
    const all = toBody(f, venue);
    const body: Record<string, unknown> = { base_updated_at: base || undefined };
    for (const k of changed) if (!(k === 'capacity' && all[k] === null)) body[k] = all[k];
    const { ok, data } = await sendBff(`/bff/venue/owned/${encodeURIComponent(venue.id)}`, 'PATCH', body);
    setBusy(false);
    if (!ok) { setMsg({ ok: false, text: data?.error || 'Could not save your changes.' }); return; }
    const a: string[] = data.applied || [], pend: string[] = data.pending || [];
    setMsg({ ok: true, text: !a.length && !pend.length ? 'No changes to save.' : `${a.length ? `Saved now: ${fieldLabels(a)}. ` : ''}${pend.length ? `Sent for admin review: ${fieldLabels(pend)}.` : ''}` });
    setSaved(f); setReviewing(false);
    if (data.venue?.updated_at) setBase(data.venue.updated_at);
    router.refresh();
  }

  function save() {
    if (!changed.length) return setMsg({ ok: true, text: 'No changes to save.' });
    if (sensitive.length) { setMsg(null); setReviewing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    send();
  }

  if (reviewing) {
    return (
      <VenueReviewSubmit mode="changes" changed={sensitive} busy={busy} error={msg && !msg.ok ? msg.text : null}
        onEdit={() => { setReviewing(false); setMsg(null); }} onSubmit={send}
        data={{ name: f.name, city: f.city, state: f.state, country: f.country, address: f.address, venueType: prettyType(f.venue_type), bestFor: f.best_for,
          amenities: list(f.amenities), capacity: Number(f.capacity) || null, openMonths: f.open_months, photos: f.photos, description: f.description,
          relationship: venue.owner_relationship || 'Approved owner', website: f.website_or_maps_url }} />
    );
  }

  const tabs = [['vp-profile', '🏛️ Venue profile'], ['vp-ownership', '🪪 Ownership & authorisation'], ['vp-contact', '📞 Contact & communication'], ['vp-preferences', '⚙️ Listing preferences']];
  return (
    <div data-testid="venue-profile-dashboard">
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Sections">
        {tabs.map(([id, t], i) => (
          <a key={id} href={`#${id}`} className={`inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-bold ${i === 0 ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}>{t}</a>
        ))}
      </nav>

      {venue.pending && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" data-testid="owner-pending-banner">
          Changes awaiting admin review: <strong>{fieldLabels(venue.pending.changed)}</strong>. Your current published listing stays live until they are approved.
        </div>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_330px]">
        <div className="space-y-5">
          <section id="vp-profile" className="card scroll-mt-24 space-y-4 p-5" data-testid="owner-sensitive">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-black text-brand-700">Venue profile <span className="text-sm font-bold text-ink-soft">(public listing)</span></h2>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Changes here are reviewed before going live</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              {f.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.photos[0]} alt="Cover" className="aspect-[4/3] w-full rounded-xl object-cover" />
              ) : <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-cream text-4xl" aria-hidden>🧘</div>}
              <div className="space-y-3">
                <div><label className={lbl} htmlFor="o-name">Venue name *</label><input id="o-name" className={input} value={f.name} onChange={set('name')} data-testid="owner-name" /></div>
                <div>
                  <span className={lbl}>Listing category</span>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border-2 border-orange-600 bg-orange-50 p-3 text-sm"><p className="font-black text-ink">◉ Global Venue</p><p className="text-xs text-ink-soft">Destination / retreat venue</p></div>
                    <div className="rounded-xl border border-line bg-cream/60 p-3 text-sm text-muted" aria-disabled><p className="font-bold">○ NOSTOPS Spaces</p><p className="text-xs">India local spaces are listed separately from <Link href="/app/spaces" className="font-semibold underline">My Spaces</Link></p></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={lbl} htmlFor="o-type">Venue type</label>
                <select id="o-type" className={input} value={f.venue_type} onChange={set('venue_type')} data-testid="owner-venue-type">
                  <option value="">Select a type</option>
                  {[...new Set([...(f.venue_type ? [f.venue_type] : []), ...VENUE_TYPES])].map((t) => <option key={t} value={t}>{prettyType(t)}</option>)}
                </select>
              </div>
              <div><label className={lbl} htmlFor="o-cap">Capacity (guests)</label><input id="o-cap" inputMode="numeric" className={input} value={f.capacity} onChange={(e) => setF((s) => ({ ...s, capacity: e.target.value.replace(/\D/g, '').slice(0, 4) }))} data-testid="owner-capacity" /></div>
            </div>
            <div>
              <span className={lbl}>Best suited for</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...new Set([...BEST_FOR, ...saved.best_for, ...f.best_for])].map((b) => (
                  <label key={b} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 text-xs font-bold capitalize text-ink-soft">
                    <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={f.best_for.includes(b)} onChange={() => toggle('best_for', b)} data-testid={`owner-bestfor-${b}`} />{b.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl} htmlFor="o-desc">About the venue</label>
              <textarea id="o-desc" rows={5} maxLength={4000} className={input} value={f.description} onChange={set('description')} data-testid="owner-description" />
              <p className="mt-1 text-right text-xs text-muted">{f.description.length} / 4000</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={lbl} htmlFor="o-city">City *</label><input id="o-city" className={input} value={f.city} onChange={set('city')} data-testid="owner-city" /></div>
              <div><label className={lbl} htmlFor="o-state">State / region</label><input id="o-state" className={input} value={f.state} onChange={set('state')} /></div>
              <div><label className={lbl} htmlFor="o-country">Country</label><input id="o-country" className={input} value={f.country} onChange={set('country')} data-testid="owner-country" /></div>
            </div>
            <div><label className={lbl} htmlFor="o-addr">Address</label><input id="o-addr" className={input} value={f.address} onChange={set('address')} /></div>
            <div>
              <span className={lbl}>Venue photographs <span className="font-semibold text-muted">(up to 10 · {f.photos.length}/10)</span></span>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {f.photos.map((ph, i) => (
                  <div key={ph} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-black text-white">Cover</span>}
                    <button type="button" onClick={() => setF((s) => ({ ...s, photos: s.photos.filter((x) => x !== ph) }))} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-xs font-black text-red-700" aria-label="Remove photo">✕</button>
                  </div>
                ))}
                {f.photos.length < 10 && (
                  <label className="grid aspect-square w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed border-brand/40 bg-brand-50/40 text-center text-xs font-bold text-brand-700">
                    <span>＋<br />Add photo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => addPhoto(e.target.files?.[0])} data-testid="owner-photo-input" />
                  </label>
                )}
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-5" data-testid="owner-low-risk">
            <div><h2 className="font-serif text-xl font-black text-brand-700">Facilities &amp; availability</h2><p className="text-xs text-muted">These update your public listing as soon as you save.</p></div>
            <div><label className={lbl} htmlFor="o-am">Amenities and facilities (comma separated)</label><input id="o-am" className={input} value={f.amenities} onChange={set('amenities')} data-testid="owner-amenities" /></div>
            <div>
              <span className={lbl}>Open months</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {MONTHS.map((m) => (
                  <button key={m} type="button" aria-pressed={f.open_months.includes(m)} onClick={() => toggle('open_months', m)}
                    className={`min-h-11 rounded-full border px-3 text-xs font-bold capitalize ${f.open_months.includes(m) ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-ink-soft'}`} data-testid={`owner-month-${m}`}>{m}</button>
                ))}
              </div>
            </div>
            <div><label className={lbl} htmlFor="o-gt">Getting there</label><textarea id="o-gt" rows={2} className={input} value={f.getting_there} onChange={set('getting_there')} data-testid="owner-getting-there" /></div>
            <div><label className={lbl} htmlFor="o-tc">Things to carry (comma separated)</label><input id="o-tc" className={input} value={f.things_to_carry} onChange={set('things_to_carry')} data-testid="owner-things" /></div>
          </section>

          <section id="vp-contact" className="card scroll-mt-24 space-y-4 p-5" data-testid="owner-contact">
            <div><h2 className="font-serif text-xl font-black text-brand-700">Contact &amp; communication</h2><p className="text-xs text-muted">Your website shows on the public listing. Phone and email are kept for the NOSTOPS team and are not shown publicly.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={lbl} htmlFor="o-phone">Contact phone</label><input id="o-phone" className={input} value={f.contact_phone} onChange={set('contact_phone')} data-testid="owner-contact-phone" /></div>
              <div><label className={lbl} htmlFor="o-email">Contact email</label><input id="o-email" type="email" className={input} value={f.contact_email} onChange={set('contact_email')} data-testid="owner-contact-email" /></div>
            </div>
            <div><label className={lbl} htmlFor="o-web">Website</label><input id="o-web" className={input} value={f.website_or_maps_url} onChange={set('website_or_maps_url')} placeholder="https://" data-testid="owner-website" /></div>
          </section>

          <section id="vp-preferences" className="card scroll-mt-24 space-y-3 p-5" data-testid="owner-preferences">
            <h2 className="font-serif text-xl font-black text-brand-700">Listing preferences</h2>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={f.open_to_partnerships} onChange={(e) => setF((s) => ({ ...s, open_to_partnerships: e.target.checked }))} data-testid="owner-open-partnerships" />
              <span>Open to retreat partnerships with NOSTOPS teachers<span className="block text-xs text-muted">Helps our team suggest your venue to teachers planning retreats. Saved immediately.</span></span>
            </label>
            <p className="text-xs text-muted">Live listings appear in the Global Venues directory and search. To pause or remove your listing, contact the NOSTOPS team.</p>
          </section>
        </div>

        <aside className="space-y-4">
          <SideCard title="Listing status" icon="📋" testid="side-status"
            action={<span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{isLive ? '✓ Live' : venue.status}</span>}>
            {isLive ? 'Your venue is live on NOSTOPS Global Venues.' : 'Your venue is not currently live.'}
            {venue.pending && <p className="mt-1 font-semibold text-amber-900">Some changes are waiting for review.</p>}
          </SideCard>
          <SideCard title="Ownership & authorisation" icon="👤" testid="vp-ownership">
            <p className="flex items-center gap-2"><span aria-hidden className="text-emerald-600">✔</span> Approved owner{venue.owner_name ? `: ${venue.owner_name}` : ''}</p>
            {venue.owner_relationship && <p className="mt-1">Relationship: {venue.owner_relationship}</p>}
            <p className="mt-1">Owner since {venue.owner_claimed_at ? new Date(venue.owner_claimed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
            {venue.verification_status === 'verified' && <p className="mt-1 font-semibold text-emerald-800">🛡️ NOSTOPS Verified Venue</p>}
            <p className="mt-2 text-xs text-muted">Ownership changes are handled by the NOSTOPS team.</p>
          </SideCard>
          <SideCard title="Contact information" icon="📞" action={<a href="#vp-contact" className={btnOutline} data-testid="side-contact-edit">✎ Edit</a>}>
            <p>📱 {f.contact_phone || '—'}</p><p>✉️ {f.contact_email || '—'}</p><p className="break-all">🌐 {f.website_or_maps_url || '—'}</p>
          </SideCard>
          <SideCard title="Listing preferences" icon="⚙️" action={<a href="#vp-preferences" className={btnOutline}>✎ Edit</a>}>
            <p>{f.open_to_partnerships ? '✅' : '⬜'} Open to retreat partnerships</p>
            <p>{isLive ? '✅' : '⬜'} Shown in Global Venues search</p>
          </SideCard>
        </aside>
      </div>

      {msg && <p className={`mt-4 text-sm font-semibold ${msg.ok ? 'text-brand-700' : 'text-red-700'}`} role="status" data-testid="owner-save-msg">{msg.text}</p>}
      <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-cream/95 py-3 backdrop-blur">
        <Link href={`/app/venue/owned/${venue.id}/preview`} className="inline-flex min-h-12 items-center rounded-full border-2 border-brand-700 bg-white px-5 text-sm font-bold text-brand-700 hover:bg-brand-50" data-testid="owner-preview">👁 Preview public listing</Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setF(saved); setMsg(null); }} disabled={busy || !changed.length} className="min-h-12 rounded-full border-2 border-line bg-white px-5 text-sm font-bold text-ink-soft disabled:opacity-50" data-testid="owner-discard">Discard changes</button>
          <button type="button" onClick={save} disabled={busy} className="min-h-12 rounded-full bg-orange-700 px-6 text-sm font-bold text-white shadow-md hover:bg-orange-800 disabled:opacity-60" data-testid="owner-save">
            {busy ? 'Saving…' : sensitive.length ? '✓ Review & save changes' : '✓ Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
