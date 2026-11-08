'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import { draftIsMeaningful, type RetreatDraft } from '@/lib/retreat-draft';
import { listDrafts, getDraft, saveDraft, deleteDraft, newDraftId } from '@/lib/retreat-drafts';
import CoverPhotoPicker from '@/components/app/teacher/CoverPhotoPicker';
import type { HostRateContext, TeacherIdentity } from '@/lib/server/retreat-host';
import RetreatEconomicsCalculator from './RetreatEconomicsCalculator';
import ItineraryBuilder from './ItineraryBuilder';
import VenueCapacityPlanner from '@/components/app/venue/VenueCapacityPlanner';
import { operationalCapacity, type VenueCapacityBreakdown } from '@/lib/venue-capacity';
import { serializeItinerary, parseItinerary, type ItineraryItem } from '@/lib/retreat-content';
import { VenueCapacityNote, type EligibleVenue } from '@/components/app/teacher/VenuePicker';
import { retreatDatesError, todayIST } from '@/lib/retreat-dates';
import { UNAPPROVED_LABEL } from '@/lib/org/pricing';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const MAX_KM = 100;

const THEMES: { v: string; label: string }[] = [
  { v: 'general', label: 'General Hatha / Vinyasa' },
  { v: 'lineage', label: 'Lineage / Parampara' },
  { v: 'pranayama', label: 'Pranayama & breath' },
  { v: 'stress', label: 'Stress & renewal' },
  { v: 'leadership', label: 'Leadership' },
  { v: 'faculty', label: 'Faculty immersion' },
  { v: 'founders', label: 'Founders reset' },
];
const INCLUSION_PRESETS = [
  'Daily yoga sessions',
  'Guided meditation',
  'Sattvic meals',
  'Evening satsang',
  'Local excursion',
  'Free / personal time',
  'Pranayama & breathwork',
  'Accommodation',
];
const AUDIENCE: { v: string; label: string }[] = [
  { v: 'public', label: 'Open to all' },
  { v: 'hr', label: 'HR / People teams' },
  { v: 'hod', label: 'Heads of dept.' },
  { v: 'startup', label: 'Startups' },
];
const FRAMINGS: { v: string; label: string }[] = [
  { v: 'leadership_renewal', label: 'Leadership renewal' },
  { v: 'faculty_immersion', label: 'Faculty immersion' },
  { v: 'founders_reset', label: 'Founders reset' },
];
const PERSONAS: { v: string; label: string }[] = [
  { v: 'founders', label: 'Founders' },
  { v: 'hr', label: 'HR' },
  { v: 'hod', label: 'HODs' },
  { v: 'faculty', label: 'Faculty' },
  { v: 'startup', label: 'Startup folks' },
  { v: 'senior_ic', label: 'Senior ICs' },
  { v: 'mid_ic', label: 'Mid ICs' },
];

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}
function nightsBetween(a: string, b: string): number {
  if (!/^\d{4}-\d{2}-\d{2}/.test(a) || !/^\d{4}-\d{2}-\d{2}/.test(b)) return 0;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return d >= 0 ? Math.round(d) : 0;
}

const label = 'block text-sm font-extrabold text-ink';
const input =
  'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}>
      {children}
    </button>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-2 text-sm last:border-0">
      <span className="shrink-0 font-bold text-muted">{k}</span>
      <span className="text-right font-semibold text-ink">{v || '—'}</span>
    </div>
  );
}

const STEPS = [
  { key: 'identity', title: 'Retreat identity', sub: 'Name it and set the shape.' },
  { key: 'teaching', title: 'Your teaching', sub: 'The retreat is built around you.' },
  { key: 'venue', title: 'Choose your venue', sub: 'Where you will gather.' },
  { key: 'experience', title: 'Design your experience', sub: 'The daily rhythm of your retreat.' },
  { key: 'pricing', title: 'Set your price', sub: 'You decide. Our numbers are only guidance.' },
  { key: 'cohort', title: 'Cohort & group options', sub: 'Who shares the room, and group economics.' },
  { key: 'policies', title: 'Policies', sub: 'Inclusions, exclusions, cancellation & logistics.' },
  { key: 'preview', title: 'Preview', sub: 'Exactly how seekers will see it.' },
  { key: 'publish', title: 'Publish', sub: 'One last confirmation before it goes live.' },
];

export default function HostRetreatWizard({
  platformFeePct,
  baseLat,
  baseLng,
  baseLabel,
  hostName,
  rate,
  identity,
  eligibleVenues = [],
}: {
  platformFeePct: number;
  baseLat: number | null;
  baseLng: number | null;
  baseLabel: string | null;
  hostName: string | null;
  rate: HostRateContext | null;
  identity: TeacherIdentity | null;
  eligibleVenues?: EligibleVenue[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const [fromDuplicate, setFromDuplicate] = useState(false);
  const hydratedRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  // 1 identity
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [theme, setTheme] = useState('general');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [seats, setSeats] = useState('');
  const [cover, setCover] = useState('');
  // 2 teaching
  const [carryHome, setCarryHome] = useState('');
  const [yogaSeKyaHoga, setYogaSeKyaHoga] = useState('');
  const [stay, setStay] = useState('');
  const [food, setFood] = useState('');
  const [cohortCurated, setCohortCurated] = useState(false);
  const [personaMix, setPersonaMix] = useState<string[]>([]);
  const [seniority, setSeniority] = useState('');
  const [language, setLanguage] = useState('');
  const [cohortNotes, setCohortNotes] = useState('');
  // 3 venue (host picks an existing LISTED venue, then adds event-specific detail)
  const [venuePartnerId, setVenuePartnerId] = useState('');
  const [venueQuery, setVenueQuery] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [state, setState] = useState('');
  const [lat, setLat] = useState(baseLat != null ? String(baseLat) : '');
  const [lng, setLng] = useState(baseLng != null ? String(baseLng) : '');
  const [geoBusy, setGeoBusy] = useState(false);
  const [mapsUrl, setMapsUrl] = useState('');
  const [venuePermission, setVenuePermission] = useState(false);
  const [venueWhy, setVenueWhy] = useState('');
  const [venueCap, setVenueCap] = useState<VenueCapacityBreakdown>({});
  const [capOverride, setCapOverride] = useState(false);
  // 4 experience
  const [incl, setIncl] = useState<string[]>([]);
  const [inclMore, setInclMore] = useState('');
  const [itinerary, setItinerary] = useState('');
  const [itin, setItin] = useState<ItineraryItem[]>([]);
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
  const [framings, setFramings] = useState<string[]>([]);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [preRamp, setPreRamp] = useState('');
  const [postSanskara, setPostSanskara] = useState('');
  // 5 pricing
  const [price, setPrice] = useState('');
  const [venueCost, setVenueCost] = useState('');
  // 6 cohort & group options
  const [minCohort, setMinCohort] = useState('');
  const [maxCohort, setMaxCohort] = useState('');
  const [cohortDeadline, setCohortDeadline] = useState('');
  const [shortfallPolicy, setShortfallPolicy] = useState('continue');
  const [groupNote, setGroupNote] = useState('');
  const [taxNote, setTaxNote] = useState('');
  // 7 policies
  const [cancellation, setCancellation] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [howToGetThere, setHowToGetThere] = useState('');
  const [whatToCarry, setWhatToCarry] = useState('');

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  const hasBase = baseLat != null && baseLng != null;
  const distFromBase = hasCoords && hasBase ? distanceKm(baseLat as number, baseLng as number, latNum, lngNum) : null;
  const tooFar = distFromBase != null && distFromBase > MAX_KM;

  const mapsUrlTrim = mapsUrl.trim();
  const venueLinkProvided = mapsUrlTrim.length > 0;
  const venueLinkOk = !venueLinkProvided || (/^https?:\/\//i.test(mapsUrlTrim) && /google|goo\.gl|g\.co/i.test(mapsUrlTrim));
  const venuePermissionOk = !venueLinkProvided || venuePermission;

  const priceNum = parseInt(price, 10) || 0;
  const seatsNum = parseInt(seats, 10) || 0;
  const venueCostNum = parseInt(venueCost, 10) || 0;
  const venueOperationalCap = operationalCapacity(venueCap);
  const overVenueCap = venueOperationalCap > 0 && seatsNum > venueOperationalCap;
  const venueCapOk = !overVenueCap || capOverride;
  const nights = nightsBetween(startDate, endDate);
  const platformCut = Math.round((priceNum * (platformFeePct || 0)) / 100);
  const hostNetPerSeat = Math.max(0, priceNum - platformCut - venueCostNum);
  const minCohortNum = parseInt(minCohort, 10) || 0;
  const maxCohortNum = parseInt(maxCohort, 10) || 0;
  const minCohortValid =
    (minCohortNum === 0 || (minCohortNum >= 1 && (seatsNum ? minCohortNum <= seatsNum : true))) &&
    (maxCohortNum === 0 || ((seatsNum ? maxCohortNum <= seatsNum : true) && (minCohortNum === 0 || maxCohortNum >= minCohortNum))) &&
    (!cohortDeadline || !startDate || cohortDeadline <= startDate);

  function toggle(list: string[], setList: (v: string[]) => void, v: string) {
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setErr('Location is not available in this browser.'); return; }
    setErr(null); setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toFixed(6)); setLng(pos.coords.longitude.toFixed(6)); setGeoBusy(false); },
      () => { setErr('Could not read your location. Enter coordinates manually.'); setGeoBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  const csv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

  // Venue binding: the selected listed venue + a filtered match list for the picker.
  const selectedVenue = eligibleVenues.find((v) => v.id === venuePartnerId) || null;
  // A bound venue supplies name / city / state (read-only) and caps the seats.
  const venueCapacity = selectedVenue?.capacity ?? null;
  const seatsOverVenue = venueCapacity != null && seatsNum > venueCapacity;
  const vName = selectedVenue ? selectedVenue.name : venueName;
  const vCity = selectedVenue ? selectedVenue.city || venueCity : venueCity;
  const vState = selectedVenue ? selectedVenue.state || state : state;
  const venueMatches = (() => {
    const q = venueQuery.trim().toLowerCase();
    const list = q
      ? eligibleVenues.filter((v) => `${v.name} ${v.city} ${v.state}`.toLowerCase().includes(q))
      : eligibleVenues;
    return list.slice(0, 8);
  })();
  function selectVenue(v: EligibleVenue) {
    setVenuePartnerId(v.id);
    setVenueName(v.name);
    setVenueCity(v.city || '');
    setState(v.state || '');
    if (v.lat != null && v.lng != null) { setLat(String(v.lat)); setLng(String(v.lng)); }
    setVenueQuery('');
    setErr(null);
  }

  // ---- Draft: keep the teacher's progress on this device (no backend draft API) ----
  function snapshot(): RetreatDraft {
    return { step, title, shortDesc, theme, startDate, endDate, seats, cover, carryHome, yogaSeKyaHoga, stay, food, cohortCurated, personaMix, seniority, language, cohortNotes, venuePartnerId, venueName, venueCity, state, lat, lng, mapsUrl, venuePermission, venueWhy, venueCap, capOverride, incl, inclMore, itinerary, itin, audienceTags, framings, preRamp, postSanskara, price, venueCost, minCohort, maxCohort, cohortDeadline, shortfallPolicy, groupNote, taxNote, cancellation, exclusions, howToGetThere, whatToCarry };
  }
  function applyDraft(d: RetreatDraft) {
    if (typeof d.step === 'number') setStep(Math.max(0, Math.min(STEPS.length - 1, d.step)));
    setTitle(d.title || ''); setShortDesc(d.shortDesc || ''); setTheme(d.theme || 'general'); setStartDate(d.startDate || ''); setEndDate(d.endDate || ''); setSeats(d.seats || ''); setCover(d.cover || '');
    setCarryHome(d.carryHome || ''); setYogaSeKyaHoga(d.yogaSeKyaHoga || ''); setStay(d.stay || ''); setFood(d.food || ''); setCohortCurated(!!d.cohortCurated); setPersonaMix(d.personaMix || []); setSeniority(d.seniority || ''); setLanguage(d.language || ''); setCohortNotes(d.cohortNotes || '');
    setVenuePartnerId(d.venuePartnerId || ''); setVenueName(d.venueName || ''); setVenueCity(d.venueCity || ''); setState(d.state || ''); if (d.lat != null) setLat(d.lat); if (d.lng != null) setLng(d.lng); setMapsUrl(d.mapsUrl || ''); setVenuePermission(!!d.venuePermission); setVenueWhy(d.venueWhy || ''); setVenueCap(d.venueCap || {}); setCapOverride(!!d.capOverride);
    setIncl(d.incl || []); setInclMore(d.inclMore || ''); setItinerary(d.itinerary || ''); setItin(Array.isArray(d.itin) && d.itin.length ? d.itin : (d.itinerary ? parseItinerary(d.itinerary) : [])); setAudienceTags(d.audienceTags || []); setFramings(d.framings || []); setPreRamp(d.preRamp || ''); setPostSanskara(d.postSanskara || '');
    setPrice(d.price || ''); setVenueCost(d.venueCost || '');
    setMinCohort(d.minCohort || ''); setMaxCohort(d.maxCohort || ''); setCohortDeadline(d.cohortDeadline || ''); setShortfallPolicy(d.shortfallPolicy || 'continue'); setGroupNote(d.groupNote || '');
    setTaxNote(d.taxNote || '');
    setCancellation(d.cancellation || ''); setExclusions(d.exclusions || ''); setHowToGetThere(d.howToGetThere || ''); setWhatToCarry(d.whatToCarry || '');
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('draft');
    const forceFresh = params.get('fresh') === '1';
    if (params.get('from') === 'duplicate') setFromDuplicate(true);
    let id: string | null = null;
    if (requested && getDraft(requested)) id = requested;
    else if (!forceFresh) {
      const recent = listDrafts()[0];
      if (recent && draftIsMeaningful(recent)) id = recent.id;
    }
    if (id) {
      const d = getDraft(id);
      if (d) { applyDraft(d); setResumed(true); }
      activeIdRef.current = id;
    } else {
      activeIdRef.current = newDraftId();
    }
    hydratedRef.current = true;
  }, []);
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => { const s = snapshot(); if (activeIdRef.current && draftIsMeaningful(s)) saveDraft(activeIdRef.current, s); }, 600);
    return () => clearTimeout(t);
  });
  // Full reload on purpose: drops every in-memory wizard field before starting a fresh draft.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  function startFresh() { if (typeof window !== 'undefined') window.location.href = '/app/teacher/retreats/new?fresh=1'; }
  function saveAndExit() { const s = snapshot(); if (activeIdRef.current && draftIsMeaningful(s)) saveDraft(activeIdRef.current, s); router.push('/app/teacher/retreats/drafts'); }

  const stepValid: boolean[] = [
    title.trim().length >= 6 && shortDesc.trim().length >= 40 && retreatDatesError(startDate, endDate) === null && seatsNum >= 4 && seatsNum <= 200,
    true,
    venuePartnerId.trim().length > 0 && vName.trim().length >= 3 && vCity.trim().length >= 2 && !seatsOverVenue && hasCoords && !tooFar && venueLinkOk && venuePermissionOk && venueCapOk,
    true,
    priceNum >= 500 && priceNum <= 500000 && venueCostNum <= priceNum,
    minCohortValid,
    true,
    true,
    true,
  ];
  const allValid = stepValid[0] && stepValid[2] && stepValid[4] && stepValid[5];

  function next() {
    setErr(null);
    if (!stepValid[step]) { setErr('Please complete the highlighted fields to continue.'); return; }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function back() {
    setErr(null);
    setStep((s) => Math.max(0, s - 1));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function composedDescription(): string {
    const parts = [shortDesc.trim()];
    const itinText = itin.length ? serializeItinerary(itin) : itinerary.trim();
    if (itinText) parts.push(`Daily rhythm\n${itinText}`);
    if (carryHome.trim()) parts.push(`What you carry home\n${carryHome.trim()}`);
    const exc = csv(exclusions);
    if (exc.length) parts.push(`Not included\n${exc.join(', ')}`);
    if (cancellation.trim()) parts.push(`Cancellation policy\n${cancellation.trim()}`);
    const maxForToken = maxCohortNum || seatsNum || 0;
    if (minCohortNum > 0 || maxCohortNum > 0 || cohortDeadline || shortfallPolicy !== 'continue') {
      const tok = [
        minCohortNum > 0 ? `min=${minCohortNum}` : '',
        maxForToken > 0 ? `max=${maxForToken}` : '',
        cohortDeadline ? `deadline=${cohortDeadline}` : '',
        `policy=${shortfallPolicy || 'continue'}`,
      ].filter(Boolean).join(';');
      const readable = minCohortNum > 0
        ? `This retreat runs with a minimum of ${minCohortNum} confirmed participants${maxForToken ? ` (up to ${maxForToken})` : ''}.`
        : `Confirmed cohort capacity up to ${maxForToken} participants.`;
      parts.push(`${readable} [mcc:${tok}]`);
    }
    if (taxNote.trim()) parts.push(`Taxes: ${taxNote.trim()}`);
    if (groupNote.trim()) parts.push(`Group bookings\n${groupNote.trim()}`);
    if (yogaSeKyaHoga.trim()) parts.push(`Yoga se kya hoga\n${yogaSeKyaHoga.trim()}`);
    if (stay.trim()) parts.push(`Your stay\n${stay.trim()}`);
    if (food.trim()) parts.push(`Food and meals\n${food.trim()}`);
    return parts.filter(Boolean).join('\n\n').slice(0, 2000);
  }

  async function publish() {
    setErr(null);
    if (!allValid) { setErr('Some earlier steps still need attention. Please review.'); return; }
    setBusy(true);
    const inclusions = Array.from(new Set([...incl, ...csv(inclMore)]));
    const r = await sendBff('/bff/teacher/retreats/create', 'POST', {
      title: title.trim(),
      theme,
      cover_image: cover.trim() || undefined,
      description: composedDescription(),
      framings,
      start_date: startDate,
      end_date: endDate,
      venue_name: vName.trim(),
      venue_city: vCity.trim(),
      state: vState.trim(),
      venue_partner_id: venuePartnerId,
      venue_lat: latNum,
      venue_lng: lngNum,
      venue_description: venueWhy.trim(),
      seats_total: seatsNum,
      price_per_seat_inr: priceNum,
      venue_cost_per_seat_inr: venueCostNum,
      inclusions,
      audience_tags: audienceTags,
      how_to_get_there: howToGetThere.trim(),
      what_to_carry: csv(whatToCarry),
      cohort_curated: cohortCurated,
      cohort_persona_mix: personaMix,
      cohort_seniority: seniority,
      cohort_language: language,
      cohort_notes: cohortNotes.trim(),
      pre_ramp_content: preRamp.trim(),
      post_sanskara_content: postSanskara.trim(),
    });
    if (!r.ok) { setBusy(false); setErr(r.data?.error || 'Could not create the retreat.'); return; }
    const d: any = r.data?.data || {};
    const id = d.retreat_id || d.retreat?.retreat_id || d.id;
    setCreatedId(id || null);
    if (id && venueLinkProvided) {
      const cr = await sendBff(`/bff/teacher/retreats/${id}/venue`, 'POST', { maps_url: mapsUrlTrim, i_have_venue_permission: true });
      if (!cr.ok) { setBusy(false); setErr(`Your retreat was published, but the venue link couldn’t be connected: ${cr.data?.error || 'add it later from Manage.'}`); return; }
    }
    setBusy(false);
    if (activeIdRef.current) deleteDraft(activeIdRef.current);
    router.push(id ? `/app/teacher/retreats/${id}` : '/app/teacher/retreats');
    router.refresh();
  }

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="space-y-5">
      {fromDuplicate && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm" data-testid="duplicate-banner">
          <p className="font-black text-ink">🔁 New retreat from a past experience</p>
          <p className="mt-1 text-ink-soft">We&apos;ve prefilled your structure, itinerary, venue, logistics and FAQs. Please confirm the essentials for this run: <span className="font-semibold text-ink">dates, pricing, capacity, cancellation policy and that the venue is available</span>.</p>
        </div>
      )}
      {resumed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand-50/50 px-3.5 py-2.5 text-sm" data-testid="draft-resumed">
          <span className="font-semibold text-brand-700">↩ Resumed your saved draft.</span>
          <button type="button" onClick={startFresh} className="shrink-0 text-xs font-bold text-ink-soft underline hover:text-ink">Start fresh</button>
        </div>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted">
          <span>Step {step + 1} of {STEPS.length} · {STEPS[step].title}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-sm text-ink-soft">{STEPS[step].sub}</p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5" data-testid={`wizard-step-${STEPS[step].key}`}>
        {/* STEP 1 — IDENTITY */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="r-title">Retreat title *</label>
              <input id="r-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="7-day Himalayan Silence Retreat" maxLength={120} data-testid="retreat-title" />
              <p className="mt-1 text-xs text-muted">{title.trim().length}/120 · at least 6 characters</p>
            </div>
            <div>
              <label className={label} htmlFor="r-short">Short description *</label>
              <textarea id="r-short" className={`${input} min-h-[110px] resize-y`} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} maxLength={800} placeholder="In a few lines: who this retreat is for, and the shift you hold space for." data-testid="retreat-desc" />
              <p className="mt-1 text-xs text-muted">{shortDesc.trim().length}/800 · at least 40 characters</p>
            </div>
            <div>
              <label className={label} htmlFor="r-theme">Yoga style / focus</label>
              <select id="r-theme" className={input} value={theme} onChange={(e) => setTheme(e.target.value)}>
                {THEMES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="r-start">Start date *</label>
                <input id="r-start" type="date" className={input} value={startDate} min={todayIST()} onChange={(e) => setStartDate(e.target.value)} data-testid="retreat-start" />
              </div>
              <div>
                <label className={label} htmlFor="r-end">End date *</label>
                <input id="r-end" type="date" className={input} value={endDate} min={startDate || todayIST()} onChange={(e) => setEndDate(e.target.value)} data-testid="retreat-end" />
              </div>
            </div>
            {startDate && startDate < todayIST() && <p className="text-xs font-semibold text-red-600" data-testid="retreat-start-past">The start date must be today or later.</p>}
            {startDate && endDate && endDate < startDate && <p className="text-xs font-semibold text-red-600">End date must be on or after the start date.</p>}
            {nights > 0 && <p className="text-xs font-bold text-brand-700">Duration: {nights} {nights === 1 ? 'night' : 'nights'} ({nights + 1} days)</p>}
            <div>
              <label className={label} htmlFor="r-seats">Capacity (total seats) *</label>
              <input id="r-seats" inputMode="numeric" className={input} value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="18" data-testid="retreat-seats" />
              <p className="mt-1 text-xs text-muted">Between 4 and 200, and no more than your venue&apos;s capacity. You can adjust until the first seat is paid.</p>
              {seatsOverVenue && <p className="mt-1 text-xs font-semibold text-red-600" data-testid="seats-over-venue">Your selected venue holds up to {venueCapacity} guests.</p>}
            </div>
            <div>
              <label className={label}>Cover photo <span className="font-normal text-muted">· optional, but listings with a photo get noticed</span></label>
              <div className="mt-1.5"><CoverPhotoPicker value={cover} onChange={setCover} /></div>
            </div>
          </div>
        )}

        {/* STEP 2 — YOUR TEACHING */}
        {step === 1 && (
          <div className="space-y-4">
            {identity ? (
              <div className="rounded-xl border border-brand/20 bg-brand-50/40 p-4" data-testid="teaching-card">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-black text-ink">{identity.name || hostName}</p>
                  {identity.tierLabel && <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white">{identity.tierLabel}</span>}
                </div>
                {(identity.parampara || identity.rootGuru || identity.lineage.length > 0) && (
                  <p className="mt-2 text-sm text-ink-soft">
                    <span className="font-bold text-ink">Lineage:</span> {[identity.parampara, identity.rootGuru, ...identity.lineage].filter(Boolean).join(' · ')}
                  </p>
                )}
                {identity.styles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {identity.styles.slice(0, 8).map((s) => <span key={s} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line">{s}</span>)}
                  </div>
                )}
                {identity.bio && <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{identity.bio}</p>}
                {identity.experienceYears != null && <p className="mt-2 text-xs text-muted">{identity.experienceYears}+ years of practice & teaching{identity.languages.length ? ` · ${identity.languages.slice(0, 4).join(', ')}` : ''}</p>}
                <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-muted">This retreat is offered in your name and lineage. Your students stay yours — NOSTOPS never introduces them to another teacher.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-cream/50 p-4 text-sm text-ink-soft">
                Hosting as <span className="font-bold text-ink">{hostName || 'you'}</span>. Your public teacher profile carries your lineage and teaching to participants.
              </div>
            )}

            <div>
              <label className={label} htmlFor="r-carry">What participants carry home <span className="font-normal text-muted">· optional</span></label>
              <textarea id="r-carry" className={`${input} min-h-[80px] resize-y`} value={carryHome} onChange={(e) => setCarryHome(e.target.value)} maxLength={800} placeholder="A daily practice, a calmer breath, a way of seeing — what stays with them after they leave." data-testid="carry-home" />
            </div>

            <div className="rounded-xl border border-brand/20 bg-brand-50/30 p-3.5">
              <label className={label} htmlFor="r-yoga">योग से क्या होगा? · Yoga se kya hoga? <span className="font-normal text-muted">· optional, your own words</span></label>
              <p className="mt-0.5 mb-1.5 text-xs text-ink-soft">Your signature answer, shown prominently on the retreat page. Speak in your own voice — connect it to your yoga, lineage, practice and what a participant may carry forward. We never auto-write this for you.</p>
              <textarea id="r-yoga" className={`${input} min-h-[90px] resize-y`} value={yogaSeKyaHoga} onChange={(e) => setYogaSeKyaHoga(e.target.value)} maxLength={800} placeholder="Yoga se sthirta aayegi… what will yoga do for the seeker who joins you?" data-testid="yoga-se-kya-hoga-input" />
            </div>
          </div>
        )}

        {/* STEP 3 — VENUE */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Bind to an existing LISTED venue (required to publish). Reuses the
                existing public venue directory — no parallel venue API. */}
            <div className="rounded-xl border border-line bg-white p-3.5" data-testid="venue-picker-card">
              <p className="text-sm font-extrabold text-ink">Select a listed venue *</p>
              <p className="mt-0.5 mb-2 text-xs text-ink-soft">Published retreats are hosted at a venue listed on NOSTOPS. Pick yours — its name, city and location are filled in from the venue listing.</p>
              {selectedVenue ? (
                <>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand-50/50 px-3 py-2" data-testid="venue-selected">
                    <span className="text-sm font-bold text-ink">✓ {selectedVenue.name}{selectedVenue.city ? ` · ${selectedVenue.city}` : ''}{selectedVenue.state ? `, ${selectedVenue.state}` : ''}</span>
                    <button type="button" onClick={() => setVenuePartnerId('')} className="text-xs font-bold text-brand-700 hover:underline" data-testid="venue-clear">Change</button>
                  </div>
                  <VenueCapacityNote venue={selectedVenue} seats={seatsNum} />
                </>
              ) : (
                <>
                  <input className={input} value={venueQuery} onChange={(e) => setVenueQuery(e.target.value)} placeholder="Search listed venues by name or city…" data-testid="venue-search" autoCapitalize="none" />
                  <ul className="mt-2 max-h-56 divide-y divide-line overflow-auto rounded-lg border border-line" data-testid="venue-options">
                    {venueMatches.length === 0 && <li className="px-3 py-2 text-xs text-muted">No listed venues match. Get your venue listed below, then select it here.</li>}
                    {venueMatches.map((v) => (
                      <li key={v.id}>
                        <button type="button" onClick={() => selectVenue(v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-cream/60" data-testid={`venue-opt-${v.id}`}>
                          <span className="font-semibold text-ink">{v.name}</span>
                          <span className="shrink-0 text-xs text-muted">{[v.city, v.state].filter(Boolean).join(', ')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-soft">Can&apos;t find your venue? <a href="/venues/submit" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 hover:underline" data-testid="venue-getlisted">Get it listed (free) →</a> Once it&apos;s published you can select it here.</p>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className={label} htmlFor="r-venue">Venue name *</label><input id="r-venue" className={`${input} read-only:bg-cream read-only:text-ink-soft`} value={vName} onChange={(e) => setVenueName(e.target.value)} readOnly={!!selectedVenue} placeholder="Karjat Ashram" maxLength={120} data-testid="retreat-venue" /></div>
              <div><label className={label} htmlFor="r-city">City *</label><input id="r-city" className={`${input} read-only:bg-cream read-only:text-ink-soft`} value={vCity} onChange={(e) => setVenueCity(e.target.value)} readOnly={!!selectedVenue && !!selectedVenue.city} placeholder="Karjat" maxLength={80} data-testid="retreat-city" /></div>
              <div><label className={label} htmlFor="r-state">State</label><input id="r-state" className={`${input} read-only:bg-cream read-only:text-ink-soft`} value={vState} onChange={(e) => setState(e.target.value)} readOnly={!!selectedVenue && !!selectedVenue.state} placeholder="Maharashtra" maxLength={60} data-testid="retreat-state" /></div>
            </div>
            {selectedVenue && <p className="-mt-2 text-xs text-muted" data-testid="venue-fields-locked">Filled from the venue listing — change the venue above to use a different one.</p>}
            <div className="rounded-xl border border-line bg-cream/60 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-ink">Venue location *</p>
                <button type="button" onClick={useMyLocation} disabled={geoBusy} className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-brand-700 disabled:opacity-50">{geoBusy ? 'Locating…' : '📍 Use current'}</button>
              </div>
              {baseLabel && <p className="mt-1 text-xs text-muted">Your base: {baseLabel}.{hasBase && <button type="button" onClick={() => { setLat(String(baseLat)); setLng(String(baseLng)); }} className="ml-1 font-bold text-brand-700 hover:underline">Reset</button>}</p>}
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-muted" htmlFor="r-lat">Latitude</label><input id="r-lat" inputMode="decimal" className={input} value={lat} onChange={(e) => setLat(e.target.value.replace(/[^\d.-]/g, ''))} placeholder="19.0338" data-testid="retreat-lat" /></div>
                <div><label className="block text-xs font-bold text-muted" htmlFor="r-lng">Longitude</label><input id="r-lng" inputMode="decimal" className={input} value={lng} onChange={(e) => setLng(e.target.value.replace(/[^\d.-]/g, ''))} placeholder="73.0221" data-testid="retreat-lng" /></div>
              </div>
              {distFromBase != null && <p className={`mt-1.5 text-xs font-semibold ${tooFar ? 'text-red-600' : 'text-brand-700'}`}>{tooFar ? `⚠ ${Math.round(distFromBase)} km from your base — must be within ${MAX_KM} km.` : `✓ ${Math.round(distFromBase)} km from your base.`}</p>}
            </div>
            <div>
              <label className={label} htmlFor="r-maps">Venue&apos;s Google listing <span className="font-normal text-muted">· optional</span></label>
              <input id="r-maps" className={input} value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" inputMode="url" autoCapitalize="none" data-testid="retreat-maps-url" />
              <p className="mt-1 text-xs text-muted">Adds the venue&apos;s photos, rating & Google reviews to your public page.</p>
              {venueLinkProvided && !venueLinkOk && <p className="mt-1 text-xs font-semibold text-red-600">Enter a valid Google Maps / Business Profile link.</p>}
              {venueLinkProvided && (
                <label className="mt-2 flex items-start gap-2 text-xs text-ink-soft" htmlFor="r-venue-permission">
                  <input id="r-venue-permission" type="checkbox" checked={venuePermission} onChange={(e) => setVenuePermission(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" data-testid="retreat-venue-permission" />
                  <span>I have permission to reference this venue&apos;s public Google listing.</span>
                </label>
              )}
            </div>
            <div className="rounded-xl border border-brand/20 bg-brand-50/40 p-3.5">
              <label className={label} htmlFor="r-venue-why">Why I chose this place <span className="font-normal text-muted">· optional, shown to seekers</span></label>
              <textarea id="r-venue-why" className={`${input} min-h-[100px] resize-y`} value={venueWhy} onChange={(e) => setVenueWhy(e.target.value)} maxLength={1000} placeholder="What made you pick this venue for this retreat? The silence at dawn, the river, the kitchen, the way the light falls in the hall — the reason it belongs to your teaching." data-testid="venue-why" />
              <p className="mt-1 text-xs text-muted">{venueWhy.trim().length}/1000 · This appears on your public page so the venue feels part of the experience, in your voice.</p>
            </div>

            <div className="rounded-xl border border-line bg-white p-3.5" data-testid="venue-capacity-card">
              <p className="text-sm font-extrabold text-ink">Venue operational capacity <span className="font-normal text-muted">· optional guardrail</span></p>
              <p className="mt-1 text-xs text-ink-soft">The venue&apos;s own limits — how many people it can sleep, seat and feed. This is separate from your cohort size ({seatsNum || '—'} seats). If the venue can hold fewer than your cohort, we&apos;ll keep bookings within the venue&apos;s limit unless you confirm you&apos;re authorised to exceed it.</p>
              <div className="mt-3">
                <VenueCapacityPlanner value={venueCap} onChange={setVenueCap} compact />
              </div>
              {venueOperationalCap > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="text-ink-soft">Your cohort: <span className="font-bold text-ink">{seatsNum || 0}</span></span>
                  <span className="text-ink-soft">Venue capacity: <span className="font-bold text-ink">{venueOperationalCap}</span></span>
                  <span className={`font-bold ${overVenueCap ? 'text-red-600' : 'text-brand-700'}`}>Bookable: {overVenueCap && !capOverride ? venueOperationalCap : Math.max(0, seatsNum || 0)}</span>
                </div>
              )}
              {overVenueCap && (
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800" data-testid="venue-over-capacity">Your cohort of {seatsNum} exceeds this venue&apos;s operational capacity of {venueOperationalCap}.</p>
                  <label className="mt-1.5 flex items-start gap-2 text-xs text-ink-soft" htmlFor="r-cap-override">
                    <input id="r-cap-override" type="checkbox" checked={capOverride} onChange={(e) => setCapOverride(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" data-testid="venue-cap-override" />
                    <span>I&apos;m authorised to host this cohort beyond the venue&apos;s stated capacity.</span>
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="r-stay">Where they&apos;ll stay <span className="font-normal text-muted">· optional</span></label>
                <textarea id="r-stay" className={`${input} min-h-[70px] resize-y`} value={stay} onChange={(e) => setStay(e.target.value)} maxLength={600} placeholder="Twin-sharing cottages, clean linens, hot water, a quiet garden to rest in." data-testid="stay-input" />
              </div>
              <div>
                <label className={label} htmlFor="r-food">Food &amp; meals <span className="font-normal text-muted">· optional</span></label>
                <textarea id="r-food" className={`${input} min-h-[70px] resize-y`} value={food} onChange={(e) => setFood(e.target.value)} maxLength={600} placeholder="Three sattvic vegetarian meals a day, fresh and local; herbal teas through the day." data-testid="food-input" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 — EXPERIENCE */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className={label}>Daily rhythm / itinerary <span className="font-normal text-muted">· optional</span></label>
              <p className="mt-0.5 mb-2 text-xs text-muted">Add each session — yoga, pranayama, meals, satsang, excursions, rest. Shown as an experiential timeline on your public page.</p>
              <ItineraryBuilder value={itin} onChange={setItin} />
            </div>
            <div>
              <p className={label}>Who it&apos;s for <span className="font-normal text-muted">· optional</span></p>
              <div className="mt-2 flex flex-wrap gap-2" data-testid="audience-chips">{AUDIENCE.map((a) => <Chip key={a.v} active={audienceTags.includes(a.v)} onClick={() => toggle(audienceTags, setAudienceTags, a.v)}>{a.label}</Chip>)}</div>
            </div>
            <button type="button" onClick={() => setJourneyOpen((v) => !v)} className="text-sm font-bold text-brand-700 hover:underline">{journeyOpen ? '− Hide advanced' : '+ Framing & pre/post journey protocols (optional)'}</button>
            {journeyOpen && (
              <div className="space-y-3 rounded-xl border border-line bg-cream/40 p-3.5">
                <div>
                  <p className="text-xs font-bold text-muted">Framing</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">{FRAMINGS.map((f) => <Chip key={f.v} active={framings.includes(f.v)} onClick={() => toggle(framings, setFramings, f.v)}>{f.label}</Chip>)}</div>
                </div>
                <div><label className={label} htmlFor="r-preramp">14-day pre-retreat ramp</label><textarea id="r-preramp" className={`${input} min-h-[60px] resize-y`} value={preRamp} onChange={(e) => setPreRamp(e.target.value)} maxLength={5000} placeholder="How participants prepare in the two weeks before…" /></div>
                <div><label className={label} htmlFor="r-post">21-day post-retreat sanskara</label><textarea id="r-post" className={`${input} min-h-[60px] resize-y`} value={postSanskara} onChange={(e) => setPostSanskara(e.target.value)} maxLength={5000} placeholder="How they carry the practice home for three weeks after…" /></div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5 — PRICING */}
        {step === 4 && (
          <div className="space-y-4">
            {rate && (rate.suggestedLow || rate.label) && (
              <div className="rounded-xl border border-brand/20 bg-brand-50/50 p-3.5 text-sm">
                {rate.label && <p className="font-extrabold text-brand-700">{rate.label}</p>}
                {rate.suggestedLow && rate.suggestedHigh && <p className="mt-0.5 text-ink-soft">Suggested price <span className="font-normal text-muted">(advisory)</span>: <span className="font-bold text-ink">{inr(rate.suggestedLow)}–{inr(rate.suggestedHigh)}</span> per seat — price above or below as you wish.</p>}
                {rate.cooperativeNote && <p className="mt-1 text-xs text-muted">{rate.cooperativeNote}</p>}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="r-price">Participant price per seat *</label>
                <div className="mt-1.5 flex items-center rounded-xl border border-line bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                  <span className="text-base font-black text-ink">₹</span>
                  <input id="r-price" inputMode="numeric" className="w-full bg-transparent px-2 py-2.5 text-sm font-black text-ink outline-none" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="3000" data-testid="retreat-price" />
                </div>
                <p className="mt-1 text-xs text-muted">You set your price. (Minimum ₹500.)</p>
              </div>
              <div>
                <label className={label} htmlFor="r-vcost">Venue cost per seat <span className="font-normal text-muted">· optional</span></label>
                <div className="mt-1.5 flex items-center rounded-xl border border-line bg-white px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                  <span className="text-base font-black text-ink">₹</span>
                  <input id="r-vcost" inputMode="numeric" className="w-full bg-transparent px-2 py-2.5 text-sm font-black text-ink outline-none" value={venueCost} onChange={(e) => setVenueCost(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="1500" data-testid="retreat-venue-cost" />
                </div>
                <p className="mt-1 text-xs text-muted">Pass-through to the venue</p>
              </div>
            </div>
            {venueCostNum > priceNum && <p className="text-xs font-semibold text-red-600">Venue cost can&apos;t exceed the participant price.</p>}
            {priceNum >= 500 && venueCostNum <= priceNum && (
              <div className="rounded-xl border border-line bg-cream/60 p-4 text-sm" data-testid="fee-waterfall">
                <p className="mb-2 font-extrabold text-ink">Retreat economics <span className="font-normal text-muted">· advisory</span></p>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><span className="text-ink-soft">Participant pays</span><span className="font-bold text-ink">{inr(priceNum)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">NOSTOPS platform ({platformFeePct}%)</span><span className="font-semibold text-muted">− {inr(platformCut)}</span></div>
                  {venueCostNum > 0 && <div className="flex justify-between"><span className="text-ink-soft">Venue</span><span className="font-semibold text-muted">− {inr(venueCostNum)}</span></div>}
                  <div className="mt-1 flex justify-between border-t border-line pt-1.5"><span className="font-extrabold text-ink">You keep</span><span className="font-black text-brand-700">{inr(hostNetPerSeat)}</span></div>
                </div>
                {seatsNum >= 4 && <p className="mt-2 text-xs text-muted">Full house ({seatsNum} seats): you keep up to <span className="font-bold text-ink">{inr(hostNetPerSeat * seatsNum)}</span>.</p>}
              </div>
            )}
            <p className="text-xs text-muted">These figures are advisory only — your price is entirely your choice. NOSTOPS never sets a mandatory minimum or maximum.</p>
            <RetreatEconomicsCalculator
              pricePerSeat={priceNum}
              seatsTotal={seatsNum}
              platformFeePct={platformFeePct}
              minCohort={minCohortNum}
              venueCostPerSeat={venueCostNum}
            />
          </div>
        )}

        {/* STEP 6 — COHORT & GROUP OPTIONS */}
        {step === 5 && (
          <div className="space-y-5">
            <div className="space-y-3 rounded-xl border border-line bg-cream/40 p-3.5">
              <label className="flex items-start gap-2.5" htmlFor="r-curated">
                <input id="r-curated" type="checkbox" checked={cohortCurated} onChange={(e) => setCohortCurated(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" data-testid="cohort-curated" />
                <span>
                  <span className="text-sm font-extrabold text-ink">Teacher-led cohort — I approve each reservation</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">Bookings wait for your nod before they’re confirmed — so you shape the room.</span>
                </span>
              </label>
              {cohortCurated && (
                <>
                  <div>
                    <p className="text-xs font-bold text-muted">Personas you welcome</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">{PERSONAS.map((p) => <Chip key={p.v} active={personaMix.includes(p.v)} onClick={() => toggle(personaMix, setPersonaMix, p.v)}>{p.label}</Chip>)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted" htmlFor="r-sen">Seniority</label>
                      <select id="r-sen" className={input} value={seniority} onChange={(e) => setSeniority(e.target.value)}>
                        <option value="">Any</option><option value="senior">Senior</option><option value="mid">Mid</option><option value="early">Early</option><option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted" htmlFor="r-lang">Language</label>
                      <select id="r-lang" className={input} value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option value="">Any</option><option value="english">English</option><option value="hindi">Hindi</option><option value="mixed">Mixed</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted" htmlFor="r-cnotes">What you’re looking for</label>
                    <textarea id="r-cnotes" className={`${input} min-h-[60px] resize-y`} value={cohortNotes} onChange={(e) => setCohortNotes(e.target.value)} maxLength={1000} placeholder="A small, sincere group ready for early mornings and silence." />
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-line bg-white p-3.5" data-testid="min-cohort-card">
              <p className="text-sm font-extrabold text-ink">Minimum Confirmed Cohort <span className="font-normal text-muted">· your safeguard</span></p>
              <p className="mt-1 text-xs text-ink-soft">Your safeguard is a minimum number of confirmed participants — not a minimum price. Set the range and a booking deadline; you decide what happens if the minimum isn&apos;t met (we never auto-cancel).</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="r-mincohort">Minimum participants</label>
                  <input id="r-mincohort" inputMode="numeric" className={input} value={minCohort} onChange={(e) => setMinCohort(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="8" data-testid="min-cohort" />
                </div>
                <div>
                  <label className={label} htmlFor="r-maxcohort">Maximum participants</label>
                  <input id="r-maxcohort" inputMode="numeric" className={input} value={maxCohort} onChange={(e) => setMaxCohort(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder={seatsNum ? String(seatsNum) : '20'} data-testid="max-cohort" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="r-cohort-deadline">Booking deadline</label>
                  <input id="r-cohort-deadline" type="date" className={input} value={cohortDeadline} max={startDate || undefined} onChange={(e) => setCohortDeadline(e.target.value)} data-testid="cohort-deadline" />
                </div>
                <div>
                  <label className={label} htmlFor="r-shortfall">If the minimum isn&apos;t reached</label>
                  <select id="r-shortfall" className={input} value={shortfallPolicy} onChange={(e) => setShortfallPolicy(e.target.value)} data-testid="shortfall-policy">
                    <option value="continue">Continue anyway</option>
                    <option value="extend">Extend the deadline</option>
                    <option value="reduce">Reduce capacity</option>
                    <option value="manual">I&apos;ll confirm manually</option>
                    <option value="cancel">Cancel the retreat</option>
                  </select>
                </div>
              </div>
              {minCohortNum > 0 && seatsNum > 0 && minCohortNum > seatsNum && <p className="mt-1.5 text-xs font-semibold text-red-600">Minimum can&apos;t exceed your capacity ({seatsNum}).</p>}
              {maxCohortNum > 0 && seatsNum > 0 && maxCohortNum > seatsNum && <p className="mt-1.5 text-xs font-semibold text-red-600">Maximum can&apos;t exceed your capacity ({seatsNum}).</p>}
              {minCohortNum > 0 && maxCohortNum > 0 && maxCohortNum < minCohortNum && <p className="mt-1.5 text-xs font-semibold text-red-600">Maximum must be at least the minimum.</p>}
              {cohortDeadline && startDate && cohortDeadline > startDate && <p className="mt-1.5 text-xs font-semibold text-red-600">Deadline should be on or before the start date.</p>}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5" data-testid="offers-paused">
              <p className="text-sm font-extrabold text-amber-900">Early-bird, limited-time and cohort offers are paused</p>
              <p className="mt-1 text-xs text-amber-900">Participants see only your listed seat price until NOSTOPS confirms how offers are charged at booking.</p>
            </div>

            <div className="rounded-xl border border-brand/20 bg-brand-50/40 p-3.5">
              <p className="text-sm font-extrabold text-brand-700">Group bookings are on by default</p>
              <p className="mt-1 text-xs text-ink-soft">Friends, families and teams can reserve several seats together at the listed price. Group discount tiers (5+ → 5%, 10+ → 10%, 20+ → 15%): {UNAPPROVED_LABEL} You approve the group and coordinate payment.</p>
              <label className="mt-2 block text-xs font-bold text-muted" htmlFor="r-groupnote">Group terms / note <span className="font-normal">· optional</span></label>
              <textarea id="r-groupnote" className={`${input} min-h-[56px] resize-y`} value={groupNote} onChange={(e) => setGroupNote(e.target.value)} maxLength={500} placeholder="e.g. Custom pricing for corporate groups of 15+, or shared-room options for families." data-testid="group-note" />
            </div>

            <div className="rounded-xl border border-line bg-white p-3.5">
              <label className="block text-sm font-extrabold text-ink" htmlFor="r-tax">Taxes note <span className="font-normal text-muted">· optional</span></label>
              <input id="r-tax" className={input} value={taxNote} onChange={(e) => setTaxNote(e.target.value)} maxLength={140} placeholder="e.g. Inclusive of all taxes / 5% GST extra" data-testid="tax-note" />
              <p className="mt-1 text-xs text-muted">Shown to participants in the price breakdown.</p>
            </div>
          </div>
        )}

        {/* STEP 7 — POLICIES */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <p className={label}>What’s included</p>
              <p className="mt-0.5 text-xs text-muted">Yoga sessions, meditation, meals, satsang, excursions, free time…</p>
              <div className="mt-2 flex flex-wrap gap-2" data-testid="inclusion-chips">
                {INCLUSION_PRESETS.map((i) => <Chip key={i} active={incl.includes(i)} onClick={() => toggle(incl, setIncl, i)}>{i}</Chip>)}
              </div>
              <input className={`${input} mt-2`} value={inclMore} onChange={(e) => setInclMore(e.target.value)} placeholder="Add more, comma separated (e.g. Ayurveda consult, Bonfire)" />
            </div>
            <div>
              <label className={label} htmlFor="r-excl">What’s not included <span className="font-normal text-muted">· optional</span></label>
              <input id="r-excl" className={input} value={exclusions} onChange={(e) => setExclusions(e.target.value)} placeholder="Comma separated (e.g. Airfare, Personal expenses, Travel insurance)" data-testid="exclusions" />
            </div>
            <div>
              <label className={label} htmlFor="r-cxl">Cancellation policy <span className="font-normal text-muted">· optional</span></label>
              <textarea id="r-cxl" className={`${input} min-h-[90px] resize-y`} value={cancellation} onChange={(e) => setCancellation(e.target.value)} maxLength={800} placeholder={'e.g. Full refund up to 30 days before. 50% up to 14 days. No refund thereafter; seat is transferable.'} data-testid="cancellation" />
            </div>
            <div className="space-y-3 rounded-xl border border-line bg-cream/40 p-3.5">
              <p className="text-sm font-extrabold text-ink">Logistics</p>
              <div>
                <label className="block text-xs font-bold text-muted" htmlFor="r-howto">How to get there</label>
                <textarea id="r-howto" className={`${input} min-h-[70px] resize-y`} value={howToGetThere} onChange={(e) => setHowToGetThere(e.target.value)} maxLength={800} placeholder="Nearest airport / station, transfer options, driving directions…" data-testid="how-to" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-muted" htmlFor="r-carry2">What to carry</label>
                  <input id="r-carry2" className={input} value={whatToCarry} onChange={(e) => setWhatToCarry(e.target.value)} placeholder="Comma separated (e.g. Yoga mat, Warm layers)" data-testid="what-to-carry" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8 — PREVIEW */}
        {step === 7 && (
          <div className="space-y-4" data-testid="review">
            <Row k="Title" v={title} />
            <Row k="Style / focus" v={THEMES.find((t) => t.v === theme)?.label || theme} />
            <Row k="Teacher" v={identity?.name || hostName || '—'} />
            <Row k="Dates" v={`${startDate} → ${endDate}${nights ? ` · ${nights} nights` : ''}`} />
            <Row k="Venue" v={[venueName, venueCity, state].filter(Boolean).join(', ')} />
            {venueWhy.trim() && <Row k="Why this place" v={venueWhy.trim().slice(0, 140)} />}
            <Row k="Cohort" v={`${minCohortNum ? `min ${minCohortNum} · ` : ''}max ${maxCohortNum || seatsNum} confirmed`} />
            {cohortDeadline && <Row k="Booking deadline" v={cohortDeadline} />}
            <Row k="Included" v={Array.from(new Set([...incl, ...csv(inclMore)])).join(', ')} />
            {csv(exclusions).length > 0 && <Row k="Not included" v={csv(exclusions).join(', ')} />}
            {itin.length > 0 && <Row k="Itinerary" v={`${itin.length} session${itin.length === 1 ? '' : 's'} across ${new Set(itin.map((i) => i.day)).size} day(s)`} />}
            <Row k="Price / seat" v={inr(priceNum)} />
            {taxNote.trim() && <Row k="Taxes" v={taxNote.trim().slice(0, 120)} />}
            <Row k="You keep / seat" v={`${inr(hostNetPerSeat)} (after ${platformFeePct}% platform${venueCostNum ? ` + ${inr(venueCostNum)} venue` : ''})`} />
            <Row k="Curation" v={cohortCurated ? 'You approve each reservation' : 'Open — instant reservation'} />
            {cancellation.trim() && <Row k="Cancellation" v={cancellation.trim().slice(0, 120)} />}
            {venueLinkProvided && <Row k="Google venue" v={venuePermission ? 'Will connect on publish' : '—'} />}
            <p className="rounded-xl bg-cream/60 px-3.5 py-2.5 text-xs text-muted">This is exactly what seekers will see. Continue to publish when you’re happy.</p>
          </div>
        )}

        {/* STEP 9 — PUBLISH */}
        {step === 8 && (
          <div className="space-y-4" data-testid="publish-step">
            <div className="rounded-2xl border border-brand/20 bg-brand-50/40 p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-2xl shadow-sm">🚀</div>
              <h3 className="mt-3 text-lg font-black tracking-tight text-ink">Ready to go live</h3>
              <p className="mt-1 text-sm text-ink-soft">Publishing lists <span className="font-bold text-ink">{title || 'your retreat'}</span> publicly and opens reservations. You can keep editing until the first seat is paid.</p>
            </div>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li>✓ Listed on the public retreats directory and your teacher profile</li>
              <li>✓ Reservations open (individual &amp; group)</li>
              <li>✓ {cohortCurated ? 'You approve each reservation before it’s confirmed' : 'Seekers reserve instantly'}</li>
              {venueLinkProvided && <li>✓ Your venue’s Google listing connects automatically</li>}
            </ul>
            <p className="rounded-xl bg-cream/60 px-3.5 py-2.5 text-xs text-muted">Your price is entirely your choice — the figures we showed are advisory only.</p>
          </div>
        )}
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600" role="alert">{err}</p>}
      {createdId && (
        <button type="button" onClick={() => { router.push(`/app/teacher/retreats/${createdId}`); router.refresh(); }} className="w-full rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-brand-700 transition hover:bg-cream">Open your retreat →</button>
      )}

      <div className="flex items-center gap-3">
        {step > 0 && <button type="button" onClick={back} disabled={busy} className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50" data-testid="wizard-back">‹ Back</button>}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} disabled={!stepValid[step]} className="flex-1 rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50" data-testid="wizard-next">Continue →</button>
        ) : (
          <button type="button" onClick={publish} disabled={busy || !allValid} className="flex-1 rounded-xl bg-accent px-5 py-3.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50" data-testid="wizard-publish">{busy ? 'Publishing…' : 'Publish retreat'}</button>
        )}
      </div>
      {!createdId && (
        <button type="button" onClick={saveAndExit} className="w-full text-center text-xs font-bold text-muted transition hover:text-ink-soft" data-testid="wizard-save-exit">Save &amp; finish later</button>
      )}
    </div>
  );
}
