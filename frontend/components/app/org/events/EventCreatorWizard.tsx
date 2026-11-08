'use client';
// NOSTOPS Event Creator — ONE continuous guided workflow (Prompt 2) integrated
// into the existing NOSTOPS design system. Cohort → ① Organisation → ② Programme
// → ③ Configure → ④ Review → ⑤ Publish. Participants pay a per-session fee the
// organiser sets on Configure (suggested from the lib/org/pricing rate card).
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import { WEEKDAYS, MAX_SCHEDULE_DAYS, daysBetween, groupSizeMax, sessionDates, weekdayOf } from '@/lib/org/schedule';
import { COHORT_RATES } from '@/lib/org/pricing';
import ProgrammeDevNote from '@/components/ProgrammeDevNote';
import type { CohortKey } from '@/lib/org/cohort-copy';
import { card, label, input, primaryBtn, ghostBtn, Stepper, EcoRow, VIS_COPY, type Prog, type WizardCfg } from './wizard-ui';
import ProgrammePreview from './ProgrammePreview';
import ReviewStep from './ReviewStep';
import ScheduleBlock from './ScheduleBlock';
import ParticipantFee, { FEE_MAX, parseFee } from './ParticipantFee';

type Org = {
  organisation_id: string; name: string; cohort_type: string; logo_url?: string | null;
  website?: string | null; description?: string | null; contact_email?: string | null;
  contact_person?: string | null; contact_phone?: string | null; primary_city?: string | null;
  trust_state?: string;
};
type Member = { member_id: string; name: string; email?: string | null; member_role: string };
type Cohort = { key: string; label: string };
type City = { name: string; slug: string };

export type WizardProps = {
  cohorts: Cohort[];
  cities: City[];
  visibilities: string[];
  venueTypes: { key: string; label: string }[];
  timezones: string[];
  defaultTimezone: string;
  byTaxonomy: Record<string, Prog[]>;
  taxonomy: { key: string; label: string; slug: string }[];
  myOrgs: Org[];
  prefill: { name?: string; email?: string };
  initialCohort?: string | null;
  initialEvent?: (InstEventLike) | null;
  initialOrg?: Org | null;
};

type InstEventLike = {
  event_id: string; organisation_id: string; programme_id: string; programme_snapshot?: any;
  title?: string; subtitle?: string | null; event_date?: string | null; start_time?: string | null;
  end_time?: string | null; duration_minutes?: number | null; timezone?: string | null; city?: string | null;
  venue?: string | null; venue_type?: string | null; external_venue_cost?: number | null; capacity?: number | null;
  language?: string | null; registration_closing_date?: string | null; visibility?: string;
  registration_access?: string; pricing_type?: string | null; participant_fee?: number | null;
  schedule?: { type?: string; sessions_per_week?: number; weekdays?: number[]; end_date?: string | null } | null;
  programme_champion?: { member_id?: string } | null; lifecycle?: string;
};

// Backend schedule / date error codes → plain words for the organiser.
const SAVE_ERRORS: Record<string, string> = {
  registration_closing_after_event_start: 'Registration closing date cannot be after the event date.',
  schedule_weekdays_invalid: 'Pick the session days again — one day for once a week, two for twice a week.',
  schedule_start_not_on_weekday: 'Your start date must fall on one of the session days.',
  schedule_end_before_start: 'The end date must be after the start date.',
  schedule_too_long: 'A programme can run for up to 12 months — pick an earlier end date.',
  schedule_needs_two_sessions: 'This schedule has only one session — pick a later end date, or choose "One session".',
  schedule_locked_after_publish: 'This programme is already published, so its dates can no longer change.',
  paid_event_requires_fee: 'Please set the participant fee (Configure step) before publishing.',
  pricing_locked_after_publish: 'This programme is already published, so its participant fee can no longer change.',
};

// Rebuild a Prog from a frozen event programme_snapshot (draft resume / create-again).
function progFromSnapshot(s: any): Prog | null {
  if (!s || !s.programme_id) return null;
  return {
    programme_id: s.programme_id, name: s.name, taxonomy: s.taxonomy, taxonomy_label: s.taxonomy_label,
    essence: s.essence, objectives: s.objectives || [], level: s.level || 'All levels',
    default_duration_minutes: s.default_duration_minutes || 60,
    recommended_audience: s.recommended_audience || [], recommended_group_size: s.recommended_group_size,
    recommended_frequency: s.recommended_frequency, recommended_duration_label: s.recommended_duration_label,
    languages: s.languages || [], teacher_competency_requirements: s.teacher_competency_requirements || [],
    council_attribution: s.council_attribution, version: s.version, content_status: s.content_status,
  };
}

const COHORT_ICONS: Record<string, string> = { COMPANY: '🏢', EDUCATIONAL_INSTITUTION: '🎓', STARTUP_NETWORK: '👥' };
const COHORT_TAG: Record<string, string> = { COMPANY: 'Work Better. Live Better.', EDUCATIONAL_INSTITUTION: 'Learn Better. Grow Better.', STARTUP_NETWORK: 'Build Better. Scale Better.' };
const DEFAULT_LANGUAGES = ['English', 'Hindi', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Gujarati'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Same rule as the backend (institutional._validate_org_contact): 7–15 digits,
// optional leading +, spaces / dashes / dots / brackets allowed.
function isValidContactPhone(phone: string): boolean {
  const p = phone.trim();
  const digits = p.replace(/\D/g, '');
  return /^\+?[\d\s\-().]{7,22}$/.test(p) && digits.length >= 7 && digits.length <= 15;
}

// Downscale an image file to a <=512px square-ish PNG/JPEG data-URI (keeps logo
// uploads small). Returns { base64, contentType }.
function readAndResize(file: File): Promise<{ base64: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        let { width, height } = img;
        if (width > max || height > max) {
          const r = Math.min(max / width, max / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no ctx'));
        ctx.drawImage(img, 0, 0, width, height);
        const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve({ base64: canvas.toDataURL(type, 0.9), contentType: type });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Cohort page hosting the "Request a proposal" form (same paths as lib/org/cohort-copy).
const COHORT_ENQUIRY_PATH: Record<string, string> = {
  COMPANY: '/for-organisations/companies',
  EDUCATIONAL_INSTITUTION: '/for-organisations/educational-institutions',
  STARTUP_NETWORK: '/for-organisations/startup-networking-groups',
};

export default function EventCreatorWizard(props: WizardProps) {
  const router = useRouter();
  const ie = props.initialEvent || null;        // resumed draft / create-again target
  const io = props.initialOrg || null;
  const [phase, setPhase] = useState<'cohort' | number>(ie ? 2 : 'cohort');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Selections
  const [cohort, setCohort] = useState<string>(io?.cohort_type || props.initialCohort || '');
  const [orgId, setOrgId] = useState<string>(io?.organisation_id || '');
  const [org, setOrg] = useState<{ name: string; website: string; contactEmail: string; contactPerson: string; contactPhone: string; about: string; city: string; logoUrl: string }>({
    name: io?.name || '', website: io?.website || '', contactEmail: io?.contact_email || props.prefill.email || '',
    contactPerson: io?.contact_person || props.prefill.name || '', contactPhone: io?.contact_phone || '',
    about: io?.description || '', city: io?.primary_city || '', logoUrl: io?.logo_url || '',
  });
  const [programme, setProgramme] = useState<Prog | null>(ie ? progFromSnapshot(ie.programme_snapshot) : null);
  const [activeTax, setActiveTax] = useState<string>(props.taxonomy[0]?.key || 'MIND');
  const [progQuery, setProgQuery] = useState('');
  const [previewProg, setPreviewProg] = useState<Prog | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cfg, setCfg] = useState<WizardCfg>({
    title: ie?.title || '', subtitle: ie?.subtitle || '', date: ie?.event_date || '', startTime: ie?.start_time || '',
    endTime: ie?.end_time || '', duration: String(ie?.duration_minutes || 60), timezone: ie?.timezone || props.defaultTimezone || 'Asia/Kolkata',
    city: ie?.city || '', venue: ie?.venue || '', venueType: ie?.venue_type || 'EXISTING_SPACE',
    externalVenueCost: ie?.external_venue_cost != null ? String(ie.external_venue_cost) : '',
    capacity: ie?.capacity != null ? String(ie.capacity) : '', language: ie?.language || 'English',
    regClose: ie?.registration_closing_date || '', visibility: ie?.visibility || 'PRIVATE',
    regAccess: ie?.registration_access || 'OPEN',
    championMemberId: ie?.programme_champion?.member_id || '',
    // B2.2 — repeating programme: 1 or 2 sessions a week until an end date.
    repeat: ie?.schedule?.type === 'RECURRING',
    perWeek: ie?.schedule?.sessions_per_week || 1,
    weekdays: ie?.schedule?.weekdays || [],
    endDate: ie?.schedule?.end_date || '',
    // Participant fee — null follows the rate-card suggestion until the organiser types one.
    fee: ie?.participant_fee ? String(ie.participant_fee) : null,
  });
  const [eventId, setEventId] = useState<string>(ie?.event_id || '');
  // True once the draft holds a fee (resumed with one, or Configure saved it), so
  // later draft saves keep that stored fee in step with what is shown.
  const [feeStored, setFeeStored] = useState<boolean>(!!ie?.participant_fee);
  const [published, setPublished] = useState<{ path: string | null; indexable: boolean } | null>(null);
  // A logo chosen before the organisation exists is held here (already resized)
  // and uploaded as part of "Save & Continue" (OEA-22).
  const [pendingLogo, setPendingLogo] = useState<{ base64: string; contentType: string } | null>(null);

  // Pre-select an existing org when the user has exactly one for the chosen
  // cohort (common case); when resuming a draft, load its org's members for the
  // Programme Champion picker.
  useEffect(() => {
    if (ie && orgId) { fetchMembers(orgId); return; }
    const candidates = props.initialCohort ? props.myOrgs.filter((o) => o.cohort_type === props.initialCohort) : props.myOrgs;
    if (candidates.length === 1 && !orgId) selectExistingOrg(candidates[0]);
    // Mount-only: pre-select the single matching organisation once, never re-run on edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectExistingOrg(o: Org) {
    setOrgId(o.organisation_id);
    setCohort(o.cohort_type);
    setOrg({
      name: o.name || '', website: o.website || '', contactEmail: o.contact_email || props.prefill.email || '',
      contactPerson: o.contact_person || props.prefill.name || '', contactPhone: o.contact_phone || '',
      about: o.description || '', city: o.primary_city || '', logoUrl: o.logo_url || '',
    });
  }

  // ── Schedule (B2.2) ─────────────────────────────────────────────────────────
  const startDay = weekdayOf(cfg.date);
  const plannedDates = cfg.repeat && cfg.date && cfg.endDate ? sessionDates(cfg.date, cfg.weekdays, cfg.endDate) : [];
  // Group-size guidance: warn (never block) above the programme's recommendation.
  const groupMax = groupSizeMax(programme?.recommended_group_size);
  const overGroup = !!(groupMax && cfg.capacity && Number(cfg.capacity) > groupMax);

  // ── Participant fee ─────────────────────────────────────────────────────────
  // Suggestion = the NOSTOPS list rate for this cohort. Prompt 3C: no group-size or
  // commitment discount applies (those discounts are suspended).
  const rateCohort: CohortKey = cohort in COHORT_RATES ? (cohort as CohortKey) : 'COMPANY';
  const suggestedFee = COHORT_RATES[rateCohort].rate;
  const feeText = cfg.fee ?? String(suggestedFee);
  const fee = parseFee(feeText);
  const feeLabel = fee ? `₹${fee.toLocaleString('en-IN')}` : '—';
  function feeError(requireFee: boolean): string {
    if (feeText.trim() === '') return requireFee ? 'Please enter the participant fee.' : '';
    return fee == null ? `Enter a whole number of rupees for the participant fee, from ₹1 to ₹${FEE_MAX.toLocaleString('en-IN')}.` : '';
  }

  // Keep the start date's weekday among the session days (it is session 1).
  function withDay(days: number[], d: number, perWeek: number, keep: number | null): number[] {
    const next = days.includes(d) ? [...days] : [...days, d];
    while (next.length > perWeek) {
      const i = next.findIndex((x) => x !== keep && x !== d);
      next.splice(i >= 0 ? i : 0, 1);
    }
    return next;
  }
  function setStartDate(date: string) {
    // Never silently swap a day the organiser picked: add the start day only if
    // there is room; otherwise scheduleError() explains the mismatch.
    setCfg((c) => {
      const d = weekdayOf(date);
      if (d == null || !c.repeat || c.weekdays.includes(d) || c.weekdays.length >= c.perWeek) return { ...c, date };
      return { ...c, date, weekdays: [...c.weekdays, d] };
    });
  }
  function toggleWeekday(d: number) {
    setCfg((c) => (c.weekdays.includes(d)
      ? { ...c, weekdays: c.weekdays.filter((x) => x !== d) }
      : { ...c, weekdays: withDay(c.weekdays, d, c.perWeek, weekdayOf(c.date)) }));
  }
  function setPerWeek(n: number) {
    setCfg((c) => {
      const s = weekdayOf(c.date);
      const ordered = s != null && c.weekdays.includes(s) ? [s, ...c.weekdays.filter((x) => x !== s)] : c.weekdays;
      return { ...c, perWeek: n, weekdays: ordered.slice(0, n) };
    });
  }
  // Switching to a repeating programme starts with the start date's weekday.
  function setRepeat(on: boolean) {
    setCfg((c) => (on
      ? { ...c, repeat: true, weekdays: c.weekdays.length ? c.weekdays.slice(0, c.perWeek) : (startDay != null ? [startDay] : []) }
      : { ...c, repeat: false }));
  }
  function scheduleBody() {
    return cfg.repeat
      ? { type: 'RECURRING', sessions_per_week: cfg.perWeek, weekdays: [...cfg.weekdays].sort((a, b) => a - b), end_date: cfg.endDate || undefined }
      : { type: 'SINGLE' };
  }
  function scheduleError(): string {
    if (!cfg.repeat) return '';
    if (cfg.weekdays.length !== cfg.perWeek) return `Pick ${cfg.perWeek === 2 ? 'two days' : 'one day'} of the week for the sessions.`;
    if (!cfg.date || !cfg.endDate) return cfg.date ? 'Please pick the date the programme ends.' : '';
    if (startDay != null && !cfg.weekdays.includes(startDay)) return `Your start date is a ${WEEKDAYS[startDay]} — make it one of the session days, or change the start date.`;
    const span = daysBetween(cfg.date, cfg.endDate);
    if (span == null || span <= 0) return 'The end date must be after the start date.';
    if (span > MAX_SCHEDULE_DAYS) return 'A programme can run for up to 12 months — pick an earlier end date.';
    if (plannedDates.length < 2) return 'This schedule has only one session — pick a later end date, or choose "One session".';
    return '';
  }

  // ── Save as DRAFT at any stage (Prompt 3 §11). Requires org + programme +
  // a title; date/city are NOT required for a draft. Routes to the Drafts list.
  async function saveDraft() {
    setErr('');
    if (!orgId) { setErr('Please save your organisation first.'); return; }
    if (!programme) { setErr('Choose a programme before saving a draft.'); return; }
    if (!cfg.repeat && cfg.regClose && cfg.date && cfg.regClose > cfg.date) {
      setErr('Registration closing date cannot be after the event date.'); return;
    }
    const se = scheduleError() || feeError(false);
    if (se) { setErr(se); return; }
    setBusy(true);
    try {
      if (await saveEvent(programme, 'Could not save draft.', cfg.fee !== null || feeStored)) router.push('/app/org/events?tab=drafts');
      else setBusy(false);
    } catch { setErr('Something went wrong. Please try again.'); setBusy(false); }
  }

  // One request body for "Save draft" and "Save & Continue". Every wizard
  // programme is PAID: participants pay the organiser's per-session fee. A draft
  // only stores a fee the organiser typed, so an untouched fee keeps following
  // the rate-card suggestion after resume.
  function eventBody(p: Prog, withFee: boolean): Record<string, unknown> {
    return {
      organisation_id: orgId, programme_id: p.programme_id,
      title: cfg.title.trim() || `${p.name} – ${org.name}`.trim(),
      subtitle: cfg.subtitle || undefined, event_date: cfg.date || undefined,
      start_time: cfg.startTime || undefined, end_time: cfg.endTime || undefined,
      duration_minutes: Number(cfg.duration) || 60, timezone: cfg.timezone, city: cfg.city || undefined,
      venue: cfg.venue || undefined, venue_type: cfg.venueType,
      external_venue_cost: cfg.venueType === 'EXTERNAL_VENUE' && cfg.externalVenueCost ? Number(cfg.externalVenueCost) : undefined,
      capacity: cfg.capacity ? Number(cfg.capacity) : undefined, language: cfg.language,
      registration_closing_date: (!cfg.repeat && cfg.regClose) || undefined, visibility: cfg.visibility,
      registration_access: cfg.regAccess,
      programme_champion_member_id: cfg.championMemberId || undefined,
      schedule: scheduleBody(),
      pricing_type: 'PAID',
      participant_fee: (withFee && fee) || undefined,
    };
  }

  // Create the DRAFT (first save) or PATCH it; shows the error and returns false on failure.
  async function saveEvent(p: Prog, fallback: string, withFee = true): Promise<boolean> {
    const body = eventBody(p, withFee);
    const res = eventId
      ? await sendBff(`/bff/institutional/events/${eventId}`, 'PATCH', body)
      : await postBff('/bff/institutional/events', body);
    if (!res.ok) { setErr(SAVE_ERRORS[res.data?.error] || res.data?.error || fallback); return false; }
    if (!eventId && res.data?.event?.event_id) setEventId(res.data.event.event_id);
    return true;
  }

  async function fetchMembers(id: string) {
    const r = await fetch(`/bff/institutional/organisations/${id}/members`, { credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(d.members)) setMembers(d.members);
  }

  // ── Step 1: Organisation ───────────────────────────────────────────────────
  async function saveOrganisation() {
    setErr('');
    if (org.name.trim().length < 2) { setErr('Please enter the organisation name.'); return; }
    if (!cohort) { setErr('Please choose an organisation type.'); return; }
    if (!EMAIL_RE.test(org.contactEmail.trim())) { setErr('Please enter a valid contact email.'); return; }
    if (org.contactPerson.trim().length > 120) { setErr('Contact person must be 120 characters or fewer.'); return; }
    if (org.contactPhone.trim() && !isValidContactPhone(org.contactPhone)) {
      setErr('Please enter a valid contact phone number (7–15 digits, e.g. +91 98200 12345).'); return;
    }
    setBusy(true);
    try {
      let id = orgId;
      if (!id) {
        const res = await postBff('/bff/institutional/organisations', {
          name: org.name, cohort_type: cohort, website: org.website, contact_email: org.contactEmail,
          contact_person: org.contactPerson, contact_phone: org.contactPhone,
          description: org.about, city: org.city,
        });
        if (!res.ok) { setErr(res.data?.error || 'Could not save organisation.'); setBusy(false); return; }
        id = res.data.organisation.organisation_id; setOrgId(id);
      } else {
        const res = await sendBff(`/bff/institutional/organisations/${id}`, 'PATCH', {
          name: org.name, website: org.website, contact_email: org.contactEmail, contact_person: org.contactPerson,
          contact_phone: org.contactPhone, description: org.about, city: org.city,
        });
        if (!res.ok) { setErr(res.data?.error || 'Could not save organisation.'); setBusy(false); return; }
      }
      // Upload a logo picked before the organisation existed; stay on this step if it fails.
      if (pendingLogo && !(await uploadLogo(id, pendingLogo))) { setBusy(false); return; }
      await fetchMembers(id);
      setBusy(false);
      setPhase(1); // Programme
    } catch {
      setErr('Something went wrong. Please try again.'); setBusy(false);
    }
  }

  async function uploadLogo(id: string, data: { base64: string; contentType: string }): Promise<boolean> {
    const res = await postBff(`/bff/institutional/organisations/${id}/logo`, data);
    if (!res.ok) { setErr(res.data?.error || 'Could not upload logo.'); return false; }
    setOrg((o) => ({ ...o, logoUrl: res.data.url }));
    setPendingLogo(null);
    return true;
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    let data: { base64: string; contentType: string };
    try { data = await readAndResize(file); } catch { setErr('Could not read that image.'); return; }
    if (!orgId) {
      // Not saved yet: preview now, upload on "Save & Continue" (no premature step change).
      setPendingLogo(data);
      setOrg((o) => ({ ...o, logoUrl: data.base64 }));
      return;
    }
    setBusy(true);
    try { await uploadLogo(orgId, data); } catch { setErr('Could not upload logo.'); }
    setBusy(false);
  }

  // ── Step 2: Programme ────────────────────────────────────────────────────────
  function chooseProgramme(p: Prog) {
    setProgramme(p);
    const langs = p.languages && p.languages.length ? p.languages : DEFAULT_LANGUAGES;
    setCfg((c) => ({
      ...c,
      title: c.title || `${p.name} – ${org.name}`.trim(),
      duration: String(p.default_duration_minutes || 60),
      language: langs.includes(c.language) ? c.language : langs[0],
    }));
  }

  // ── Step 3: Configure → create/update the DRAFT event ────────────────────────
  async function saveConfigure() {
    setErr('');
    if (!programme) { setErr('Please choose a programme.'); return; }
    if (cfg.title.trim().length < 3) { setErr('Please enter an event title.'); return; }
    if (!cfg.date) { setErr(cfg.repeat ? 'Please pick a start date.' : 'Please pick a date.'); return; }
    if (!cfg.city) { setErr('Please choose a city.'); return; }
    const se = scheduleError();
    if (se) { setErr(se); return; }
    if (!cfg.repeat && cfg.regClose && cfg.date && cfg.regClose > cfg.date) {
      setErr('Registration closing date cannot be after the event date.'); return;
    }
    if (cfg.venueType === 'EXTERNAL_VENUE' && cfg.externalVenueCost && Number(cfg.externalVenueCost) < 0) {
      setErr('Venue cost cannot be negative.'); return;
    }
    const fe = feeError(true);
    if (fe) { setErr(fe); return; }
    setBusy(true);
    try {
      const ok = await saveEvent(programme, 'Could not save event.');
      setBusy(false);
      if (ok) { setFeeStored(true); setPhase(3); } // Review
    } catch { setErr('Something went wrong. Please try again.'); setBusy(false); }
  }

  // ── Step 5: Publish ──────────────────────────────────────────────────────────
  async function publish() {
    setErr(''); setBusy(true);
    try {
      const res = await postBff(`/bff/institutional/events/${eventId}/publish`);
      if (!res.ok) { setErr(SAVE_ERRORS[res.data?.error] || res.data?.error || 'Could not publish.'); setBusy(false); return; }
      setPublished({ path: res.data.public_path || null, indexable: !!res.data.indexable });
      setBusy(false);
      setPhase(4); // Publish/done
    } catch { setErr('Something went wrong. Please try again.'); setBusy(false); }
  }

  const champion = useMemo(() => members.find((m) => m.member_id === cfg.championMemberId) || null, [members, cfg.championMemberId]);
  const cohortLabel = props.cohorts.find((c) => c.key === cohort)?.label || '';
  // OEA-21 — saved organisations shown only for the cohort being created.
  const cohortOrgs = cohort ? props.myOrgs.filter((o) => o.cohort_type === cohort) : props.myOrgs;

  const allProgs = useMemo(() => Object.values(props.byTaxonomy || {}).flat() as Prog[], [props.byTaxonomy]);
  const visibleProgs = useMemo(() => {
    const q = progQuery.trim().toLowerCase();
    if (q) {
      return allProgs.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.essence || '').toLowerCase().includes(q) ||
        (p.objectives || []).some((o) => o.toLowerCase().includes(q)) ||
        (p.taxonomy_label || '').toLowerCase().includes(q),
      );
    }
    return (props.byTaxonomy[activeTax] || []) as Prog[];
  }, [allProgs, progQuery, props.byTaxonomy, activeTax]);
  // Explicit customisation request → the cohort's enquiry form, prefilled with
  // the cohort and the pathway being browsed. Opens in a new tab so the draft
  // wizard is kept. Never shown as a forced step.
  const customiseHref = `${COHORT_ENQUIRY_PATH[cohort] || '/for-organisations'}?customise=1&interest=${encodeURIComponent(activeTax)}&cohort=${encodeURIComponent(cohort)}#enquire`;

  return (
    <div className="mx-auto max-w-3xl" data-guru-cohort={cohort || undefined}>
      {phase !== 'cohort' && (
        <div className="mb-6 flex items-start justify-between gap-3">
          <Stepper active={phase as number} />
          {programme && (phase as number) >= 1 && (
            <button type="button" onClick={saveDraft} disabled={busy} data-testid="save-draft"
              className="inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50">
              {busy ? 'Saving…' : '💾 Save draft & exit'}
            </button>
          )}
        </div>
      )}
      {err && <p data-testid="wizard-error" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</p>}

      {/* ── COHORT ────────────────────────────────────────────── */}
      {phase === 'cohort' && (
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Create a Programme</h1>
          <p className="mt-2 text-ink-soft">Bring the power of Yoga to your organisation, students or community.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {props.cohorts.map((co) => {
              const sel = cohort === co.key && !orgId;
              return (
                <button key={co.key} type="button" data-testid={`cohort-${co.key}`}
                  onClick={() => { setCohort(co.key); setOrgId(''); }}
                  className={`${card} text-left transition ${sel ? 'ring-2 ring-brand' : 'hover:border-brand/40'}`}>
                  <span className="text-3xl" aria-hidden>{COHORT_ICONS[co.key]}</span>
                  <p className="mt-3 text-base font-extrabold text-ink">{co.label}</p>
                  <p className="mt-1 text-sm text-ink-soft">{COHORT_TAG[co.key]}</p>
                </button>
              );
            })}
          </div>

          {cohortOrgs.length > 0 && (
            <div className="mt-6" data-testid="existing-orgs">
              <p className={label}>Or continue with an existing {cohortLabel ? `${cohortLabel} ` : ''}organisation</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cohortOrgs.map((o) => (
                  <button key={o.organisation_id} type="button" data-testid={`existing-org-${o.organisation_id}`}
                    onClick={() => selectExistingOrg(o)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${orgId === o.organisation_id ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-ink hover:bg-cream'}`}>
                    {o.logo_url ? '🖼 ' : ''}{o.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button type="button" className={primaryBtn} data-testid="cohort-continue" disabled={!cohort}
              onClick={() => { if (orgId) { fetchMembers(orgId); setPhase(1); } else setPhase(0); }}>
              Get Started →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: ORGANISATION ───────────────────────────────── */}
      {phase === 0 && (
        <div className={card}>
          <h2 className="text-xl font-black tracking-tight text-ink">Tell us about your organisation</h2>
          <p className="mt-1 text-sm text-ink-soft">{cohortLabel} · this profile and logo are saved and reused for future events.</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-[150px_1fr]">
            <div>
              <p className={label}>Organisation Logo</p>
              <div className="mt-1 grid aspect-square w-full max-w-[150px] place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-cream">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote logo URL, no next/image loader */}
                {org.logoUrl ? <img src={org.logoUrl} alt="logo" className="h-full w-full object-contain p-2" data-testid="logo-preview" /> : <span className="px-2 text-center text-[11px] text-muted">PNG, JPG (max ~2MB)</span>}
              </div>
              <label className={`${ghostBtn} mt-2 w-full cursor-pointer !min-h-0 !py-2 text-xs`}>
                {org.logoUrl ? 'Change Logo' : 'Upload your logo'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogoFile} data-testid="logo-input" />
              </label>
              {pendingLogo && <p className="mt-1 text-[11px] text-muted" data-testid="logo-pending">Your logo is saved when you click Save &amp; Continue.</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4">
                <div><label className={label}>Organisation Name *</label><input className={input} value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} data-testid="org-name" placeholder="e.g. Tata Consultancy Services" /></div>
                <div><label className={label}>Organisation Type</label><input className={`${input} bg-cream`} value={cohortLabel} readOnly /></div>
              </div>
              <div><label className={label}>Website</label><input className={input} value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} placeholder="https://" /></div>
              <div><label className={label}>Contact Email *</label><input className={input} value={org.contactEmail} onChange={(e) => setOrg({ ...org, contactEmail: e.target.value })} data-testid="org-email" /></div>
              <div><label className={label}>Contact Person</label><input className={input} value={org.contactPerson} maxLength={120} onChange={(e) => setOrg({ ...org, contactPerson: e.target.value })} data-testid="org-contact-person" /></div>
              <div><label className={label}>Contact Phone</label><input type="tel" inputMode="tel" autoComplete="tel" maxLength={22} className={input} value={org.contactPhone} onChange={(e) => setOrg({ ...org, contactPhone: e.target.value })} placeholder="+91 ..." data-testid="org-contact-phone" /></div>
              <div className="sm:col-span-2"><label className={label}>About Your Organisation</label><textarea className={`${input} min-h-[90px]`} value={org.about} onChange={(e) => setOrg({ ...org, about: e.target.value })} /></div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" className={ghostBtn} onClick={() => setPhase('cohort')}>← Back</button>
            <button type="button" className={primaryBtn} disabled={busy} onClick={saveOrganisation} data-testid="org-continue">{busy ? 'Saving…' : 'Save & Continue →'}</button>
          </div>
        </div>
      )}

      {/* ── STEP 2: PROGRAMME ──────────────────────────────────── */}
      {phase === 1 && (
        <div>
          <h2 className="text-xl font-black tracking-tight text-ink">Choose a Council-Curated Programme</h2>
          <p className="mt-1 text-sm text-ink-soft">Select a Council-curated Yoga programme. The Council owns the programme content; you add only your organisation&rsquo;s event details (date, venue, title) in the next step.</p>

          {/* Council Programme vs Organisation Event explainer */}
          <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-cream/60 p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">✓ Council Programme</p>
              <p className="mt-1 text-sm font-semibold text-ink">e.g. &ldquo;Yoga for Focus &amp; Attention&rdquo;</p>
              <p className="mt-0.5 text-xs text-muted">Versioned, teacher-led Council content — cannot be edited. In development — pending Council review.</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Your Organisation Event</p>
              <p className="mt-1 text-sm font-semibold text-ink">e.g. &ldquo;Yoga for Focus &amp; Attention — {org.name || 'Your Org'} — your date&rdquo;</p>
              <p className="mt-0.5 text-xs text-muted">A specific occurrence you schedule from the programme.</p>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              className={input}
              value={progQuery}
              onChange={(e) => setProgQuery(e.target.value)}
              placeholder="Search programmes (e.g. sleep, back care, chair)…"
              data-testid="prog-search"
            />
          </div>

          {/* Taxonomy filter — hidden while searching across all categories */}
          {!progQuery.trim() && (
            <div className="mt-3 flex gap-2 rounded-xl bg-cream p-1">
              {props.taxonomy.map((t) => (
                <button key={t.key} type="button" data-testid={`tax-${t.key}`} onClick={() => setActiveTax(t.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${activeTax === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}>{t.label}</button>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {visibleProgs.map((p) => {
              const sel = programme?.programme_id === p.programme_id;
              return (
                <div key={p.programme_id} data-testid={`prog-${p.programme_id}`}
                  className={`${card} flex flex-col text-left transition ${sel ? 'ring-2 ring-brand' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Council</span>
                      <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-ink-soft">{p.taxonomy_label}</span>
                      {p.version && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{p.version}</span>}
                      <ProgrammeDevNote programme={p} size="xs" />
                    </div>
                    {sel && <span className="text-brand">✓</span>}
                  </div>
                  <p className="mt-2 text-sm font-extrabold text-ink">{p.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">{p.essence}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted">
                    {p.recommended_group_size && <span className="rounded-md bg-cream px-2 py-0.5">👥 {p.recommended_group_size}</span>}
                    {p.recommended_frequency && <span className="rounded-md bg-cream px-2 py-0.5" title="Council guidance for this programme">🔁 {p.recommended_frequency} (recommended)</span>}
                    {p.recommended_duration_label && <span className="rounded-md bg-cream px-2 py-0.5">⏱ {p.recommended_duration_label}</span>}
                  </div>
                  <div className="mt-auto flex gap-2 pt-4">
                    <button type="button" data-testid={`prog-preview-${p.programme_id}`} onClick={() => setPreviewProg(p)}
                      className={`${ghostBtn} flex-1 !min-h-0 !py-2 text-xs`}>Preview</button>
                    <button type="button" data-testid={`prog-select-${p.programme_id}`} onClick={() => chooseProgramme(p)}
                      className={`${primaryBtn} flex-1 !min-h-0 !py-2 text-xs ${sel ? '!bg-emerald-600' : ''}`}>{sel ? 'Selected ✓' : 'Select'}</button>
                  </div>
                </div>
              );
            })}
            {visibleProgs.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-line bg-white p-6 text-center" data-testid="prog-no-results">
                <p className="text-sm font-semibold text-ink">No programmes match &ldquo;{progQuery}&rdquo;.</p>
                <p className="mt-1 text-xs text-muted">Search looks at programme names and descriptions only. It never suggests a programme from a health condition.</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {props.taxonomy.map((t) => (
                    <button key={t.key} type="button" data-testid={`prog-browse-${t.key}`}
                      onClick={() => { setProgQuery(''); setActiveTax(t.key); }}
                      className={`${ghostBtn} !min-h-[40px] !py-2 text-xs`}>Browse {t.label}</button>
                  ))}
                </div>
                <a href={customiseHref} target="_blank" rel="noopener noreferrer" data-testid="prog-no-results-customise"
                  className="mt-3 inline-block text-sm font-bold text-brand-700 hover:underline">Need something different? Request a customised programme →</a>
              </div>
            )}
          </div>

          {visibleProgs.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Need something different?{' '}
              <a href={customiseHref} target="_blank" rel="noopener noreferrer" data-testid="prog-customise-link"
                className="font-bold text-brand-700 hover:underline">Request a customised programme →</a>
            </p>
          )}

          {programme && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm" data-testid="prog-selected">
              <span className="font-bold text-brand-700">Selected:</span>
              <span className="font-semibold text-ink">{programme.name}</span>
              {programme.version && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-brand-700">Council {programme.version}</span>}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button type="button" className={ghostBtn} onClick={() => setPhase(0)}>← Back</button>
            <button type="button" className={primaryBtn} disabled={!programme} onClick={() => setPhase(2)} data-testid="prog-continue">Save &amp; Continue →</button>
          </div>

          {previewProg && (
            <ProgrammePreview
              p={previewProg}
              orgName={org.name}
              selected={programme?.programme_id === previewProg.programme_id}
              onSelect={() => { chooseProgramme(previewProg); setPreviewProg(null); }}
              onClose={() => setPreviewProg(null)}
            />
          )}
        </div>
      )}

      {/* ── STEP 3: CONFIGURE ──────────────────────────────────── */}
      {phase === 2 && (
        <div className={card}>
          <h2 className="text-xl font-black tracking-tight text-ink">Configure Your Event</h2>
          <p className="mt-1 text-sm text-ink-soft">Set the schedule, venue and other details. The Council programme content stays fixed — you&rsquo;re creating your organisation&rsquo;s specific event.</p>

          {/* Read-only context: Council Programme + Organisation */}
          <div className="mt-4 flex flex-wrap gap-2" data-testid="cfg-context">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">✓ {programme?.name}{programme?.version ? ` · ${programme.version}` : ''}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-ink-soft">🏢 {org.name || cohortLabel}</span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="grid gap-4">
              <div><label className={label}>Event Title *</label><input className={input} value={cfg.title} onChange={(e) => setCfg({ ...cfg, title: e.target.value })} data-testid="cfg-title" /></div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={label}>{cfg.repeat ? 'Start date *' : 'Date *'}</label><input type="date" className={input} value={cfg.date} onChange={(e) => setStartDate(e.target.value)} data-testid="cfg-date" /></div>
                <div><label className={label}>Timezone</label>
                  <select className={input} value={cfg.timezone} onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })} data-testid="cfg-timezone">
                    {props.timezones.map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label className={label}>Start time</label><input type="time" className={input} value={cfg.startTime} onChange={(e) => setCfg({ ...cfg, startTime: e.target.value })} data-testid="cfg-start" /></div>
                <div><label className={label}>End time</label><input type="time" className={input} value={cfg.endTime} onChange={(e) => setCfg({ ...cfg, endTime: e.target.value })} /></div>
                <div><label className={label}>Duration (mins)</label><input type="number" className={input} value={cfg.duration} onChange={(e) => setCfg({ ...cfg, duration: e.target.value })} data-testid="cfg-duration" /></div>
              </div>

              <ScheduleBlock cfg={cfg} plannedDates={plannedDates} recommendedFrequency={programme?.recommended_frequency}
                onRepeat={setRepeat} onPerWeek={setPerWeek} onToggleDay={toggleWeekday} onEndDate={(d) => setCfg({ ...cfg, endDate: d })} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={label}>City *</label>
                  <select className={input} value={cfg.city} onChange={(e) => setCfg({ ...cfg, city: e.target.value })} data-testid="cfg-city">
                    <option value="">Select a city</option>
                    {props.cities.map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className={label}>Participant Capacity{cfg.repeat ? ' (per session)' : ''}</label>
                  <input type="number" min={1} className={input} value={cfg.capacity} onChange={(e) => setCfg({ ...cfg, capacity: e.target.value })} data-testid="cfg-capacity" placeholder="e.g. 25" />
                  {programme?.recommended_group_size && (
                    <p className="mt-1 text-[11px] text-muted" data-testid="cfg-recommended-group">Recommended for this programme: {programme.recommended_group_size}.</p>
                  )}
                  {overGroup && (
                    <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800" data-testid="capacity-warning" role="status">
                      ⚠ {cfg.capacity} is above this programme&rsquo;s recommended group size. You can still continue — a smaller group, or a second group, helps every participant get the teacher&rsquo;s attention.
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted">Group size is configurable and affects programme economics.</p>
                </div>
              </div>

              {/* Venue type (Prompt §6) */}
              <div className="rounded-2xl border border-line bg-cream/50 p-4">
                <p className={label}>Venue</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {props.venueTypes.map((vt) => (
                    <label key={vt.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${cfg.venueType === vt.key ? 'border-brand bg-white' : 'border-line bg-white/60'}`}>
                      <input type="radio" name="venueType" checked={cfg.venueType === vt.key} onChange={() => setCfg({ ...cfg, venueType: vt.key })} data-testid={`venue-type-${vt.key}`} className="mt-0.5" />
                      <span className="font-semibold text-ink">{vt.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label className={label}>{cfg.venueType === 'EXTERNAL_VENUE' ? 'Venue name / address' : 'Space name (optional)'}</label>
                  <input className={input} value={cfg.venue} onChange={(e) => setCfg({ ...cfg, venue: e.target.value })} data-testid="cfg-venue" placeholder={cfg.venueType === 'EXTERNAL_VENUE' ? 'e.g. Rented studio, MG Road' : 'e.g. Office Terrace / Campus Hall'} />
                </div>
                {cfg.venueType === 'EXTERNAL_VENUE' ? (
                  <div className="mt-3">
                    <label className={label}>Estimated venue cost (₹, optional)</label>
                    <input type="number" min={0} className={input} value={cfg.externalVenueCost} onChange={(e) => setCfg({ ...cfg, externalVenueCost: e.target.value })} data-testid="cfg-venue-cost" placeholder="e.g. 5000" />
                    <p className="mt-1 text-[11px] text-amber-700">An external venue cost is factored into the dynamic programme economics.</p>
                  </div>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700" data-testid="community-contribution">🤝 Community Space Contribution — no external venue cost</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={label}>Language</label>
                  <select className={input} value={cfg.language} onChange={(e) => setCfg({ ...cfg, language: e.target.value })} data-testid="cfg-language">
                    {(programme?.languages && programme.languages.length ? programme.languages : DEFAULT_LANGUAGES).map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-muted">Used to match you with a suitable NOSTOPS teacher.</p>
                </div>
                {cfg.repeat ? (
                  <div><p className={label}>Registration</p>
                    <p className="mt-2 text-xs text-ink-soft" data-testid="cfg-regclose-recurring">Each session stays open for registration until its own day.</p>
                  </div>
                ) : (
                  <div><label className={label}>Registration Closing Date</label>
                    <input type="date" className={input} value={cfg.regClose} max={cfg.date || undefined} onChange={(e) => setCfg({ ...cfg, regClose: e.target.value })} data-testid="cfg-regclose" />
                    {cfg.regClose && cfg.date && cfg.regClose > cfg.date && <p className="mt-1 text-[11px] font-semibold text-rose-600">Cannot be after the event date.</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="grid content-start gap-4">
              <div className="rounded-2xl border border-line bg-cream p-4">
                <p className={label}>Event Visibility</p>
                <div className="mt-2 grid gap-2">
                  {props.visibilities.map((v) => (
                    <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${cfg.visibility === v ? 'border-brand bg-white' : 'border-line bg-white/50'}`}>
                      <input type="radio" name="vis" checked={cfg.visibility === v} onChange={() => setCfg({ ...cfg, visibility: v })} data-testid={`vis-${v}`} className="mt-0.5" />
                      <span><span className="font-bold text-ink">{VIS_COPY[v]?.label || v}</span><br /><span className="text-xs text-ink-soft">{VIS_COPY[v]?.desc}</span></span>
                    </label>
                  ))}
                </div>
              </div>

              {/* §8 — Registration Access (separate from Visibility). */}
              <div className="rounded-2xl border border-line bg-cream p-4" data-testid="reg-access-block">
                <p className={label}>Who can register?</p>
                <p className="mt-1 text-[11px] text-muted">Separate from visibility — a public event can still restrict who may register.</p>
                <select className={`${input} mt-2`} value={cfg.regAccess} onChange={(e) => setCfg({ ...cfg, regAccess: e.target.value })} data-testid="cfg-regaccess">
                  <option value="OPEN">Open — anyone with the link can register</option>
                  <option value="ORGANISATION_ONLY">Organisation only</option>
                  <option value="INVITE_ONLY">Invite only</option>
                  <option value="CLOSED">Closed — no registrations</option>
                </select>
              </div>

              <ParticipantFee value={feeText} suggested={suggestedFee} repeat={cfg.repeat}
                onChange={(v) => setCfg({ ...cfg, fee: v })} onUseSuggested={() => setCfg({ ...cfg, fee: null })} />

              {/* Programme summary used for planning and teacher matching (Prompt §6/§7) */}
              <div className="rounded-2xl border border-line bg-cream p-4" data-testid="economics-inputs">
                <p className={label}>Programme Economics</p>
                <p className="mt-1 text-[11px] text-muted">Shared with NOSTOPS to plan your programme and match a teacher.</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <EcoRow k="Participant fee" v={fee ? `${feeLabel}${cfg.repeat ? ' / session' : ''}` : '—'} />
                  <EcoRow k="Group size" v={cfg.capacity ? `${cfg.capacity} participants${cfg.repeat ? ' per session' : ''}` : 'Open capacity'} />
                  <EcoRow k="Frequency" v={cfg.repeat ? (cfg.perWeek === 2 ? '2 sessions a week' : '1 session a week') : 'One session'} />
                  {cfg.repeat && plannedDates.length > 0 && <EcoRow k="Sessions" v={String(plannedDates.length)} />}
                  <EcoRow k="Duration" v={`${cfg.duration || '—'} mins`} />
                  <EcoRow k="Location" v={cfg.city || '—'} />
                  <EcoRow k="Venue" v={cfg.venueType === 'EXTERNAL_VENUE' ? `External${cfg.externalVenueCost ? ` · ₹${cfg.externalVenueCost}` : ''}` : 'Community contribution'} />
                  <EcoRow k="Teacher travel" v="Calculated at matching" />
                </dl>
              </div>

              <div className="rounded-2xl border border-line bg-cream p-4">
                <p className={label}>Programme Champion</p>
                <p className="mt-1 text-[11px] text-muted">Internal point of contact — an authorised member you designate (separate from the organisation contact).</p>
                <select className={`${input} bg-white`} value={cfg.championMemberId} onChange={(e) => setCfg({ ...cfg, championMemberId: e.target.value })} data-testid="cfg-champion">
                  <option value="">Designate later</option>
                  {members.map((m) => <option key={m.member_id} value={m.member_id}>{m.name}{m.email ? ` · ${m.email}` : ''}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" className={ghostBtn} onClick={() => setPhase(1)}>← Back</button>
            <button type="button" className={primaryBtn} disabled={busy} onClick={saveConfigure} data-testid="cfg-continue">{busy ? 'Saving…' : 'Save & Continue →'}</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: REVIEW ─────────────────────────────────────── */}
      {phase === 3 && programme && (
        <ReviewStep cfg={cfg} orgName={org.name} logoUrl={org.logoUrl} programme={programme} plannedDates={plannedDates}
          championName={champion?.name} overGroup={overGroup} feeLabel={feeLabel} busy={busy}
          onBack={() => setPhase(2)} onPublish={publish} />
      )}

      {/* ── STEP 5: PUBLISHED ──────────────────────────────────── */}
      {phase === 4 && (() => {
        // OEA-23 — the page is live and registration follows the chosen access
        // rule IMMEDIATELY on publish (there is no later "opening" step).
        const pageLive = !!published?.path && cfg.visibility !== 'PRIVATE';
        const regMsg = cfg.regAccess === 'OPEN'
          ? (cfg.repeat
            ? `Registration is open now for all ${plannedDates.length} sessions — participants register and pay ${feeLabel} for each session separately.`
            : `Registration is open now — share the link so participants can sign up and pay ${feeLabel}${cfg.regClose ? ` until ${cfg.regClose}` : ''}.`)
          : cfg.regAccess === 'CLOSED'
            ? 'Registration is closed, so participants cannot sign up from the page.'
            : 'Sign-up on the page is restricted to invited participants.';
        return (
        <div className={`${card} text-center`}>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-3xl">🎉</div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-ink">Your event is published</h2>
          <p className="mt-2 text-ink-soft" data-testid="publish-message">
            {pageLive
              ? `Your event page is live. ${regMsg}`
              : 'Your private event is published. It has no public page and appears only in your organisation dashboard.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {pageLive && (
              <a href={published!.path!} className={primaryBtn} data-testid="view-event">View event page →</a>
            )}
            <button type="button" className={ghostBtn} onClick={() => router.push('/app/org/events')}>Manage my events</button>
          </div>
          {pageLive && !published!.indexable && (
            <p className="mt-4 text-xs text-muted">
              {cfg.visibility === 'UNLISTED'
                ? 'This event is unlisted — reachable only via its direct link.'
                : 'Your event is discoverable on NOSTOPS. Search-engine indexing begins once your organisation is verified.'}
            </p>
          )}
        </div>
        );
      })()}
    </div>
  );
}
