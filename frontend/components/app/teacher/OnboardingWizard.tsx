'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff, sendBff } from '@/lib/auth-client';
import { useI18n } from '@/components/i18n/I18nProvider';
import SquareImageCropper from '@/components/app/teacher/SquareImageCropper';
import type { Codex, FoundingIntake } from '@/lib/server/teacher';
import { trackVenueGrowth } from '@/lib/venue-growth-client';
import {
  completeServerDraft,
  fromScreens,
  loadServerDraft,
  saveServerDraft,
  toScreens,
  trackOnboarding,
  type DraftFields,
  type SyncErrorType,
  type SyncFail,
} from '@/lib/onboarding-sync';

const STEPS = ['Basics', 'Lineage', 'Specs', 'Bio', 'Review'];
// Device-local draft so a teacher who leaves mid-onboarding resumes at the same
// step with their entered details intact (survives reload / logout+login).
const DRAFT_KEY = 'nostops.teacher.onboarding.draft.v1';
const LANGS = ['English', 'Hindi', 'Sanskrit', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali', 'Gujarati', 'Malayalam', 'Punjabi'];
const DIMENSIONS = [
  { id: 'body', icon: '🧘', name: 'Yoga for the Body', desc: 'Asana, alignment, strength, mobility & sports recovery.' },
  { id: 'mind', icon: '🌿', name: 'Yoga for the Mind', desc: 'Pranayama, meditation, stress relief & sleep protocols.' },
  { id: 'special_needs', icon: '🤝', name: 'Yoga for Special Needs', desc: 'Adapted practice for physical limitations, functional needs or circumstances (e.g. chair-based or gentle practice). NOSTOPS verifies adaptive-practice competence separately.' },
];
const TONES: Array<{ id: 'warm' | 'professional' | 'humble'; label: string }> = [
  { id: 'warm', label: 'Warm' },
  { id: 'professional', label: 'Professional' },
  { id: 'humble', label: 'Humble' },
];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-sm font-semibold transition"
      style={{ borderColor: on ? '#0D9488' : '#E5E7EB', backgroundColor: on ? '#0D948815' : '#fff', color: on ? '#0F766E' : '#475569' }}
    >
      {children}
    </button>
  );
}

const label = 'block text-sm font-bold text-ink';
const input = 'mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

type Prefill = Partial<{
  name: string; city: string; country: string; phone: string; experience: string;
  languages: string[]; styles: string[]; paramparas: string[]; specializations: string[];
  yogaDims: string[]; bio: string; handle: string;
}>;

// Screen 4 handle check: `error` = the check itself failed (never shown as "taken").
type HandleError = 'session_expired' | 'backend_error' | 'timeout';
type HandleStatus = { checking: boolean; available?: boolean; invalid?: boolean; reason?: string | null; error?: HandleError };

// Screen 5 publish steps. `register` holds the handle the backend assigned.
type SubmitStep = 'register' | 'profile' | 'avatar';
type DoneSteps = { register?: string; profile?: boolean; avatar?: boolean };
type StepFailure = { step: SubmitStep; kind: 'preview' | 'session' | 'error'; message: string; errorType: string };
const STEP_LABEL: Record<SubmitStep, string> = {
  register: 'Create your teacher record',
  profile: 'Save your profile details',
  avatar: 'Upload your photo',
};

/** HTTP 423 / preview_read_only is its own state: never success, never a handle conflict. */
function stepFailure(step: SubmitStep, r: { status: number; data: any }, fallback: string): StepFailure {
  if (r.status === 423 || r.data?.preview_read_only === true) return { step, kind: 'preview', message: 'Saving is disabled in preview.', errorType: 'preview_read_only' };
  if (r.status === 401) return { step, kind: 'session', message: 'Your session has expired. Please sign in again.', errorType: 'session_expired' };
  if (r.status === 0) return { step, kind: 'error', message: 'Network error. Please check your connection.', errorType: 'network' };
  return { step, kind: 'error', message: r.data?.error || fallback, errorType: r.status === 504 ? 'timeout' : 'backend_error' };
}


export default function OnboardingWizard({ codex, founding, defaultName, prefill, accountId }: { codex: Codex; founding: FoundingIntake; defaultName: string; prefill?: Prefill; accountId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  // A claimed teacher's existing handle is already theirs — accept it without the
  // "available?" check (which would otherwise report it as taken).
  const ownHandle = (prefill?.handle || '').trim();

  const [name, setName] = useState(prefill?.name || defaultName || '');
  const [city, setCity] = useState(prefill?.city || '');
  const [country, setCountry] = useState(prefill?.country || 'India');
  const [phone, setPhone] = useState(prefill?.phone || '');
  const [languages, setLanguages] = useState<string[]>(prefill?.languages?.length ? prefill.languages : ['English', 'Hindi']);
  const [experience, setExperience] = useState(prefill?.experience || '');
  const [paramparas, setParamparas] = useState<string[]>(prefill?.paramparas || []);
  const [styles, setStyles] = useState<string[]>(prefill?.styles || []);
  const [yogaDims, setYogaDims] = useState<string[]>(prefill?.yogaDims || []);
  const [specializations, setSpecializations] = useState<string[]>(prefill?.specializations || []);
  const [bio, setBio] = useState(prefill?.bio || '');
  const [sampleVideo, setSampleVideo] = useState('');
  const [handle, setHandle] = useState(prefill?.handle || '');
  const [handleTouched, setHandleTouched] = useState(!!prefill?.handle);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>({ checking: false });

  const [aiTone, setAiTone] = useState<'warm' | 'professional' | 'humble'>('warm');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // Screen 5: which required publish steps already succeeded (Retry re-runs only the rest),
  // and why the others failed.
  const [done, setDone] = useState<DoneSteps>({});
  const [failures, setFailures] = useState<StepFailure[]>([]);
  const [doneHandle, setDoneHandle] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showResume, setShowResume] = useState(false);
  const photoInput = useRef<HTMLInputElement | null>(null);
  // Server draft sync: current version (null = no server draft yet), the last photo the server
  // has, the save queue (one PUT at a time, in order) and the latest sync problem to show.
  const draftVersion = useRef<number | null>(null);
  const photoOnServer = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ type: SyncErrorType | 'load_failed'; text: string } | null>(null);

  function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && file.type.startsWith('image/')) setCropFile(file);
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // ── Resume support ──────────────────────────────────────────────────────────
  // The SERVER draft (per account) is the source of truth. The localStorage copy is a mirror
  // for offline/no-loss and carries an `owner` (account id): a local draft is restored or
  // uploaded ONLY when it belongs to this account (and, for upload, no server draft exists).
  // Anything else (another account's draft, or a legacy draft without an owner) is discarded.
  const fields = (): DraftFields => ({ step, name, city, country, phone, languages, experience, paramparas, styles, yogaDims, specializations, bio, sampleVideo, handle, aiTone });

  const applyDraft = useCallback((d: DraftFields) => {
    if (typeof d.step === 'number') setStep(Math.max(0, Math.min(d.step, STEPS.length - 1)));
    if (d.name) setName(d.name);
    if (d.city) setCity(d.city);
    if (d.country) setCountry(d.country);
    if (d.phone) setPhone(d.phone);
    if (Array.isArray(d.languages)) setLanguages(d.languages);
    if (d.experience) setExperience(d.experience);
    if (Array.isArray(d.paramparas)) setParamparas(d.paramparas);
    if (Array.isArray(d.styles)) setStyles(d.styles);
    if (Array.isArray(d.yogaDims)) setYogaDims(d.yogaDims);
    if (Array.isArray(d.specializations)) setSpecializations(d.specializations);
    if (d.bio) setBio(d.bio);
    if (d.sampleVideo) setSampleVideo(d.sampleVideo);
    if (d.handle) { setHandle(d.handle); setHandleTouched(true); }
    if (d.aiTone === 'warm' || d.aiTone === 'professional' || d.aiTone === 'humble') setAiTone(d.aiTone);
  }, []);

  const noticeFor = useCallback((t: SyncErrorType): { type: SyncErrorType; text: string } => {
    if (t === 'session_expired') return { type: t, text: 'Your session has expired, so your progress could not be saved to your account. It is kept on this device. Sign in again to keep saving.' };
    if (t === 'preview_read_only') return { type: t, text: 'Saving is disabled in preview. Your progress is kept on this device.' };
    return { type: t, text: 'We couldn’t save your progress to your account just now. It is kept on this device, and we’ll try again when you finish the next screen.' };
  }, []);

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let local: (DraftFields & { owner?: string }) | null = null;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      local = raw ? JSON.parse(raw) : null;
    } catch {
      local = null; // corrupt or blocked storage
    }
    const mine = local && local.owner && local.owner === accountId ? local : null;
    if (local && !mine) {
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* non-fatal */ }
    }
    const hasContent = (d: DraftFields) => (typeof d.step === 'number' && d.step > 0) || !!d.name || !!d.bio;
    void (async () => {
      const res = await loadServerDraft();
      if (res.ok && res.exists && res.draft && !res.draft.completed) {
        const d = res.draft;
        draftVersion.current = d.version;
        const restored = { ...fromScreens(d.screens), step: d.last_completed_screen };
        applyDraft(restored);
        if (d.draft_photo) { setPhotoDataUrl(d.draft_photo); photoOnServer.current = d.draft_photo; }
        if (hasContent(restored)) {
          setShowResume(true);
          trackOnboarding('onboarding_resumed', `v${d.version}`, { screen: Math.min(d.last_completed_screen + 1, 5) });
        }
      } else if (res.ok) {
        draftVersion.current = res.exists && res.draft ? res.draft.version : null;
        if (mine && !res.exists) {
          // Migrate this account's own local draft to the server (first write → version 1).
          applyDraft(mine);
          if (hasContent(mine)) setShowResume(true);
          const up = await saveServerDraft({ screens: toScreens(mine), last_completed_screen: Math.max(0, Math.min(Number(mine.step) || 0, 4)), expected_version: null });
          if (up.ok) draftVersion.current = up.version;
          else setSyncNotice(noticeFor((up as SyncFail).error_type));
        } else if (mine) {
          try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* non-fatal */ }
        }
      } else {
        // Server unreachable / session expired: keep working from this account's own device copy.
        if (mine) { applyDraft(mine); if (hasContent(mine)) setShowResume(true); }
        setSyncNotice((res as SyncFail).error_type === 'session_expired'
          ? noticeFor('session_expired')
          : { type: 'load_failed', text: 'We couldn’t load your saved progress from your account. You can keep going; your progress is kept on this device.' });
      }
      setReady(true);
    })();
  }, [accountId, applyDraft, noticeFor]);
  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ owner: accountId, step, name, city, country, phone, languages, experience, paramparas, styles, yogaDims, specializations, bio, sampleVideo, handle, aiTone }),
      );
    } catch {
      /* storage blocked/full — non-fatal */
    }
  }, [ready, accountId, step, name, city, country, phone, languages, experience, paramparas, styles, yogaDims, specializations, bio, sampleVideo, handle, aiTone]);

  /** Save the draft to the server when a screen is completed (queued, in order). A stale
   *  version (409) reloads the server copy and tells the teacher; other failures keep the
   *  device copy and show a notice. Never blocks the wizard. */
  function saveScreen(completed: number, snapshot: DraftFields, photo: string | null) {
    saveQueue.current = saveQueue.current.then(async () => {
      const sendPhoto = photo && photo !== photoOnServer.current ? photo : undefined;
      const r = await saveServerDraft({ screens: toScreens(snapshot), last_completed_screen: completed, expected_version: draftVersion.current, draft_photo: sendPhoto });
      if (r.ok) {
        draftVersion.current = r.version;
        if (sendPhoto) photoOnServer.current = sendPhoto;
        setSyncNotice(null);
        return;
      }
      if ((r as SyncFail).error_type === 'stale') {
        const g = await loadServerDraft();
        if (g.ok && g.draft) {
          draftVersion.current = g.draft.version;
          applyDraft({ ...fromScreens(g.draft.screens), step: Math.min(g.draft.last_completed_screen, STEPS.length - 1) });
          if (g.draft.draft_photo) { setPhotoDataUrl(g.draft.draft_photo); photoOnServer.current = g.draft.draft_photo; }
        }
        setSyncNotice({ type: 'stale', text: 'Your draft was updated in another tab or device, so we loaded the latest saved version. Please check it and continue.' });
        return;
      }
      setSyncNotice(noticeFor((r as SyncFail).error_type));
    });
    return saveQueue.current;
  }

  // Auto-suggest a handle once the teacher reaches the Bio step.
  useEffect(() => {
    if (step === 3 && !handleTouched && !handle && name && city) setHandle(slugify(`${name}-${city}`));
  }, [step, handleTouched, handle, name, city]);

  // Debounced live handle availability check. Only a real "available: false" from the backend
  // is a conflict; session / backend / timeout failures are shown as their own states (with
  // Retry) and never block Continue. Stale responses are ignored (checkSeq).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkSeq = useRef(0);
  const checkHandle = useCallback(async (h: string) => {
    const seq = ++checkSeq.current;
    setHandleStatus({ checking: true });
    let next: HandleStatus;
    try {
      const res = await fetch(`/bff/teacher/handle-check?handle=${encodeURIComponent(h)}`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await res.json().catch(() => null);
      if (d?.error === true) {
        next = { checking: false, error: d.error_type === 'session_expired' || d.error_type === 'timeout' ? d.error_type : 'backend_error' };
      } else if (res.ok && typeof d?.available === 'boolean') {
        next = { checking: false, available: d.available, invalid: !!d.invalid, reason: d.reason || null };
      } else {
        next = { checking: false, error: res.status === 401 ? 'session_expired' : res.status === 504 ? 'timeout' : 'backend_error' };
      }
    } catch {
      next = { checking: false, error: 'backend_error' };
    }
    if (seq === checkSeq.current) setHandleStatus(next);
  }, []);
  useEffect(() => {
    if (!handle || handle.length < 3) { checkSeq.current++; setHandleStatus({ checking: false }); return; }
    setHandleStatus({ checking: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void checkHandle(handle); }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [handle, checkHandle]);

  const specName = useCallback((id: string) => codex.specializations.find((s) => s.id === id)?.name || id, [codex]);
  const paramparaName = useCallback((id: string) => codex.paramparas.find((p) => p.id === id)?.name || id, [codex]);

  async function draftBio() {
    if (paramparas.length === 0) { setAiErr(t('Pick a lineage in Step 2 first — the AI uses it to write your bio.')); return; }
    setAiBusy(true);
    setAiErr(null);
    const r = await postBff('/bff/teacher/ai-bio', {
      name: name.trim(),
      city: city.trim(),
      experience_years: parseInt(experience, 10) || 0,
      parampara_name: paramparaName(paramparas[0]),
      styles,
      specializations: specializations.map(specName),
      languages,
      tone: aiTone,
    });
    setAiBusy(false);
    if (r.ok && (r.data?.bio || '').length > 20) setBio(r.data.bio);
    else setAiErr(r.data?.error || 'Could not draft a bio. Please write your own.');
  }

  // Polish an EXISTING draft (the "improve" behaviour) via the shared AI endpoint.
  async function improveBioWizard() {
    if (bio.trim().length < 20) { setAiErr(t('Write a few words first, then Improve polishes them.')); return; }
    setAiBusy(true);
    setAiErr(null);
    const hints = [
      paramparas.length ? `Lineage: ${paramparaName(paramparas[0])}` : '',
      styles.length ? `Styles: ${styles.join(', ')}` : '',
      specializations.length ? `Specialisations: ${specializations.map(specName).join(', ')}` : '',
      city && `City: ${city}`,
      experience && `Years teaching: ${experience}`,
    ].filter(Boolean).join('. ');
    const r = await sendBff('/bff/teacher/improve-bio', 'POST', { bio: bio.trim(), hints });
    setAiBusy(false);
    if (r.ok && (r.data?.bio || '').length > 20) setBio(r.data.bio);
    else setAiErr(r.data?.error || 'Could not improve your bio right now.');
  }

  const canNext = (() => {
    if (step === 0) return !!name.trim() && !!city.trim();
    if (step === 1) return paramparas.length >= 1;
    if (step === 2) return yogaDims.length >= 1 && specializations.length >= 1;
    if (step === 3) return bio.trim().length >= 30 && handle.length >= 3 && (handleStatus.available === true || handle === ownHandle || !!handleStatus.error);
    return true;
  })();

  // Screen 5 publish. Required steps: native-register, profile PATCH, avatar POST (only with a
  // photo). The draft is removed and success shown ONLY when every required step succeeded; any
  // failure keeps the draft and lists the failed step, and Retry re-runs only unfinished steps.
  async function submit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFailures([]);
    const d: DoneSteps = { ...done };
    const failed: StepFailure[] = [];
    try {
      if (!d.register) {
        const r = await postBff('/bff/teacher/native-register', {
          name: name.trim(),
          city: city.trim(),
          country: country.trim(),
          phone: phone.trim(),
          languages_spoken: languages,
          experience_years: parseInt(experience, 10) || 0,
          parampara: paramparas[0],
          paramparas,
          styles,
          specializations,
          yoga_dimensions: yogaDims,
          bio: bio.trim(),
          sample_video_url: sampleVideo.trim() || undefined,
          preferred_handle: handle.trim() || undefined,
        });
        if (r.ok && r.data?.ok !== false) {
          d.register = r.data?.handle || handle.trim();
          trackOnboarding('teacher_registration_completed', 'native-register', { screen: 5 });
        } else failed.push(stepFailure('register', r, 'Could not create your teacher profile.'));
      }
      if (d.register) {
        // The remote native-register creates the teacher record but does not always
        // persist the content fields into the doc that /teachers/me/native-profile
        // reads back — leaving the profile-first guard thinking the profile is empty.
        // Re-save the same fields through the READABLE PATCH endpoint (this write is
        // reliably read back) so the guard sees a complete profile.
        if (!d.profile) {
          const p = await sendBff('/bff/teacher/profile', 'PATCH', {
            name: name.trim(),
            bio: bio.trim(),
            city: city.trim(),
            phone: phone.trim(),
            parampara: paramparas[0],
            paramparas,
            styles,
            specializations,
            languages_spoken: languages,
            yoga_dimensions: yogaDims,
            experience_years: parseInt(experience, 10) || 0,
          });
          if (p.ok && p.data?.ok !== false) d.profile = true;
          else failed.push(stepFailure('profile', p, 'Could not save your profile details.'));
        }
        // Upload the photo captured in the wizard (record now exists post-register).
        if (photoDataUrl && !d.avatar) {
          const a = await sendBff('/bff/teacher/avatar', 'POST', { base64: photoDataUrl });
          if (a.ok && a.data?.ok !== false) d.avatar = true;
          else failed.push(stepFailure('avatar', a, 'Could not upload your photo.'));
        }
      }
      setDone(d);
      if (failed.length > 0) {
        setFailures(failed);
        // One failure event per failed step and error type; a Retry that fails the same way
        // re-sends the same event_id (de-duplicated by the backend).
        for (const f of failed) trackOnboarding('profile_creation_failed', `${f.step}:${f.errorType}`, { screen: 5, step: f.step, error_type: f.errorType });
        return;
      }
      // Every required step succeeded: record Screen 5 as completed on the server draft, then
      // mark the draft completed (both best effort; publishing already succeeded).
      await saveScreen(5, fields(), photoDataUrl);
      await completeServerDraft();
      trackOnboarding('profile_creation_succeeded', 'published', { screen: 5 });
      try { if (typeof window !== 'undefined') window.localStorage.removeItem(DRAFT_KEY); } catch { /* non-fatal */ }
      await trackVenueGrowth('profile_complete'); // only if they came from a venue's NOSTOPS invitation
      await sendBff('/bff/discovery/my-claim/complete', 'POST', {}).catch(() => {}); // stops "finish your profile" reminders
      setDoneHandle(d.register || handle.trim());
      router.refresh();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (doneHandle) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: '#0D948840', backgroundColor: '#0D948808' }}>
          <span className="inline-grid h-16 w-16 place-items-center rounded-full text-3xl text-white" style={{ backgroundColor: '#0D9488' }}>🎉</span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-ink">Your public profile is live</h1>
          <p className="mt-2 text-ink-soft">Welcome to NOSTOPS, {name.split(' ')[0]}. Your teacher profile is published.</p>
          {founding?.nextSeat ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: '#F59E0B18', color: '#B45309' }}>
              🏅 You’re founding teacher #{founding.nextSeat} of {founding.cap}
            </p>
          ) : null}
          <Link href={`/teachers/${doneHandle}`} target="_blank" className="mt-4 block truncate text-sm font-bold text-brand-700 hover:underline">
            View my profile → /teachers/{doneHandle}
          </Link>
        </div>
        <div className="mt-4 space-y-2.5">
          <Link href="/app" className="block rounded-xl bg-brand px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600">
            Go to my Teacher Dashboard →
          </Link>
          <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-left">
            <p className="text-xs font-black uppercase tracking-wider text-accent-700">Next step</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Complete <span className="font-bold text-ink">InstaKYC</span> to verify your identity and progress toward empanelment and your earnings wallet. Your profile stays free to edit anytime.
            </p>
            <Link href="/app/teacher/kyc" className="mt-2 inline-block text-sm font-bold text-accent-700 hover:underline">
              Start InstaKYC →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div>
      {cropFile && (
        <SquareImageCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={(dataUrl) => { setPhotoDataUrl(dataUrl); setCropFile(null); }}
        />
      )}
      {showResume && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-50/60 px-4 py-3" data-testid="resume-banner">
          <p className="text-sm font-semibold text-brand-800">👋 Welcome back — we saved your progress. Continue where you left off.</p>
          <button type="button" onClick={() => setShowResume(false)} className="shrink-0 text-sm font-bold text-brand-700 hover:underline">Dismiss</button>
        </div>
      )}
      {syncNotice && (
        <div role="status" data-testid="draft-sync-notice" className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {syncNotice.text}
            {syncNotice.type === 'session_expired' && (
              <> <Link href="/login?next=/app/teacher/onboarding" data-testid="draft-sync-signin" className="underline">Sign in again</Link></>
            )}
          </p>
          <button type="button" onClick={() => setSyncNotice(null)} className="shrink-0 text-sm font-bold text-amber-900 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Progress — always tells the teacher how close they are to finishing */}
      <div className="mb-2 flex items-center justify-between" data-testid="onboarding-progress">
        <p className="text-xs font-bold text-ink-soft">{t('Step')} {step + 1} {t('of')} {STEPS.length}</p>
        <p className="text-xs font-black text-brand-700">{Math.round(((step + 1) / STEPS.length) * 100)}% {t('complete')}</p>
      </div>
      {/* Stepper */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col items-center gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: i <= step ? '100%' : '0%' }} />
            </div>
            <span className={`text-[10px] font-bold ${i === step ? 'text-brand-700' : 'text-muted'}`}>{s}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white p-5 sm:p-6">
        {/* Step 0 — Basics */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-ink">The basics</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={label}>Full name *</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className={label}>City *</label><input className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" /></div>
              <div><label className={label}>Country</label><input className={input} value={country} onChange={(e) => setCountry(e.target.value)} /></div>
              <div><label className={label}>Years of experience</label><input className={input} value={experience} onChange={(e) => setExperience(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="5" /></div>
            </div>
            <div><label className={label}>Phone</label><input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+9198…" /></div>
            <div>
              <label className={label}>Languages you teach in</label>
              <div className="mt-2 flex flex-wrap gap-2">{LANGS.map((l) => <Chip key={l} on={languages.includes(l)} onClick={() => toggle(languages, setLanguages, l)}>{l}</Chip>)}</div>
            </div>
            <div>
              <label className={label}>Profile photo <span className="font-normal text-muted">· optional</span></label>
              <div className="mt-2 flex items-center gap-4">
                {photoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoDataUrl} alt="Your profile photo" className="h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-xl font-black text-brand-700">{(name || 'T').charAt(0).toUpperCase()}</span>
                )}
                <button type="button" onClick={() => photoInput.current?.click()} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700">
                  {photoDataUrl ? 'Change photo' : 'Add a photo'}
                </button>
                {photoDataUrl && (
                  <button type="button" onClick={() => setPhotoDataUrl(null)} className="text-sm font-bold text-red-600 hover:underline">Remove</button>
                )}
              </div>
              <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
              <p className="mt-1 text-xs text-muted">A friendly headshot helps seekers recognise you. You can change it anytime.</p>
            </div>
          </div>
        )}

        {/* Step 1 — Lineage */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-ink">Your lineage &amp; styles</h2>
            <div>
              <label className={label}>Parampara (lineage) * <span className="font-normal text-muted">· pick all you belong to (up to 8)</span></label>
              {paramparas.length >= 8 && (
                <p className="mt-1 text-xs font-semibold text-amber-700">You can select up to 8 lineages. Remove one to add another.</p>
              )}
              <div className="mt-2 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {codex.paramparas.map((p) => {
                  const on = paramparas.includes(p.id);
                  const atCap = !on && paramparas.length >= 8;
                  return (
                    <button key={p.id} type="button" disabled={atCap} onClick={() => toggle(paramparas, setParamparas, p.id)} className="rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: on ? '#0D9488' : '#E5E7EB', backgroundColor: on ? '#0D948810' : '#fff' }}>
                      <p className="text-sm font-extrabold text-ink">{p.name}{on ? ' ✓' : ''}</p>
                      {(p.founder || p.words) && <p className="mt-0.5 text-[11px] text-muted">{p.founder ? `${p.founder}` : ''}{p.founder && p.words ? ' · ' : ''}{p.words || ''}</p>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={label}>Styles you teach</label>
              <div className="mt-2 flex flex-wrap gap-2">{codex.styles.map((s) => <Chip key={s} on={styles.includes(s)} onClick={() => toggle(styles, setStyles, s)}>{s}</Chip>)}</div>
            </div>
          </div>
        )}

        {/* Step 2 — Specs */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-black text-ink">Yoga dimensions *</h2>
              <p className="text-xs text-muted">Seekers use these in SmartMatch — pick any that apply.</p>
              <div className="mt-3 space-y-2">
                {DIMENSIONS.map((d) => {
                  const on = yogaDims.includes(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => toggle(yogaDims, setYogaDims, d.id)} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition" style={{ borderColor: on ? '#0D9488' : '#E5E7EB', backgroundColor: on ? '#0D948810' : '#fff' }}>
                      <span className="text-xl">{d.icon}</span>
                      <div className="flex-1"><p className="text-sm font-extrabold text-ink">{d.name}{on ? ' ✓' : ''}</p><p className="text-[11px] text-muted">{d.desc}</p></div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={label}>Specialisations *</label>
              <div className="mt-2 flex flex-wrap gap-2">{codex.specializations.map((sp) => <Chip key={sp.id} on={specializations.includes(sp.id)} onClick={() => toggle(specializations, setSpecializations, sp.id)}>{sp.name}</Chip>)}</div>
            </div>
          </div>
        )}

        {/* Step 3 — Bio + handle */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-ink">Your story</h2>
            <div className="rounded-xl border border-brand/25 bg-brand-50/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">✨ AI bio helper</span>
                <div className="flex gap-1">{TONES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setAiTone(t.id)} className="rounded-full px-2.5 py-1 text-xs font-bold transition" style={{ backgroundColor: aiTone === t.id ? '#0D9488' : '#fff', color: aiTone === t.id ? '#fff' : '#475569', border: '1px solid #E5E7EB' }}>{t.label}</button>
                ))}</div>
                <div className="ml-auto flex gap-1.5">
                  <button type="button" onClick={improveBioWizard} disabled={aiBusy || bio.trim().length < 20} data-testid="wizard-improve-bio" className="rounded-lg border border-brand/40 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50">{aiBusy ? '…' : '✨ Improve'}</button>
                  <button type="button" onClick={draftBio} disabled={aiBusy} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">{aiBusy ? 'Drafting…' : bio ? 'Redraft' : 'Draft with AI'}</button>
                </div>
              </div>
              {aiErr && <p className="mt-2 text-xs font-semibold text-red-600">{aiErr}</p>}
            </div>
            <div>
              <label className={label}>Bio * <span className="font-normal text-muted">· min 30 characters</span></label>
              <textarea className={`${input} min-h-[120px] resize-y`} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} placeholder="Trained at Bihar School of Yoga 2015–17. Specialised in corporate stress reduction with 500+ classes taught…" />
              <p className="mt-1 text-right text-xs text-muted">{bio.trim().length} chars</p>
            </div>
            <div><label className={label}>Sample video URL <span className="font-normal text-muted">· optional</span></label><input className={input} value={sampleVideo} onChange={(e) => setSampleVideo(e.target.value)} placeholder="https://youtu.be/…" /></div>
            <div>
              <label className={label}>Public profile handle *</label>
              <div className="mt-1 flex items-center rounded-xl border border-line bg-white px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <span className="text-sm text-muted">/teachers/</span>
                <input className="flex-1 bg-transparent py-2.5 text-sm text-ink outline-none" value={handle} onChange={(e) => { setHandleTouched(true); setHandle(slugify(e.target.value)); }} placeholder="your-name-city" />
              </div>
              <p className="mt-1 text-xs font-semibold" data-testid="handle-status" style={{ color: handleStatus.checking ? '#94A3B8' : (handleStatus.available || handle === ownHandle) ? '#0D9488' : handleStatus.error ? '#B45309' : handle.length >= 3 ? '#EF4444' : '#94A3B8' }}>
                {handleStatus.checking ? 'Checking…'
                  : (handle === ownHandle && ownHandle) ? 'Your current handle ✓'
                  : handle.length < 3 ? 'Use 3+ letters, numbers or hyphens.'
                  : handleStatus.error === 'session_expired' ? (
                    <>Your session has expired. <Link href="/login?next=/app/teacher/onboarding" data-testid="handle-signin" className="underline">Sign in again</Link>. Your answers are saved on this device.</>
                  )
                  : handleStatus.error ? (
                    <>
                      {handleStatus.error === 'timeout' ? 'The handle check took too long.' : 'We couldn’t check this handle right now.'}{' '}
                      <button type="button" onClick={() => void checkHandle(handle)} data-testid="handle-retry" className="underline">Retry</button>
                      <span className="font-normal"> You can still continue; we confirm the handle when you publish.</span>
                    </>
                  )
                  : handleStatus.available ? 'Available ✓'
                  : handleStatus.invalid ? (handleStatus.reason || 'Use 3+ letters, numbers or hyphens.')
                  : 'This handle is unavailable. Try another.'}
              </p>
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="space-y-3">
            <h2 className="text-lg font-black text-ink">Review &amp; publish</h2>
            <dl className="divide-y divide-line rounded-xl border border-line">
              {[
                ['Name', name],
                ['City', `${city}, ${country}`],
                ['Experience', experience ? `${experience} years` : '—'],
                ['Languages', languages.join(', ') || '—'],
                ['Lineage', paramparas.map(paramparaName).join(', ')],
                ['Styles', styles.join(', ') || '—'],
                ['Dimensions', yogaDims.map((d) => DIMENSIONS.find((x) => x.id === d)?.name).join(', ')],
                ['Specialisations', specializations.map(specName).join(', ')],
                ['Handle', `/teachers/${handle}`],
              ].map(([k, v]) => (
                <div key={k as string} className="flex gap-3 px-4 py-2.5 text-sm">
                  <dt className="w-28 shrink-0 font-bold text-muted">{k}</dt>
                  <dd className="flex-1 text-ink">{v || '—'}</dd>
                </div>
              ))}
            </dl>
            <p className="rounded-xl bg-cream/70 px-4 py-2.5 text-xs text-ink-soft">{bio}</p>
            {failures.length > 0 && (
              <div role="alert" data-testid="publish-failures" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-bold text-red-700">
                  {failures.some((f) => f.kind === 'preview') ? 'Saving is disabled in preview' : 'Your profile isn’t published yet'}
                </p>
                <ul className="mt-2 space-y-1">
                  {(['register', 'profile', 'avatar'] as SubmitStep[])
                    .filter((s) => s !== 'avatar' || !!photoDataUrl)
                    .map((s) => {
                      const f = failures.find((x) => x.step === s);
                      const ok = !!done[s];
                      return (
                        <li key={s} data-testid={`publish-step-${s}`} className={`text-xs ${f ? 'font-semibold text-red-700' : ok ? 'text-teal-700' : 'text-muted'}`}>
                          {ok ? '✓' : f ? '✗' : '•'} {STEP_LABEL[s]}{f ? `: ${f.message}` : ok ? '' : ': waiting for the step before it'}
                        </li>
                      );
                    })}
                </ul>
                {failures.some((f) => f.kind === 'session') && (
                  <Link href="/login?next=/app/teacher/onboarding" className="mt-2 inline-block text-xs font-bold text-brand-700 underline">Sign in again →</Link>
                )}
                <p className="mt-2 text-xs text-ink-soft">Your answers are saved on this device. Retry runs only the steps that didn’t finish.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="mt-4 flex gap-3">
        {step > 0 && (
          <button type="button" disabled={submitting} onClick={() => { setStep(step - 1); setDone({}); setFailures([]); }} className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50">← Back</button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => { if (!canNext) return; saveScreen(step + 1, { ...fields(), step: step + 1 }, photoDataUrl); setStep(step + 1); }} disabled={!canNext || !ready} data-testid="onboarding-continue" className="flex-1 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40">Continue →</button>
        ) : (
          <button type="button" onClick={submit} disabled={submitting} data-testid="publish-submit" className="flex-1 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50">{submitting ? 'Publishing…' : failures.length > 0 ? '↻ Retry' : '🚀 Publish my profile'}</button>
        )}
      </div>
    </div>
  );
}
