'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendBff, postBff } from '@/lib/auth-client';
import AiImportPanel from '@/components/venues/AiImportPanel';
import VenueReviewSubmit from '@/components/app/venue/VenueReviewSubmit';

// Lightweight PUBLIC venue submission form. Anyone can suggest a venue — no
// account needed. A submission is added to the NOSTOPS review queue; only
// suitable venues become publicly discoverable after review & enrichment.
const label = 'block text-sm font-extrabold text-ink';
const input = 'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

const MAX_PHOTOS = 2;
const PHOTO_TARGET_BYTES = 980_000; // auto-shrink target, safely under the 1 MB cap

function dataUriBytes(uri: string): number {
  const i = uri.indexOf(',');
  const b64 = i >= 0 ? uri.slice(i + 1) : uri;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

// Load an image, scale to <= maxW, and step quality (then dimensions) down until
// the JPEG is under `target` bytes — so every chosen photo fits the 1 MB cap.
async function compressToUnder(file: File, target = PHOTO_TARGET_BYTES): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('load'));
      i.src = url;
    });
    let maxW = 1600;
    for (let pass = 0; pass < 5; pass += 1) {
      const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
      const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(img, 0, 0, w, h);
      for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
        const uri = canvas.toDataURL('image/jpeg', q);
        if (dataUriBytes(uri) <= target) return uri;
      }
      maxW = Math.round(maxW * 0.75); // still too big — shrink dimensions and retry
    }
    throw new Error('toobig');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const VENUE_TYPES = [
  'Yoga Studio', 'Yoga & Wellness Centre', 'Retreat Centre', 'Resort', 'Ashram / Traditional space',
  'Training & Learning Centre', 'Community Space', 'Farm / Nature Retreat', 'Hotel / Hospitality', 'Other',
];
const BEST_FOR = ['retreats', 'workshops', 'teacher_training', 'yoga_camps', 'wellness_programmes', 'corporate_offsites'];
const ROLES = [
  { v: 'owner', label: 'I own this venue' },
  { v: 'manager', label: 'I manage / operate it' },
  { v: 'host', label: 'I host retreats here' },
  { v: 'teacher', label: 'I teach here' },
  { v: 'community', label: 'I know this venue' },
  { v: 'other', label: 'Other' },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-[40px] rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}>
      {String(children).replace(/_/g, ' ')}
    </button>
  );
}

export type SubmitInitial = {
  venue_name?: string; city?: string; state?: string; country?: string; address?: string; venue_type?: string;
  capacity?: number | null; best_for?: string[]; amenities?: string[]; description?: string;
  website_or_maps_url?: string; submitter_role?: string; submitter_name?: string; submitter_phone?: string;
  relationship_note?: string; status?: string;
  /** Approved/published listing: edits become pending changes (typo fixes go live). */
  live?: boolean;
  /** Owner changes already waiting for admin review (the form shows that version). */
  pending?: { submitted_at?: string; changed?: string[] } | null;
};

type EditMode = 'pending' | 'minor_applied' | 'private_only' | 'resubmitted';
const EDIT_DONE: Record<EditMode, { title: string; body: string }> = {
  pending: {
    title: 'Changes sent for review',
    body: 'Your live listing stays exactly as it is while our team reviews your changes. We\u2019ll email you as soon as they\u2019re approved.',
  },
  minor_applied: {
    title: 'Your correction is live',
    body: 'That was a small fix, so it went live on your listing straight away. Thank you for keeping it accurate.',
  },
  private_only: {
    title: 'Your details are updated',
    body: 'We\u2019ve updated your contact details. Nothing on your public listing changed.',
  },
  resubmitted: {
    title: 'Your changes are saved',
    body: 'We\u2019ve updated your submission and sent it back to the NOSTOPS review queue. Our team will take another look.',
  },
};

export default function PublicSubmitForm({ mode = 'create', token, initial, tier2Preview = false }: { mode?: 'create' | 'edit'; token?: string; initial?: SubmitInitial | null; tier2Preview?: boolean }) {
  const isEdit = mode === 'edit';
  const router = useRouter();
  const [venueName, setVenueName] = useState(initial?.venue_name || '');
  const [city, setCity] = useState(initial?.city || '');
  const [state, setState] = useState(initial?.state || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [venueType, setVenueType] = useState(initial?.venue_type || '');
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : '');
  const [bestFor, setBestFor] = useState<string[]>(initial?.best_for || []);
  const [amenities, setAmenities] = useState((initial?.amenities || []).join(', '));
  const [description, setDescription] = useState(initial?.description || '');
  const [mapsUrl, setMapsUrl] = useState(initial?.website_or_maps_url || '');
  const [role, setRole] = useState(initial?.submitter_role || 'owner');
  const [name, setName] = useState(initial?.submitter_name || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(initial?.submitter_phone || '');
  const [note, setNote] = useState(initial?.relationship_note || '');

  // Up to 2 photos of the space (free listing). Each is auto-shrunk under 1 MB
  // in the browser, uploaded to Object Storage, and shown on the public page.
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setPhotoErr(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { setPhotoErr(`You can add up to ${MAX_PHOTOS} photos.`); return; }
    setPhotoBusy(true);
    const added: string[] = [];
    for (const file of files.slice(0, room)) {
      if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) { setPhotoErr('Please choose a JPG, PNG or WebP photo.'); continue; }
      try {
        const dataUri = await compressToUnder(file);
        const r = await postBff('/bff/venue/public-photo', { base64: dataUri, contentType: 'image/jpeg' });
        const u = (r.data as { url?: string })?.url;
        if (r.ok && u) added.push(u);
        else setPhotoErr((r.data as { error?: string })?.error || 'Could not upload that photo.');
      } catch {
        setPhotoErr('Could not read that photo. Please choose a JPG, PNG or WebP photo.');
      }
    }
    setPhotoBusy(false);
    if (added.length) setPhotos((cur) => [...cur, ...added].slice(0, MAX_PHOTOS));
  }

  const removePhoto = (url: string) => setPhotos((cur) => cur.filter((p) => p !== url));

  // Anti-spam: an off-screen honeypot bots tend to fill, and the moment the
  // form rendered (submissions faster than a few seconds are rejected).
  const [company, setCompany] = useState('');
  const startedAt = useRef<number>(Date.now());

  // CAPTCHA — image + signed single-use token fetched from our own backend.
  const [capImg, setCapImg] = useState('');
  const [capToken, setCapToken] = useState('');
  const [capAns, setCapAns] = useState('');
  const [capLoading, setCapLoading] = useState(true);

  async function loadCaptcha() {
    setCapLoading(true);
    setCapAns('');
    try {
      const res = await fetch('/bff/venue/captcha', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      setCapImg(d?.image || '');
      setCapToken(d?.token || '');
    } catch {
      setCapImg('');
      setCapToken('');
    } finally {
      setCapLoading(false);
    }
  }

  useEffect(() => { if (!isEdit) loadCaptcha(); }, [isEdit]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [done, setDone] = useState<null | { deduped: boolean; mode?: EditMode }>(null);
  // Fields filled from the AI website import (sent as provenance with the edit).
  const [aiFields, setAiFields] = useState<string[]>([]);
  const isLive = isEdit && !!initial?.live;

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const valid = venueName.trim().length >= 2 && city.trim().length >= 2 && (isEdit || (name.trim().length >= 1 && emailOk));
  const toggle = (v: string) => setBestFor((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));

  async function submit() {
    setErr(null);
    if (!valid) { setErr(isEdit ? 'Please add the venue name and city.' : 'Please add the venue name, city, and your name and a valid email.'); return; }
    if (!isEdit && photos.length < 1) { setErr('Please add at least one photo of your venue (up to 2).'); return; }
    if (!isEdit && (capAns.trim().length < 4 || !capToken)) { setErr('Please type the characters shown in the verification image.'); return; }
    // New listings: show the Review & Submit step first; the real submit happens from there.
    if (!isEdit && !reviewing) { setReviewing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy(true);
    if (isEdit) {
      const payload = {
        token,
        venue_name: venueName.trim(), city: city.trim(), state: state.trim(), country: country.trim(), address: address.trim(),
        venue_type: venueType, capacity: capacity ? Number(capacity) : undefined,
        best_for: bestFor, amenities: amenities.split(',').map((x) => x.trim()).filter(Boolean),
        description: description.trim(), website_or_maps_url: mapsUrl.trim(),
        submitter_name: name.trim(), submitter_phone: phone.trim(), relationship_note: note.trim(),
        ai_fields: aiFields,
      };
      const r = await sendBff('/bff/venue/public-submissions/edit', 'POST', payload);
      setBusy(false);
      if (!r.ok) { setErr((r.data as { error?: string })?.error || 'Could not save your changes. Please try again.'); return; }
      const m = (r.data as { mode?: string })?.mode;
      setDone({ deduped: false, mode: m && m in EDIT_DONE ? (m as EditMode) : 'resubmitted' });
      return;
    }
    const payload = {
      venue_name: venueName.trim(), city: city.trim(), state: state.trim(), country: country.trim(), address: address.trim(),
      venue_type: venueType, capacity: capacity ? Number(capacity) : undefined,
      best_for: bestFor, amenities: amenities.split(',').map((x) => x.trim()).filter(Boolean),
      description: description.trim(), website_or_maps_url: mapsUrl.trim(),
      submitter_role: role, submitter_name: name.trim(), submitter_email: email.trim(),
      submitter_phone: phone.trim(), relationship_note: note.trim(),
      photos,
      company, form_started_at: startedAt.current,
      captcha_token: capToken, captcha_answer: capAns.trim(),
    };
    const r = await sendBff('/bff/venue/public-submissions', 'POST', payload);
    setBusy(false);
    if (!r.ok) {
      setErr((r.data as { error?: string })?.error || 'Could not submit the venue. Please try again.');
      loadCaptcha(); // token is single-use — always issue a fresh challenge
      setReviewing(false); // back to the form so the new verification code can be typed
      return;
    }
    setReviewing(false);
    const kit = (r.data as { kit_token?: string })?.kit_token;
    if (kit) { router.push(`/venues/submit/thank-you?k=${encodeURIComponent(kit)}`); return; }
    setDone({ deduped: !!(r.data as { deduped?: boolean })?.deduped });
  }

  if (done) {
    const editDone = EDIT_DONE[done.mode || 'resubmitted'];
    return (
      <div className="rounded-2xl border border-brand/20 bg-brand-50/50 p-8 text-center" data-testid="submit-success" data-mode={isEdit ? done.mode : undefined}>
        <p className="text-4xl" aria-hidden>🙏</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-ink">{isEdit ? editDone.title : 'Thank you — it\u2019s with our team'}</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">
          {isEdit
            ? editDone.body
            : done.deduped
              ? 'This venue is already in the NOSTOPS database. We\u2019ve noted your submission — thank you for helping keep it accurate.'
              : 'We\u2019ve added this venue to the NOSTOPS review queue. Our team reviews each space for suitability and may verify and enrich it before it becomes publicly discoverable.'}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {!isEdit && <button type="button" onClick={() => { setDone(null); setVenueName(''); setCity(''); setState(''); setCountry(''); setAddress(''); setVenueType(''); setCapacity(''); setBestFor([]); setAmenities(''); setDescription(''); setMapsUrl(''); setNote(''); setPhotos([]); setPhotoErr(null); loadCaptcha(); }} className="min-h-[48px] rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600" data-testid="submit-another">Suggest another venue</button>}
          <Link href="/venues" className="min-h-[48px] inline-flex items-center justify-center rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">Back to venues</Link>
        </div>
      </div>
    );
  }

  if (reviewing && !isEdit) {
    const roleLabel = ROLES.find((r) => r.v === role)?.label;
    return (
      <VenueReviewSubmit mode="new" busy={busy} error={err} onEdit={() => { setReviewing(false); setErr(null); }} onSubmit={submit}
        data={{ name: venueName.trim(), city: city.trim(), state: state.trim(), country: country.trim(), address: address.trim(), venueType,
          bestFor, amenities: amenities.split(',').map((x) => x.trim()).filter(Boolean), capacity: capacity ? Number(capacity) : null,
          photos, description: description.trim(), relationship: roleLabel, website: mapsUrl.trim() }} />
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-7" data-testid="public-submit-form">
      {/* Honeypot — visually hidden & removed from the a11y tree; only bots fill it. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="company">Company (leave this field empty)</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      {isLive && (
        initial?.pending ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" data-testid="edit-pending-notice">
            <p className="font-black">⏳ Your changes are waiting for review</p>
            <p className="mt-1">
              You sent changes{initial.pending.submitted_at ? ` on ${new Date(initial.pending.submitted_at).toLocaleDateString('en-IN')}` : ''}.
              The form below shows that proposed version — saving again replaces it. Your live listing stays as it is until our team approves.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" data-testid="edit-live-notice">
            <p className="font-black">🟢 Your venue is live</p>
            <p className="mt-1">
              Changes you save are reviewed by our team before they replace your live listing. Small typo fixes to the
              description, address or state go live straight away, and your contact details update immediately.
            </p>
          </div>
        )
      )}
      {isEdit && tier2Preview && token && (
        <AiImportPanel
          token={token}
          onApplyField={(k, val) => {
            if (k === 'description') setDescription(val);
            else if (k === 'address') setAddress(val);
            else if (k === 'submitter_phone') setPhone(val);
            setAiFields((cur) => (cur.includes(k) ? cur : [...cur, k]));
          }}
        />
      )}
      {/* Venue details */}
      <div>
        <h2 className="text-base font-black tracking-tight text-ink">The venue</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={label} htmlFor="v-name">Venue name *</label><input id="v-name" className={input} value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={120} placeholder="Ganga Riverside Ashram" data-testid="f-venue-name" /></div>
          <div><label className={label} htmlFor="v-city">City *</label><input id="v-city" className={input} value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Rishikesh" data-testid="f-city" /></div>
          <div><label className={label} htmlFor="v-state">State / Province</label><input id="v-state" className={input} value={state} onChange={(e) => setState(e.target.value)} maxLength={60} placeholder="Uttarakhand / Bali" /></div>
          <div><label className={label} htmlFor="v-country">Country</label><input id="v-country" className={input} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} placeholder="India, Indonesia, Portugal…" data-testid="f-country" /></div>
          <div><label className={label} htmlFor="v-cap">Approx. capacity</label><input id="v-cap" className={input} value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="40" /></div>
          <div className="sm:col-span-2"><label className={label} htmlFor="v-addr">Address / area</label><input id="v-addr" className={input} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Near Lakshman Jhula" /></div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="v-type">Type of venue</label>
            <select id="v-type" className={input} value={venueType} onChange={(e) => setVenueType(e.target.value)} data-testid="f-venue-type">
              <option value="">Select a type</option>
              {VENUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <p className={label}>Best suited for</p>
        <div className="mt-2 flex flex-wrap gap-2">{BEST_FOR.map((b) => <Chip key={b} active={bestFor.includes(b)} onClick={() => toggle(b)}>{b}</Chip>)}</div>
      </div>

      <div>
        <label className={label} htmlFor="v-amen">Key amenities</label>
        <input id="v-amen" className={input} value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder="Yoga hall, sattvic meals, river access (comma separated)" />
      </div>

      <div>
        <label className={label} htmlFor="v-desc">What makes it special</label>
        <textarea id="v-desc" className={`${input} min-h-[90px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="A few lines about the space, setting and what practitioners love about it…" />
      </div>

      <div>
        <label className={label} htmlFor="v-maps">Website or Google Maps link</label>
        <input id="v-maps" className={input} value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} maxLength={400} placeholder="https://maps.app.goo.gl/…  or  https://venue-website.com" inputMode="url" data-testid="f-maps" />
        <p className="mt-1.5 text-xs text-muted">A Google Maps link lets our team pull photos, ratings and reviews automatically during enrichment.</p>
      </div>

      {!isEdit && (
        <div data-testid="public-photo-uploader">
          <p className={label}>Photos of your space * <span className="font-semibold text-muted">({photos.length}/{MAX_PHOTOS})</span></p>
          <p className="mt-1 text-xs text-ink-soft">Add 1 or 2 photos — the first becomes the cover on your public listing. JPG, PNG or WebP, up to 1&nbsp;MB each (larger photos are shrunk automatically).</p>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPickPhotos} className="hidden" data-testid="public-photo-input" />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <div key={p} className="group relative overflow-hidden rounded-xl border border-line bg-cream" data-testid="public-photo-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Venue photo ${i + 1}`} className="aspect-square w-full object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-white">Cover</span>}
                <button type="button" onClick={() => removePhoto(p)} className="absolute right-0.5 top-0.5 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-sm font-bold text-white transition hover:bg-red-600" aria-label="Remove photo" data-testid="public-photo-remove">✕</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoBusy} className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line bg-cream/50 text-center transition hover:border-brand hover:bg-brand-50/40 disabled:opacity-60" data-testid="public-photo-add">
                <span aria-hidden className="text-2xl">🖼️</span>
                <span className="text-xs font-bold text-ink-soft">{photoBusy ? 'Uploading…' : 'Add photo'}</span>
              </button>
            )}
          </div>
          {photoErr && <p role="alert" className="mt-2 text-xs font-semibold text-red-600" data-testid="public-photo-error">{photoErr}</p>}
        </div>
      )}

      {/* Your details */}
      <div className="border-t border-line pt-5">
        <h2 className="text-base font-black tracking-tight text-ink">About you</h2>
        <p className="mt-1 text-sm text-ink-soft">So we can follow up if we need a detail or two. Your contact details are never made public.</p>
        {!isEdit && (
          <div className="mt-3">
            <label className={label} htmlFor="v-role">Your relationship to this venue</label>
            <select id="v-role" className={input} value={role} onChange={(e) => setRole(e.target.value)} data-testid="f-role">
              {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={label} htmlFor="v-yname">Your name *</label><input id="v-yname" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Your full name" data-testid="f-name" /></div>
          {!isEdit && <div><label className={label} htmlFor="v-email">Your email *</label><input id="v-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} placeholder="you@example.com" data-testid="f-email" /></div>}
          <div><label className={label} htmlFor="v-phone">Phone (optional)</label><input id="v-phone" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder="+91…" inputMode="tel" /></div>
        </div>
        <div className="mt-3">
          <label className={label} htmlFor="v-note">Anything else? (optional)</label>
          <textarea id="v-note" className={`${input} min-h-[70px] resize-y`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Availability, ideal season, contact person at the venue…" />
        </div>
      </div>

      {/* CAPTCHA verification */}
      {!isEdit && (
      <div className="border-t border-line pt-5" data-testid="captcha-block">
        <label className={label} htmlFor="v-captcha">Verification *</label>
        <p className="mt-1 text-sm text-ink-soft">Type the characters shown below. This helps keep spam out.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex h-[64px] w-[176px] items-center justify-center overflow-hidden rounded-xl border border-line bg-cream" aria-hidden>
            {capLoading ? (
              <span className="text-xs font-bold text-muted">Loading…</span>
            ) : capImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={capImg} alt="" className="h-full w-full object-contain" data-testid="captcha-image" />
            ) : (
              <span className="text-xs font-bold text-red-500">Unavailable</span>
            )}
          </div>
          <button type="button" onClick={loadCaptcha} disabled={capLoading} className="min-h-[44px] rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-brand-700 transition hover:bg-cream disabled:opacity-50" data-testid="captcha-refresh" aria-label="Get a new verification image">↻ New code</button>
          <input
            id="v-captcha"
            className={`${input} mt-0 w-[160px] uppercase tracking-[0.3em]`}
            value={capAns}
            onChange={(e) => setCapAns(e.target.value.replace(/\s/g, '').slice(0, 8))}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="CODE"
            aria-label="Verification code"
            data-testid="captcha-input"
          />
        </div>
      </div>
      )}

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert" data-testid="submit-error">{err}</p>}

      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={submit} disabled={busy || photoBusy || !valid} className="w-full min-h-[48px] rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="submit-venue">
          {busy ? (isEdit ? 'Saving…' : 'Submitting…') : photoBusy ? 'Uploading photo…' : (isEdit ? 'Save changes' : 'Review & submit →')}
        </button>
        <p className="text-center text-xs text-muted">{isLive ? 'Changes to your live listing are reviewed before they go live.' : isEdit ? 'Your changes go back to our team for another review.' : 'Submitting a venue isn\u2019t the same as publishing it — every space is reviewed for suitability first.'}</p>
      </div>
    </div>
  );
}
