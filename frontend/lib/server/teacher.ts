// Server-only data access for the authenticated Yoga Teacher. All reads go
// through the BFF (bearer attached from the httpOnly cookie). These are the
// teacher's OWN records; we still project to a typed, minimal shape and keep
// payout/bank numbers masked as the backend returns them.
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { backendFetch } from '@/lib/server/session';
import { getTeacherLevel, levelMeta, type TeacherLevel } from '@/lib/teacher-levels';
import { deriveTeacherStatus } from '@/lib/teacher-status';
import { hasRealCity } from '@/lib/public-teacher';
import { isIndiaCountry } from '@/lib/country';

export type TeacherSelf = {
  teacherId?: string;
  handle: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  timeZone?: string;
  experienceYears?: number;
  bio?: string;
  avatarUrl?: string | null;
  styles: string[];
  specializations: string[];
  languages: string[];
  parampara?: string;
  paramparas: string[];
  rootGuruName?: string;
  rootGuruLocation?: string;
  lineageDeclaration?: string;
  yogaDimensions: string[];
  isEmpanelled: boolean;
  isVerified: boolean;
  verificationStatusRaw?: string;
  badgePrimary?: string;
  empanelmentPath?: string;
  empanelledVia?: string;
  kycVerified: boolean;
  kycPaid: boolean;
  panVerified: boolean;
  bankVerified: boolean;
  kycMethod?: string;
  premium: { enabled: boolean; rateInr?: number; durationMin?: number };
  offers: { online: boolean; privateSession: boolean; group: boolean; corporate: boolean };
  publicVisible: boolean;
  isAvailable: boolean;
  payoutAccountMasked?: string;
  payoutIfsc?: string;
  rating?: number;
  reviewsCount?: number;
  tier?: string;
};

export type ProfileChecklistItem = { key: string; label: string; done: boolean; href: string };
export type ProfileCompleteness = {
  percent: number;
  done: number;
  total: number;
  items: ProfileChecklistItem[];
  complete: boolean;
};

/** Section-by-section profile completeness for the teacher onboarding nudge.
 *  Equal-weighted across the sections a teacher should fill so they appear well
 *  in the directory. Photo links to the media page; everything else to edit. */
export function computeProfileCompleteness(self: TeacherSelf): ProfileCompleteness {
  const has = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;
  const edit = '/app/teacher/profile/edit';
  const items: ProfileChecklistItem[] = [
    { key: 'photo', label: 'Add a profile photo', done: has(self.avatarUrl), href: '/app/teacher/profile/media' },
    { key: 'bio', label: 'Write your bio', done: has(self.bio), href: edit },
    { key: 'city', label: 'Add your city', done: hasRealCity(self.city, self.country), href: `${edit}#city` },
    { key: 'phone', label: 'Add your phone number', done: has(self.phone), href: edit },
    { key: 'experience', label: 'Add years of experience', done: (self.experienceYears ?? 0) > 0, href: edit },
    { key: 'styles', label: 'Select your yoga styles', done: self.styles.length > 0, href: edit },
    { key: 'specializations', label: 'Add specializations', done: self.specializations.length > 0, href: edit },
    { key: 'languages', label: 'Add languages you teach in', done: self.languages.length > 0, href: edit },
    { key: 'parampara', label: 'Share your parampara (lineage)', done: has(self.parampara), href: edit },
  ];
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  return { percent: Math.round((done / total) * 100), done, total, items, complete: done === total };
}

/** The five-screen onboarding wizard's REQUIRED fields. This is the reliable
 *  "the teacher finished onboarding" signal: native-register always populates
 *  these, so it stays true even if the remote `profile_complete` flag lags or
 *  additionally expects a photo. Never involves KYC / payment / empanelment. */
export function hasCoreProfile(self: TeacherSelf | null): boolean {
  if (!self) return false;
  const has = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;
  return (
    has(self.name) &&
    has(self.city) &&
    has(self.parampara) &&
    self.specializations.length > 0 &&
    (self.yogaDimensions.length > 0 || self.styles.length > 0) &&
    has(self.bio)
  );
}


export type TeacherStats = {
  activeBatches: number;
  totalBatches: number;
  totalSessions: number;
  totalEarnings: number;
  activeCompanies: number;
  monthlyProjection: number;
  avgRating: number;
  totalReviews: number;
};

export type EarningsModel = {
  sessionRate: number;
  platformFeePct: number;
  takeHomePerSession: number;
  monthlyCapSessions: number;
  maxMonthlyIncome: number;
};

export type TeacherSession = {
  id: string;
  title: string;
  whenTs: number | null;
  type?: string;
  status?: string;
  participants?: number;
  amount?: number;
  counterparty?: string;
};

export type TeacherDashboard = {
  self: TeacherSelf | null;
  stats: TeacherStats;
  earningsModel: EarningsModel | null;
  upcoming: TeacherSession[];
  reviews: Array<{ author: string; rating?: number; text?: string }>;
};

const num = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

// A teacher is "verified" once InstaKYC identity is done, the KYC payment is
// made, and they are empanelled. Gates the earning/operating features — see
// BUSINESS_LOGIC.md §5.4.
export function isTeacherVerified(self: TeacherSelf | null): boolean {
  return !!self && deriveTeacherStatus(self).canOperate;
}

export function projectTeacher(t: any): TeacherSelf | null {
  if (!t || !t.handle) return null;
  const ps = t.premium_session || {};
  // A profile is publicly reachable only when visible AND not under suspension
  // (an indefinite or still-active suspension makes the public route 404).
  const suspended = !!t.suspended_at && (!t.suspended_until || Date.parse(t.suspended_until) > Date.now());
  return {
    teacherId: t.teacher_id ? String(t.teacher_id) : undefined,
    handle: String(t.handle),
    name: t.name || 'Teacher',
    email: t.email || undefined,
    phone: t.phone || t.mobile || undefined,
    city: t.city || undefined,
    country: t.country || undefined,
    timeZone: t.time_zone || undefined,
    experienceYears:
      typeof t.experience_years === 'number'
        ? t.experience_years
        : t.experience_years
          ? Number(t.experience_years) || undefined
          : undefined,
    bio: typeof t.bio === 'string' && t.bio.trim() ? t.bio.trim() : undefined,
    avatarUrl: t.avatar_url || (t.avatar_base64 ? `data:image/jpeg;base64,${t.avatar_base64}` : null),
    styles: Array.isArray(t.styles) ? t.styles.filter(Boolean) : [],
    specializations: Array.isArray(t.specializations) ? t.specializations.filter(Boolean) : [],
    languages: Array.isArray(t.languages_spoken) ? t.languages_spoken.filter(Boolean) : [],
    parampara: t.parampara || undefined,
    paramparas:
      Array.isArray(t.paramparas) && t.paramparas.filter(Boolean).length
        ? t.paramparas.filter(Boolean)
        : t.parampara
          ? [t.parampara]
          : [],
    rootGuruName: t.root_guru_name || undefined,
    rootGuruLocation: t.root_guru_location || undefined,
    lineageDeclaration:
      typeof t.lineage_declaration === 'string' && t.lineage_declaration.trim()
        ? t.lineage_declaration.trim()
        : undefined,
    yogaDimensions: Array.isArray(t.yoga_dimensions) ? t.yoga_dimensions.filter(Boolean) : [],
    isEmpanelled: !!t.is_empanelled,
    isVerified: !!t.is_verified,
    verificationStatusRaw: typeof t.verification_status === 'string' ? t.verification_status : undefined,
    badgePrimary:
      (Array.isArray(t.badges) && t.badges.length ? t.badges[0] : t.badge_primary) || undefined,
    empanelmentPath: t.empanelment_path || undefined,
    empanelledVia: t.empanelled_via || undefined,
    kycVerified: !!t.kyc_verified,
    kycPaid: !!t.kyc_paid,
    panVerified: !!t.pan_verified,
    bankVerified: !!t.bank_verified,
    kycMethod: t.kyc_method || undefined,
    premium: {
      enabled: !!ps.enabled,
      rateInr: typeof ps.rate_inr === 'number' ? ps.rate_inr : undefined,
      durationMin: ps.duration_minutes || ps.duration_min || undefined,
    },
    offers: {
      online: !!t.offers_online,
      privateSession: !!t.offers_private_sessions,
      group: !!t.offers_group_classes,
      corporate: !!t.offers_corporate,
    },
    publicVisible: t.public_profile_visible !== false && !suspended,
    isAvailable: t.is_available !== false,
    payoutAccountMasked: t.payout_account_masked || undefined,
    payoutIfsc: t.payout_ifsc || undefined,
    rating: typeof t.rating === 'number' && t.rating > 0 ? t.rating : undefined,
    reviewsCount: typeof t.reviews_count === 'number' ? t.reviews_count : undefined,
    tier: t.tier || undefined,
  };
}

function projectSession(s: any): TeacherSession {
  const when = s.preferred_slot || s.session_at || s.scheduled_at || s.start_time || s.date;
  const ts = when ? Date.parse(when) : NaN;
  return {
    id: String(s.session_id || s.booking_id || s.id || Math.random().toString(36).slice(2)),
    title: s.title || s.session_type || s.type || '1:1 session',
    whenTs: Number.isNaN(ts) ? null : ts,
    type: s.session_type || s.type || undefined,
    status: s.status || undefined,
    participants: typeof s.participants === 'number' ? s.participants : s.seats || undefined,
    amount: typeof s.amount === 'number' ? s.amount : typeof s.amount_inr === 'number' ? s.amount_inr : undefined,
    counterparty: s.student_name || s.company_name || s.organisation_name || undefined,
  };
}

export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  const fallback: TeacherDashboard = {
    self: null,
    stats: {
      activeBatches: 0,
      totalBatches: 0,
      totalSessions: 0,
      totalEarnings: 0,
      activeCompanies: 0,
      monthlyProjection: 0,
      avgRating: 0,
      totalReviews: 0,
    },
    earningsModel: null,
    upcoming: [],
    reviews: [],
  };
  try {
    const r = await backendFetch('/teachers/dashboard');
    if (!r.ok) return fallback;
    const d = await r.json();
    const st = d.stats || {};
    const em = d.earnings_model || {};
    return {
      self: projectTeacher(d.teacher),
      stats: {
        activeBatches: num(st.active_batches),
        totalBatches: num(st.total_batches),
        totalSessions: num(st.total_sessions),
        totalEarnings: num(st.total_earnings),
        activeCompanies: num(st.active_companies),
        monthlyProjection: num(st.monthly_projection),
        avgRating: num(st.avg_rating),
        totalReviews: num(st.total_reviews),
      },
      earningsModel: em.session_rate
        ? {
            sessionRate: num(em.session_rate),
            platformFeePct: num(em.platform_fee_pct),
            takeHomePerSession: num(em.take_home_per_session),
            monthlyCapSessions: num(em.monthly_cap_sessions),
            maxMonthlyIncome: num(em.max_monthly_income),
          }
        : null,
      upcoming: (Array.isArray(d.upcoming_sessions) ? d.upcoming_sessions : []).map(projectSession),
      reviews: (Array.isArray(d.recent_reviews) ? d.recent_reviews : []).slice(0, 5).map((rv: any) => ({
        author: rv.author_name || rv.reviewer_name || rv.student_name || 'Learner',
        rating: typeof rv.rating === 'number' ? rv.rating : undefined,
        text: rv.text || rv.review_text || rv.comment || undefined,
      })),
    };
  } catch {
    return fallback;
  }
}

export async function getTeacherPayouts(): Promise<{
  totalPaid: number;
  pending: number;
  currency: string;
  payouts: Array<{ amount?: number; status?: string; date?: string; method?: string }>;
}> {
  try {
    const r = await backendFetch('/teachers/me/payouts');
    if (!r.ok) return { totalPaid: 0, pending: 0, currency: 'INR', payouts: [] };
    const d = await r.json();
    return {
      totalPaid: num(d.total_paid),
      pending: num(d.pending_amount),
      currency: d.currency || 'INR',
      payouts: (Array.isArray(d.payouts) ? d.payouts : []).map((p: any) => ({
        amount: typeof p.amount === 'number' ? p.amount : undefined,
        status: p.status,
        date: p.created_at || p.paid_at || p.date,
        method: p.method,
      })),
    };
  } catch {
    return { totalPaid: 0, pending: 0, currency: 'INR', payouts: [] };
  }
}

export async function getTeacherSessions(): Promise<{ total: number; earnedInr: number; sessions: TeacherSession[] }> {
  try {
    const r = await backendFetch('/premium-sessions/my');
    if (!r.ok) return { total: 0, earnedInr: 0, sessions: [] };
    const d = await r.json();
    return {
      total: num(d.total),
      earnedInr: num(d.total_earned_inr),
      sessions: (Array.isArray(d.sessions) ? d.sessions : []).map(projectSession),
    };
  } catch {
    return { total: 0, earnedInr: 0, sessions: [] };
  }
}

/** Teacher onboarding-protocol state (GET /teachers/me/onboarding-state).
 *  Drives the 4-step checklist (Profile → Video → KYC → Empanelment) and the
 *  KYC / verification gating across the teacher dashboard. */
export type OnboardingState = {
  isTeacher: boolean;
  currentStep: 'profile' | 'video' | 'kyc' | 'empanelment' | 'complete';
  profileComplete: boolean;
  profileFieldsMissing: Array<{ field: string; label: string }>;
  profileFieldsCompleted: number;
  profileFieldsTotal: number;
  videoSubmitted: boolean;
  kycVerified: boolean;
  panVerified: boolean;
  bankVerified: boolean;
  isEmpanelled: boolean;
  sessionsDone: number;
  avgRating: number;
  freeTrackEligible: boolean;
  freeTrackMinSessions: number;
  freeTrackMinRating: number;
  allComplete: boolean;
} | null;

export async function getOnboardingState(): Promise<OnboardingState> {
  try {
    const r = await backendFetch('/teachers/me/onboarding-state');
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.is_teacher) return { ...EMPTY_ONBOARDING, isTeacher: false };
    return {
      isTeacher: true,
      currentStep: d.current_step || 'profile',
      profileComplete: !!d.profile_complete,
      profileFieldsMissing: Array.isArray(d.profile_fields_missing) ? d.profile_fields_missing : [],
      profileFieldsCompleted: num(d.profile_fields_completed),
      profileFieldsTotal: num(d.profile_fields_total) || 5,
      videoSubmitted: !!d.video_intro_submitted,
      kycVerified: !!d.kyc_verified,
      panVerified: !!d.pan_verified,
      bankVerified: !!d.bank_verified,
      isEmpanelled: !!d.is_empanelled,
      sessionsDone: num(d.sessions_done),
      avgRating: num(d.avg_rating),
      freeTrackEligible: !!d.free_track_eligible,
      freeTrackMinSessions: num(d.free_track_min_sessions) || 5,
      freeTrackMinRating: num(d.free_track_min_rating) || 4,
      allComplete: !!d.all_complete,
    };
  } catch {
    return null;
  }
}

const EMPTY_ONBOARDING = {
  currentStep: 'profile' as const,
  profileComplete: false,
  profileFieldsMissing: [],
  profileFieldsCompleted: 0,
  profileFieldsTotal: 5,
  videoSubmitted: false,
  kycVerified: false,
  panVerified: false,
  bankVerified: false,
  isEmpanelled: false,
  sessionsDone: 0,
  avgRating: 0,
  freeTrackEligible: false,
  freeTrackMinSessions: 5,
  freeTrackMinRating: 4,
  allComplete: false,
};

/** The teacher's own editable record (GET /teachers/me/native-profile).
 *  `onboarded` is false when the signed-in user has no teacher record yet.
 *  Wrapped in React cache() so multiple guards/reads in a SINGLE request share
 *  one no-store backend read (per-request only — never cached across requests,
 *  so an admin status change is always reflected on the teacher's next request). */
export const getTeacherSelfProfile = cache(async (): Promise<{ onboarded: boolean; self: TeacherSelf | null; social: Record<string, string> }> => {
  try {
    const r = await backendFetch('/teachers/me/native-profile');
    if (!r.ok) return { onboarded: false, self: null, social: {} };
    const d = await r.json();
    const t = d.teacher || {};
    return {
      onboarded: !!d.onboarded,
      self: projectTeacher(t),
      social: {
        instagram: t.social_media?.instagram || '',
        youtube: t.social_media?.youtube || '',
        linkedin: t.social_media?.linkedin || '',
        facebook: t.social_media?.facebook || '',
        twitter: t.social_media?.twitter || '',
        website: t.social_media?.website || '',
      },
    };
  } catch {
    return { onboarded: false, self: null, social: {} };
  }
});

/** Combined gate read for teacher pages: onboarded + verified in one call. */
export async function getTeacherGate(): Promise<{ onboarded: boolean; self: TeacherSelf | null; verified: boolean }> {
  const { onboarded, self } = await getTeacherSelfProfile();
  return { onboarded, self, verified: isTeacherVerified(self) };
}

/**
 * MANDATORY PROFILE-FIRST guard. Redirects a teacher whose five-field profile is
 * NOT yet complete into the onboarding wizard. Uses the backend's authoritative
 * `profile_complete` signal (the account role can flip to "teacher" — and the
 * native-profile `onboarded` flag can be true — before the profile is actually
 * filled in, so `onboarded` alone is NOT sufficient). Never gates on KYC /
 * payment / empanelment. On a transient read error we do NOT trap the user.
 * Call AFTER the session + teacher-role checks.
 */
export async function requireOnboardedTeacher(): Promise<void> {
  const [ob, { self }] = await Promise.all([getOnboardingState(), getTeacherSelfProfile()]);
  // "Complete" = the remote flag OR the wizard's core fields are present (the flag
  // can lag right after native-register / may also expect a photo). Redirect only
  // when we positively know the profile is still incomplete.
  const complete = (ob?.profileComplete ?? false) || hasCoreProfile(self);
  if (ob?.isTeacher && !complete) redirect('/app/teacher/onboarding');
}

// ─── Teacher journey / level timeline ──────────────────────────────────────
export type JourneyMilestone = { key: string; label: string; date: string | null; done: boolean };
export type TeacherJourney = { milestones: JourneyMilestone[]; level: TeacherLevel; levelLabel: string; color: string } | null;

/** Real milestone history for the dashboard "Your journey" timeline. Every date
 *  is a genuine backend timestamp; a date earlier than the account's own
 *  created_at (backfilled/seed artifacts) is suppressed so the timeline never
 *  shows a milestone as happening "before you joined". */
export async function getTeacherJourney(): Promise<TeacherJourney> {
  try {
    const r = await backendFetch('/teachers/me/native-profile');
    if (!r.ok) return null;
    const d = await r.json();
    const t = d?.teacher;
    if (!t || !d.onboarded) return null;
    const joinedTs = typeof t.created_at === 'string' ? Date.parse(t.created_at) : NaN;
    const saneDate = (v: any): string | null => {
      if (typeof v !== 'string' || !v) return null;
      const ts = Date.parse(v);
      if (Number.isNaN(ts)) return null;
      if (!Number.isNaN(joinedTs) && ts < joinedTs) return null; // suppress pre-join seed dates
      return v;
    };
    const empDate = t.empanelled_at || t.empanelment_cert?.issued_at || null;
    const milestones: JourneyMilestone[] = [
      { key: 'joined', label: 'Joined as a teacher', date: typeof t.created_at === 'string' ? t.created_at : null, done: true },
      { key: 'phone', label: 'Phone verified', date: t.phone_verified ? saneDate(t.phone_verified_at) : null, done: !!t.phone_verified },
      { key: 'kyc', label: isIndiaCountry(t.country) ? 'InstaKYC identity verified' : t.kyc_verified ? 'Identity verified' : 'Identity check — not yet available in your country', date: t.kyc_verified ? saneDate(t.kyc_verified_at) : null, done: !!t.kyc_verified },
      { key: 'empanel', label: 'Empanelled', date: t.is_empanelled ? saneDate(empDate) : null, done: !!t.is_empanelled },
    ];
    const lvl = getTeacherLevel({ tier: t.tier, badgePrimary: t.badge_primary });
    const m = levelMeta(lvl);
    return { milestones, level: lvl, levelLabel: m.fullLabel, color: m.color };
  } catch {
    return null;
  }
}

export type Codex = {
  styles: string[];
  specializations: Array<{ id: string; name: string; desc?: string }>;
  paramparas: Array<{ id: string; name: string; founder?: string; words?: string }>;
};

/** Canonical option lists (styles / specializations / paramparas) used by the
 *  teacher profile editor. Backed by GET /codex. */
export async function getCodex(): Promise<Codex> {
  const empty: Codex = { styles: [], specializations: [], paramparas: [] };
  try {
    const r = await backendFetch('/codex');
    if (!r.ok) return empty;
    const d = await r.json();
    return {
      styles: Array.isArray(d.styles) ? d.styles.filter((s: any) => typeof s === 'string') : [],
      specializations: (Array.isArray(d.specializations) ? d.specializations : [])
        .filter((s: any) => s && s.id)
        .map((s: any) => ({ id: String(s.id), name: s.name || s.id, desc: s.desc || undefined })),
      paramparas: (Array.isArray(d.paramparas) ? d.paramparas : [])
        .filter((p: any) => p && p.id)
        .map((p: any) => ({ id: String(p.id), name: p.name || p.id, founder: p.founder || undefined, words: p.lineage_words || undefined })),
    };
  } catch {
    return empty;
  }
}

/** Founding-teacher intake counter (GET /platform/founding-intake) — drives the
 *  onboarding success screen and the public "Become a Teacher" landing. */
export type FoundingIntake = {
  claimed: number;
  cap: number;
  remaining: number;
  percentage: number;
  nextSeat: number;
  launchCities: string[];
} | null;

export async function getFoundingIntake(): Promise<FoundingIntake> {
  try {
    const r = await backendFetch('/platform/founding-intake');
    if (!r.ok) return null;
    const d = await r.json();
    return {
      claimed: num(d.claimed),
      cap: num(d.cap) || 1500,
      remaining: num(d.remaining),
      percentage: num(d.percentage),
      nextSeat: num(d.next_seat),
      launchCities: Array.isArray(d.launch_cities) ? d.launch_cities.filter((c: any) => typeof c === 'string') : [],
    };
  } catch {
    return null;
  }
}


// ─── InstaKYC (Sandbox.co.in) ──────────────────────────────────────────────
export type KycStatus = {
  kycPaid: boolean;
  kycVerified: boolean;
  aadhaarVerified: boolean;
  panVerified: boolean;
  bankVerified: boolean;
  maskedAadhaar: string | null;
} | null;

export async function getKycStatus(): Promise<KycStatus> {
  try {
    const r = await backendFetch('/kyc/sandbox/status');
    if (!r.ok) return null;
    const d = await r.json();
    return {
      kycPaid: !!d.kyc_paid,
      kycVerified: !!d.kyc_verified,
      aadhaarVerified: !!(d.data?.verified),
      panVerified: !!d.pan_verified,
      bankVerified: !!d.bank_verified,
      maskedAadhaar: d.data?.masked_aadhaar || null,
    };
  } catch {
    return null;
  }
}

// ─── Empanelment ───────────────────────────────────────────────────────────
export type EmpanelmentProgress = {
  isEmpanelled: boolean;
  path: string | null;
  minSessions: number;
  minRating: number;
  paidSessions: number;
  sessionsRemaining: number;
  avgRating: number;
  reviewCount: number;
  progressPct: number;
  nextStep: string;
} | null;

export async function getEmpanelmentProgress(): Promise<EmpanelmentProgress> {
  try {
    const r = await backendFetch('/teachers/me/empanelment-progress');
    if (!r.ok) return null;
    const d = await r.json();
    const req = d.slow_path?.requirements || {};
    const p = d.slow_path?.progress || {};
    return {
      isEmpanelled: !!d.is_empanelled,
      path: d.path || null,
      minSessions: num(req.min_paid_sessions) || 5,
      minRating: num(req.min_avg_rating) || 4,
      paidSessions: num(p.paid_sessions),
      sessionsRemaining: num(p.sessions_remaining),
      avgRating: num(p.avg_rating),
      reviewCount: num(p.review_count),
      progressPct: num(p.progress_pct),
      nextStep: d.slow_path?.next_step || '',
    };
  } catch {
    return null;
  }
}

export type FastTrackOffer = {
  amount: number;
  currency: string;
  durationMinutes: string;
  format: string;
  whatYouGet: string[];
  whatItsNot: string[];
  altPath: string;
} | null;

export async function getFastTrackOffer(): Promise<FastTrackOffer> {
  try {
    const r = await backendFetch('/empanelment/fast-track/offer');
    if (!r.ok) return null;
    const d = await r.json();
    return {
      amount: num(d.amount) || 4999,
      currency: d.currency || 'INR',
      durationMinutes: String(d.duration_minutes || '30–45'),
      format: d.format || 'Online interview with a Council member',
      whatYouGet: Array.isArray(d.what_you_get) ? d.what_you_get : [],
      whatItsNot: Array.isArray(d.what_its_not) ? d.what_its_not : [],
      altPath: d.alt_path || '',
    };
  } catch {
    return null;
  }
}

export type FastTrackRequest = {
  requestId: string;
  status: string;
  amount: number;
  motivation: string;
  paymentStatus: string | null;
  decisionOutcome: string | null;
  decisionNotes: string | null;
  interviewScheduledAt: string | null;
};

export type FastTrackStatus = { active: FastTrackRequest | null; history: FastTrackRequest[] } | null;

function projectFtRequest(r: any): FastTrackRequest {
  return {
    requestId: r.request_id,
    status: r.status || 'unknown',
    amount: num(r.amount) || 4999,
    motivation: r.motivation || '',
    paymentStatus: r.payment?.status || null,
    decisionOutcome: r.decision?.outcome || null,
    decisionNotes: r.decision?.notes || null,
    interviewScheduledAt: r.interview?.scheduled_at || null,
  };
}

export async function getFastTrackStatus(): Promise<FastTrackStatus> {
  try {
    const r = await backendFetch('/empanelment/fast-track/my-status');
    if (!r.ok) return null;
    const d = await r.json();
    return {
      active: d.active ? projectFtRequest(d.active) : null,
      history: Array.isArray(d.history) ? d.history.map(projectFtRequest) : [],
    };
  } catch {
    return null;
  }
}


// ─── Teacher wallet ────────────────────────────────────────────────────────
export type WalletActivity = {
  id: string;
  source: string;
  direction: 'credit' | 'debit';
  amount: number;
  note: string;
  ts: number | null;
};

export type TeacherWallet = {
  session: { available: number; held: number; lifetimeEarned: number; lifetimeWithdrawn: number };
  referral: { available: number; totalEarned: number; totalWithdrawn: number; referralsTotal: number; referralsEmpanelled: number };
  combined: { available: number; held: number; lifetimeEarned: number; lifetimeWithdrawn: number };
  withdrawable: number;
  hasPin: boolean;
  hasBank: boolean;
  hasUpi: boolean;
  platformFeePct: number;
  activity: WalletActivity[];
  payout: {
    bankMasked: string | null;
    ifsc: string | null;
    accountHolder: string | null;
    upiId: string | null;
    kycVerified: boolean;
    panVerified: boolean;
    bankVerified: boolean;
  };
  payouts: {
    pending: number;
    totalPaid: number;
    currency: string;
    items: { id: string; amount: number; status: string; method: string | null; ts: number | null; utr: string | null }[];
  };
} | null;

export async function getTeacherWallet(): Promise<TeacherWallet> {
  try {
    const [sr, pr, por] = await Promise.all([
      backendFetch('/teacher-wallet/unified-summary?activity_limit=12'),
      backendFetch('/teacher-wallet/payout-details'),
      backendFetch('/teachers/me/payouts'),
    ]);
    if (!sr.ok) return null;
    const d = await sr.json();
    const p = pr.ok ? await pr.json() : {};
    const po = por.ok ? await por.json() : {};
    const br = await backendFetch('/teacher-wallet/balance');
    const bal = br.ok ? await br.json() : {};
    const sw = d.session_wallet || {};
    const rw = d.referral_wallet || {};
    const cb = d.combined || {};
    const ba = p.bank_account || {};
    const ver = p.verifications || {};
    return {
      session: {
        available: num(sw.balance_inr),
        held: num(sw.held_inr),
        lifetimeEarned: num(sw.lifetime_earned_inr),
        lifetimeWithdrawn: num(sw.lifetime_withdrawn_inr),
      },
      referral: {
        available: num(rw.available_inr),
        totalEarned: num(rw.total_earned_inr),
        totalWithdrawn: num(rw.total_withdrawn_inr),
        referralsTotal: num(rw.referrals_total),
        referralsEmpanelled: num(rw.referrals_empanelled),
      },
      combined: {
        available: num(cb.available_inr),
        held: num(cb.held_inr),
        lifetimeEarned: num(cb.lifetime_earned_inr),
        lifetimeWithdrawn: num(cb.lifetime_withdrawn_inr),
      },
      withdrawable: num(bal.withdrawable_inr),
      hasPin: !!bal.has_pin,
      hasBank: !!bal.has_bank_account,
      hasUpi: !!bal.has_upi,
      platformFeePct: num(bal.platform_fee_pct) || 15,
      activity: (Array.isArray(d.recent_activity) ? d.recent_activity : []).map((a: any): WalletActivity => {
        const ts = a.created_at ? Date.parse(a.created_at) : NaN;
        return {
          id: String(a.txn_id || Math.random().toString(36).slice(2)),
          source: a.source || 'wallet',
          direction: a.direction === 'debit' || a.kind === 'debit' ? 'debit' : 'credit',
          amount: num(a.amount),
          note: a.note || '',
          ts: Number.isNaN(ts) ? null : ts,
        };
      }),
      payout: {
        bankMasked: ba.account_number_masked || null,
        ifsc: ba.ifsc || null,
        accountHolder: ba.account_holder || null,
        upiId: p.upi_id || null,
        kycVerified: !!ver.kyc_verified,
        panVerified: !!ver.pan_verified,
        bankVerified: !!ver.bank_verified,
      },
      payouts: {
        pending: num(po.pending_amount),
        totalPaid: num(po.total_paid),
        currency: po.currency || 'INR',
        items: (Array.isArray(po.payouts) ? po.payouts : []).map((x: any) => {
          const ts = x.created_at ? Date.parse(x.created_at) : NaN;
          return {
            id: String(x.payout_id || x.id || x.transfer_id || Math.random().toString(36).slice(2)),
            amount: num(x.amount_inr ?? x.amount),
            status: String(x.status || 'pending'),
            method: x.payout_method || x.method || null,
            ts: Number.isNaN(ts) ? null : ts,
            utr: x.utr || x.reference || x.reference_id || null,
          };
        }),
      },
    };
  } catch {
    return null;
  }
}

// ─── Teacher 1:1 bookings (premium sessions) ───────────────────────────────
export type TeacherBooking = {
  id: string;
  studentName: string;
  studentPhone: string | null;
  notes: string;
  slotTs: number | null;
  amount: number;
  teacherShare: number;
  paymentStatus: string | null;
  status: string;
};

export async function getTeacherBookings(): Promise<{ total: number; earnedInr: number; bookings: TeacherBooking[] }> {
  try {
    const r = await backendFetch('/premium-sessions/my');
    if (!r.ok) return { total: 0, earnedInr: 0, bookings: [] };
    const d = await r.json();
    const bookings = (Array.isArray(d.sessions) ? d.sessions : []).map((s: any): TeacherBooking => {
      const ts = s.preferred_slot ? Date.parse(s.preferred_slot) : NaN;
      return {
        id: String(s.session_id || s.id),
        studentName: s.student_name || 'Student',
        studentPhone: s.student_phone || null,
        notes: s.notes || '',
        slotTs: Number.isNaN(ts) ? null : ts,
        amount: num(s.amount),
        teacherShare: Math.round(num(s.teacher_share)),
        paymentStatus: s.payment?.status || null,
        status: s.status || 'pending',
      };
    });
    return { total: num(d.total), earnedInr: Math.round(num(d.total_earned_inr)), bookings };
  } catch {
    return { total: 0, earnedInr: 0, bookings: [] };
  }
}


// ─── Teacher referral program (refer & earn) ───────────────────────────────
export type ReferralTier = {
  currentLabel: string;
  nextLabel: string | null;
  toNext: number;
  progressPct: number;
  nextBonus: number;
  ladder: Array<{ label: string; minEmp: number; maxEmp: number; bonus: number; perk: string | null }>;
};
export type ReferralDashboard = {
  code: string;
  empanelled: boolean;
  totalEarned: number;
  totalWithdrawn: number;
  pending: number;
  available: number;
  referrals: { total: number; kycVerified: number; empanelled: number };
  tier: ReferralTier | null;
} | null;

export async function getReferralDashboard(): Promise<ReferralDashboard> {
  try {
    const r = await backendFetch('/teacher-referrals/dashboard');
    if (!r.ok) return null;
    const d = await r.json();
    const w = d.wallet || {};
    const rf = d.referrals || {};
    const t = d.tier || null;
    const tier: ReferralTier | null = t
      ? {
          currentLabel: t.current?.label || '—',
          nextLabel: t.next?.label ?? null,
          toNext: num(t.to_next),
          progressPct: Math.min(Math.max(num(t.progress_pct), 0), 100),
          nextBonus: num(t.next?.bonus),
          ladder: Array.isArray(t.ladder)
            ? t.ladder.map((l: any) => ({ label: l.label || '—', minEmp: num(l.min_emp), maxEmp: num(l.max_emp), bonus: num(l.bonus), perk: l.perk ?? null }))
            : [],
        }
      : null;
    return {
      code: typeof d.code === 'string' ? d.code : '',
      empanelled: !!d.empanelled,
      totalEarned: num(w.total_earned),
      totalWithdrawn: num(w.total_withdrawn),
      pending: num(w.pending),
      available: num(w.available),
      referrals: { total: num(rf.total), kycVerified: num(rf.kyc_verified), empanelled: num(rf.empanelled) },
      tier,
    };
  } catch {
    return null;
  }
}

// ─── Teacher intro video (Cloudinary) ──────────────────────────────────────
// GET /teachers/me/video-intro. status is one of:
//   none | upload_pending | pending | processing | approved | rejected
export type VideoIntro = {
  status: string;
  secureUrl: string | null;
  posterUrl: string | null;
  durationSeconds: number | null;
  rejectReason: string | null;
  uploadedAt: string | null;
};

export async function getTeacherVideoIntro(): Promise<VideoIntro> {
  const empty: VideoIntro = { status: 'none', secureUrl: null, posterUrl: null, durationSeconds: null, rejectReason: null, uploadedAt: null };
  try {
    const r = await backendFetch('/teachers/me/video-intro');
    if (!r.ok) return empty;
    const d = await r.json();
    const v = d?.video_intro;
    if (!v || !v.status) return empty;
    return {
      status: String(v.status),
      secureUrl: v.secure_url || null,
      posterUrl: v.poster_url || null,
      durationSeconds: typeof v.duration_seconds === 'number' ? v.duration_seconds : null,
      rejectReason: v.reject_reason || null,
      uploadedAt: v.uploaded_at || null,
    };
  } catch {
    return empty;
  }
}

// ─── Premium 1:1 offering config ───────────────────────────────────────────
// The backend enforces tier-based rate bounds (returned as tier_rules) and a
// profile/empanelment gate on ENABLING. There is no GET, so we read the current
// values from the native profile and echo them back (idempotent — same values)
// purely to obtain the authoritative tier_rules. platform fee on 1:1 = 15%.
export type PremiumConfig = {
  enabled: boolean;
  rateInr: number;
  durationMin: number;
  tierMin: number;
  tierMax: number;
  tierLabel: string;
  feePct: number;
} | null;

export async function getPremiumConfig(): Promise<PremiumConfig> {
  try {
    const pr = await backendFetch('/teachers/me/native-profile');
    if (!pr.ok) return null;
    const t = (await pr.json())?.teacher || {};
    const ps = t.premium_session || {};
    const enabled = !!ps.enabled;
    const rateInr = num(ps.rate_inr) || 0;
    const durationMin = num(ps.duration_minutes) || 60;
    // Idempotent echo to fetch tier_rules (no-op: same current values).
    let tierMin = 750;
    let tierMax = 2000;
    let tierLabel = typeof t.tier === 'string' ? t.tier : '';
    const echo = await backendFetch('/teachers/me/premium-session-config', {
      method: 'PUT',
      body: JSON.stringify({ enabled, rate_inr: rateInr || 1500, duration_minutes: durationMin }),
    });
    if (echo.ok) {
      const tr = (await echo.json())?.tier_rules || {};
      if (typeof tr.min === 'number') tierMin = tr.min;
      if (typeof tr.max === 'number') tierMax = tr.max;
      if (tr.label) tierLabel = tr.label;
    }
    return { enabled, rateInr: rateInr || tierMin, durationMin, tierMin, tierMax, tierLabel, feePct: 15 };
  } catch {
    return null;
  }
}
