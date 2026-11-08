// Server-only data + derivation layer for the Teacher "My Widgets" Growth
// System (Phase 2 P0). Every value is derived from REAL backend state — no
// fabricated views/clicks/students/revenue. All reads go through the BFF
// (bearer from the httpOnly cookie). The canonical public destination for every
// distribution widget is the teacher's own profile: /teachers/{handle}.
//
// Backend capability GAPS (documented, never faked — see the "Not yet tracked"
// panel in the UI):
//   · profile-view tracking (impressions/visits) — no endpoint exists
//   · per-source attribution (WhatsApp/Instagram/QR/…) — no endpoint exists
//   · widget view/click counters — no endpoint exists
// We surface the funnel stages the backend DOES expose (enquiries → bookings →
// sessions → students → earnings, individual and organisation) and show honest
// empty states elsewhere.
import { backendFetch } from '@/lib/server/session';
import { canonical, SITE_URL } from '@/lib/site';
import { titleCase } from '@/lib/format';
import {
  getTeacherSelfProfile,
  getReferralDashboard,
  getTeacherBookings,
  type TeacherSelf,
  type ReferralDashboard,
} from '@/lib/server/teacher';
import { getOneOnOneBookings } from '@/lib/server/one-on-one';

const num = (v: any): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

// ── Growth journey (GET /teachers/me/journey) ──────────────────────────────
export type Journey = {
  stage1Complete: boolean; // profile
  stage2Complete: boolean; // (first positive sessions)
  stage3Complete: boolean; // empanelment / listing
  positive1on1Count: number;
  positive1on1Threshold: number;
  tier: string | null;
  empanelmentPath: string | null;
  nextAction: { stage: number; code: string; label: string; route: string } | null;
  unlocks: { accept1on1: boolean; directoryListed: boolean; cohortMatchable: boolean; retreatHost: boolean };
} | null;

// Mobile → web route mapping for the journey's next-action deep link.
const ROUTE_MAP: Record<string, string> = {
  '/teacher-onboarding': '/app/teacher/onboarding',
  '/teacher-profile': '/app/teacher/profile/edit',
  '/teacher-profile-edit': '/app/teacher/profile/edit',
  '/teacher-kyc': '/app/teacher/kyc',
  '/kyc': '/app/teacher/kyc',
  '/empanelment-fast-track': '/app/teacher/empanelment',
  '/empanelment': '/app/teacher/empanelment',
};
export function webRoute(route?: string | null): string {
  if (!route) return '/app';
  if (ROUTE_MAP[route]) return ROUTE_MAP[route];
  return route.startsWith('/app') ? route : '/app';
}

export async function getGrowthJourney(): Promise<Journey> {
  try {
    const r = await backendFetch('/teachers/me/journey');
    if (!r.ok) return null;
    const d = await r.json();
    const na = d.next_action;
    const u = d.unlocks || {};
    return {
      stage1Complete: !!d.stage1_complete,
      stage2Complete: !!d.stage2_complete,
      stage3Complete: !!d.stage3_complete,
      positive1on1Count: num(d.positive_1on1_count),
      positive1on1Threshold: num(d.positive_1on1_threshold) || 5,
      tier: d.tier || null,
      empanelmentPath: d.empanelment_path || null,
      nextAction: na
        ? { stage: num(na.stage), code: String(na.code || ''), label: String(na.label || 'Next step'), route: webRoute(na.route) }
        : null,
      unlocks: {
        accept1on1: !!u.accept_1on1,
        directoryListed: !!u.directory_listed,
        cohortMatchable: !!u.cohort_matchable,
        retreatHost: !!u.retreat_host,
      },
    };
  } catch {
    return null;
  }
}

// ── Embeddable website widgets (GET /teachers/me/embeds) ───────────────────
export type EmbedWidget = { id: string; title: string; description: string; category: string; previewSrc: string; snippet: string; iframe: string };
export type Embeds = { handle: string; isEmpanelled: boolean; categories: string[]; widgets: EmbedWidget[]; tip?: string } | null;

// The backend authors embed URLs against a legacy/parked host. Normalise every
// COPYABLE output to the canonical public origin (www.nostops.org) — consistent
// with the rest of the codebase's toWww() policy. The in-studio LIVE PREVIEW,
// however, is pointed straight at the backend (which serves the embed HTML now
// with `frame-ancestors *`) so it renders in every environment.
const LEGACY_HOSTS = ['nostops.com', 'nostops.app'];
const CANON_HOST = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return 'www.nostops.org';
  }
})();
function toCanonicalHost(s: string): string {
  if (!s) return s;
  let out = s;
  for (const h of LEGACY_HOSTS) out = out.split(h).join(CANON_HOST);
  return out;
}
const BACKEND_ORIGIN = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
function toPreviewSrc(previewUrl: string): string {
  if (!previewUrl) return '';
  if (/^https?:\/\//i.test(previewUrl)) {
    // Absolute (legacy host) → repoint the path at the live backend origin.
    try {
      const path = new URL(previewUrl).pathname + new URL(previewUrl).search;
      return BACKEND_ORIGIN ? BACKEND_ORIGIN + path : path;
    } catch {
      return previewUrl;
    }
  }
  return BACKEND_ORIGIN ? BACKEND_ORIGIN + previewUrl : previewUrl;
}

export async function getTeacherEmbeds(): Promise<{ embeds: Embeds; forbidden: boolean }> {
  try {
    const r = await backendFetch('/teachers/me/embeds');
    if (r.status === 403 || r.status === 404) return { embeds: null, forbidden: true };
    if (!r.ok) return { embeds: null, forbidden: false };
    const d = await r.json();
    const widgets: EmbedWidget[] = (Array.isArray(d.widgets) ? d.widgets : []).map((w: any) => ({
      id: String(w.id),
      title: w.title || 'Widget',
      description: w.description || '',
      category: w.category || 'Badges',
      previewSrc: toPreviewSrc(w.preview_url || ''),
      snippet: toCanonicalHost(w.snippet || ''),
      iframe: toCanonicalHost(w.iframe || ''),
    }));
    return {
      embeds: {
        handle: String(d.handle || ''),
        isEmpanelled: !!d.is_empanelled,
        categories: Array.isArray(d.categories) ? d.categories : [],
        widgets,
        tip: d.tip || undefined,
      },
      forbidden: false,
    };
  } catch {
    return { embeds: null, forbidden: false };
  }
}

export type LeaderboardEntry = { rank: number; name: string; invited: number; empanelled: number; tier: string | null; isMe: boolean };
export type ReferralLeaderboard = { entries: LeaderboardEntry[]; myRank: number | null } | null;

// Teacher-invite leaderboard. Targets the program-scoped endpoint only
// (/teacher-referrals/leaderboard) — NOT the generic /referrals/leaderboard
// which is a different program. Flexible mapper tolerates array or
// {leaderboard|entries|top:[...]} shapes. Returns null on 404/error so the UI
// shows an honest "warming up" state instead of fabricated ranks.
export async function getReferralLeaderboard(): Promise<ReferralLeaderboard> {
  try {
    const r = await backendFetch('/teacher-referrals/leaderboard');
    if (!r.ok) return null;
    const d = await r.json();
    const raw: any[] = Array.isArray(d)
      ? d
      : Array.isArray(d.leaderboard)
        ? d.leaderboard
        : Array.isArray(d.entries)
          ? d.entries
          : Array.isArray(d.top)
            ? d.top
            : [];
    const entries: LeaderboardEntry[] = raw.map((e: any, i: number) => ({
      rank: num(e.rank) || i + 1,
      name: e.name || e.display_name || e.teacher_name || 'Teacher',
      invited: num(e.total_referrals ?? e.invited ?? e.referrals ?? e.count),
      empanelled: num(e.empanelled ?? e.converted ?? e.empanelled_referrals ?? e.empanelled_count),
      tier: e.tier ?? e.tier_label ?? null,
      isMe: !!(e.is_me ?? e.me ?? e.is_self ?? e.isCurrentUser),
    }));
    const myRank =
      typeof d.my_rank === 'number'
        ? d.my_rank
        : typeof d.rank === 'number'
          ? d.rank
          : (entries.find((e) => e.isMe)?.rank ?? null);
    return { entries, myRank };
  } catch {
    return null;
  }
}

// ── City demand signals (GET /dashboards/teacher-stats → live_demand) ──────
export type LiveDemand = {
  corporateSignals: number;
  hrInquiriesToday: number;
  unmatchedBatches: number;
  similarEmpanelled: number;
  myMonthlyInr: number;
  peerAvgMonthlyInr: number;
  city: string | null;
} | null;

async function getLiveDemand(): Promise<LiveDemand> {
  try {
    const r = await backendFetch('/dashboards/teacher-stats');
    if (!r.ok) return null;
    const d = await r.json();
    const ld = d.live_demand || {};
    const pb = d.peer_benchmark || {};
    return {
      corporateSignals: num(ld.new_corporate_signals_in_city),
      hrInquiriesToday: num(ld.hr_inquiries_today),
      unmatchedBatches: num(ld.unmatched_batches_in_city),
      similarEmpanelled: num(ld.similar_empanelled_count),
      myMonthlyInr: num(pb.my_monthly_inr),
      peerAvgMonthlyInr: num(pb.peer_avg_monthly_inr),
      city: d.city || null,
    };
  } catch {
    return null;
  }
}

// ── View-models shared with client components (must stay serializable) ─────
export type ProfileVM = {
  name: string;
  handle: string;
  city?: string;
  experienceYears?: number;
  tierBadge?: string;
  styles: string[];
  specializations: string[];
  avatarUrl: string | null;
  isEmpanelled: boolean;
  isVerified: boolean;
  kycVerified: boolean;
  rating: number | null;
  reviews: number;
  social: { instagram?: string; facebook?: string; linkedin?: string; youtube?: string; website?: string };
  offers: { online: boolean; group: boolean; corporate: boolean; privateSession: boolean };
  publicLive: boolean;
  url: string; // canonical public profile (empty string if not live)
};

export type WidgetKind = 'identity' | 'verified' | 'profile' | 'book' | 'group' | 'organisation' | 'qr' | 'email' | 'social';
export type WidgetStatus = 'active' | 'ready' | 'locked';
export type WidgetVM = {
  id: WidgetKind;
  title: string;
  purpose: string;
  category: string;
  status: WidgetStatus;
  note?: string;
  url: string;
  shareText: string;
};

export type Funnel = {
  individual: { enquiries: number; confirmed: number; completed: number; students: number; earnedInr: number };
  organisation: { sessions: number; confirmed: number; earnedInr: number };
  reputation: { rating: number | null; reviews: number };
};

export type Recommendation = { title: string; body: string; cta: string; href: string; tone: 'brand' | 'accent' | 'neutral' };

export type JourneyStage = { key: string; label: string; done: boolean; hint: string };

export type WidgetStudioState = {
  profile: ProfileVM;
  widgets: WidgetVM[];
  journey: Journey;
  stages: JourneyStage[];
  recommendations: Recommendation[];
  funnel: Funnel;
  referral: ReferralDashboard;
  invite: {
    code: string;
    link: string;
    shareText: string;
    totalEarned: number;
    available: number;
    empanelled: boolean;
    referrals: { total: number; kycVerified: number; empanelled: number };
    tier: import('@/lib/server/teacher').ReferralTier | null;
  } | null;
  demand: LiveDemand;
  leaderboard: ReferralLeaderboard;
  completeness: { pct: number; done: number; total: number; steps: Array<{ label: string; done: boolean }> };
  embedsForbidden: boolean;
  embeds: Embeds;
};

const brandPitch = (name: string) =>
  `🧘 ${name} on NOSTOPS — India's teacher-first yoga cooperative. Book a session, explore my styles & lineage, and practise with a verified teacher.`;

function toProfileVM(self: TeacherSelf, social: Record<string, string>): ProfileVM {
  const publicLive = self.publicVisible;
  return {
    name: self.name,
    handle: self.handle,
    city: self.city,
    experienceYears: self.experienceYears,
    tierBadge: self.badgePrimary,
    styles: (self.styles || []).slice(0, 6),
    specializations: (self.specializations || []).slice(0, 4).map((s) => titleCase(s)),
    avatarUrl: self.avatarUrl || null,
    isEmpanelled: self.isEmpanelled,
    // B4.7 — public "Verified" = ID check passed AND empanelled.
    isVerified: self.kycVerified && self.isEmpanelled,
    kycVerified: self.kycVerified,
    rating: self.rating ?? null,
    reviews: self.reviewsCount ?? 0,
    social: {
      instagram: social.instagram || undefined,
      facebook: social.facebook || undefined,
      linkedin: social.linkedin || undefined,
      youtube: social.youtube || undefined,
      website: social.website || undefined,
    },
    offers: {
      online: self.offers.online,
      group: self.offers.group,
      corporate: self.offers.corporate,
      privateSession: self.offers.privateSession,
    },
    publicLive,
    url: publicLive ? canonical(`/teachers/${self.handle}`) : '',
  };
}

function deriveWidgets(p: ProfileVM): WidgetVM[] {
  const url = p.url;
  const live = p.publicLive;
  const readyNote = 'Goes live the moment your public profile is active (complete KYC + listing).';
  const pitch = brandPitch(p.name);
  const list: WidgetVM[] = [];

  const base = (id: WidgetKind, title: string, purpose: string, category: string, shareText: string, gateOk = true, gateNote?: string): WidgetVM => ({
    id,
    title,
    purpose,
    category,
    status: !gateOk ? 'locked' : live ? 'active' : 'ready',
    note: !gateOk ? gateNote : live ? undefined : readyNote,
    url,
    shareText,
  });

  list.push(base('identity', 'My NOSTOPS Identity', 'Be recognised — a portable digital identity card carrying your name, designation, city and lineage.', 'Identity', pitch));
  list.push(base('profile', 'My Yoga Profile', 'Get discovered — your one link for WhatsApp, Instagram, LinkedIn and email. Everything leads here.', 'Discovery', pitch));
  list.push(
    base(
      'verified',
      'Verified Teacher',
      'Build trust — show your real NOSTOPS verification and empanelment status.',
      'Trust',
      `✅ Verified on NOSTOPS. ${pitch}`,
      p.isEmpanelled || p.kycVerified || p.isVerified,
      'Complete InstaKYC / empanelment to unlock the verified badge widget.',
    ),
  );
  list.push(
    base(
      'book',
      'Book With Me',
      'Convert interest into sessions — send people straight to your booking pathway.',
      'Students',
      `📅 Book a 1:1 yoga session with ${p.name} on NOSTOPS.`,
      p.offers.privateSession || p.offers.online,
      'Enable 1:1 / online sessions in Offerings to activate this widget.',
    ),
  );
  list.push(
    base(
      'group',
      'Group Yoga',
      'Acquire students at scale — promote your group classes and community sessions.',
      'Students',
      `👥 Join ${p.name}'s group yoga on NOSTOPS.`,
      p.offers.group,
      'Enable group classes in Offerings to activate this widget.',
    ),
  );
  list.push(
    base(
      'organisation',
      'Organisation Programmes',
      'Be found by organisations — signal you are available for company, institution and startup wellness programmes (3 / 6 / 12-month).',
      'Organisations',
      `🏢 ${p.name} delivers workplace & campus wellness programmes on NOSTOPS. HR / heads of department — start here.`,
      p.isEmpanelled || p.offers.corporate,
      'Get empanelled (or enable corporate offerings) to be matched to organisation programmes.',
    ),
  );
  list.push(base('qr', 'QR Code', 'Bridge offline to online — a scannable code for studios, flyers, cards and events.', 'Distribution', pitch));
  list.push(base('email', 'Email Signature', 'Turn every email into discovery — a tidy signature block linking to your profile.', 'Distribution', pitch));
  list.push(base('social', 'Social Media Share', 'Distribute everywhere — pre-written posts for Instagram, Facebook, LinkedIn and X.', 'Distribution', pitch));

  return list;
}

function deriveStages(p: ProfileVM, j: Journey, f: Funnel, ref: ReferralDashboard): JourneyStage[] {
  const engaged = f.individual.completed > 0 || f.organisation.sessions > 0;
  const growing = f.individual.students >= 3 || (ref?.available ?? 0) > 0 || (ref?.totalEarned ?? 0) > 0 || f.organisation.earnedInr > 0 || f.individual.earnedInr > 0;
  return [
    { key: 'recognised', label: 'Recognised', done: true, hint: 'You have a NOSTOPS teacher identity.' },
    { key: 'verified', label: 'Verified', done: p.kycVerified, hint: 'InstaKYC identity verified.' },
    { key: 'established', label: 'Established', done: !!j?.stage1Complete || p.publicLive, hint: 'Profile completed.' },
    { key: 'discovered', label: 'Discovered', done: !!j?.unlocks.directoryListed && p.publicLive, hint: 'Listed in the public directory.' },
    { key: 'chosen', label: 'Chosen', done: f.individual.enquiries > 0, hint: 'Received your first enquiry / booking.' },
    { key: 'empanelled', label: 'Empanelled', done: p.isEmpanelled, hint: 'Council-empanelled teacher.' },
    { key: 'engaged', label: 'Engaged', done: engaged, hint: 'Delivered at least one session.' },
    { key: 'growing', label: 'Growing', done: growing, hint: 'Earning across students / programmes / referrals.' },
  ];
}

function deriveRecommendations(p: ProfileVM, j: Journey, f: Funnel): Recommendation[] {
  const recs: Recommendation[] = [];
  // 1) Backend's own next action (authoritative) comes first.
  if (j?.nextAction && !p.publicLive) {
    recs.push({ title: j.nextAction.label, body: 'Finish this to make your public profile live and unlock sharing.', cta: 'Continue', href: j.nextAction.route, tone: 'brand' });
  }
  if (!p.kycVerified) {
    recs.push({ title: 'Build trust — complete InstaKYC', body: 'Verification unlocks your directory listing and the Verified badge widget.', cta: 'Start InstaKYC', href: '/app/teacher/kyc', tone: 'accent' });
  }
  if (p.publicLive) {
    recs.push({ title: 'Get students — share your profile', body: 'Post your NOSTOPS link on WhatsApp & Instagram. Activate the Identity and Profile widgets below.', cta: 'Share now', href: '#widgets', tone: 'brand' });
  }
  if (p.isEmpanelled) {
    recs.push({ title: 'Reach organisations', body: 'You are empanelled — make yourself discoverable for company, campus & startup programmes.', cta: 'Activate Organisation widget', href: '#widget-organisation', tone: 'neutral' });
  }
  if (p.publicLive && f.individual.enquiries === 0 && recs.length < 4) {
    recs.push({ title: 'Add a QR to your studio & cards', body: 'Bring offline students online — print a scannable code that opens your profile.', cta: 'Get your QR', href: '#widget-qr', tone: 'neutral' });
  }
  return recs.slice(0, 4);
}

function deriveCompleteness(p: ProfileVM & { bioLike?: boolean }) {
  const steps = [
    { label: 'Profile completed', done: !!p.bioLike || p.styles.length > 0 },
    { label: 'InstaKYC verified', done: p.kycVerified },
    { label: 'Empanelled', done: p.isEmpanelled },
    { label: 'Offerings configured', done: p.offers.privateSession || p.offers.group || p.offers.corporate || p.offers.online },
    { label: 'Public profile live', done: p.publicLive },
    { label: 'Social link added', done: !!(p.social.instagram || p.social.facebook || p.social.linkedin || p.social.youtube || p.social.website) },
  ];
  const done = steps.filter((s) => s.done).length;
  return { pct: Math.round((done / steps.length) * 100), done, total: steps.length, steps };
}

// Small helper so completeness can reference "has bio"-like signal without
// widening ProfileVM (bio isn't needed client-side).
type ProfileVMInternal = ProfileVM & { bioLike?: boolean };

export async function getWidgetStudioState(): Promise<WidgetStudioState | null> {
  const { onboarded, self, social } = await getTeacherSelfProfile();
  if (!onboarded || !self) return null;

  const [journey, oo, prem, referral, demand, leaderboard] = await Promise.all([
    getGrowthJourney(),
    getOneOnOneBookings(),
    getTeacherBookings(),
    getReferralDashboard(),
    getLiveDemand(),
    getReferralLeaderboard(),
  ]);

  // Individual demand funnel (from 1:1 bookings).
  const enquiries = oo.total;
  const confirmed = oo.bookings.filter((b) => b.teacherConfirmedAt || ['confirmed', 'session_completed'].includes(b.status) || b.teacherCompletedAt).length;
  const completed = oo.bookings.filter((b) => b.status === 'session_completed' || b.teacherCompletedAt || b.studentCompletedAt).length;
  const students = new Set(
    oo.bookings
      .filter((b) => b.teacherConfirmedAt || b.status === 'session_completed' || b.teacherCompletedAt)
      .map((b) => b.studentName.trim().toLowerCase()),
  ).size;

  // Organisation / programme funnel (from premium sessions).
  const orgConfirmed = prem.bookings.filter((b) => ['confirmed', 'completed', 'session_completed'].includes(b.status)).length;

  const funnel: Funnel = {
    individual: { enquiries, confirmed, completed, students, earnedInr: oo.earnedInr },
    organisation: { sessions: prem.total, confirmed: orgConfirmed, earnedInr: prem.earnedInr },
    reputation: { rating: self.rating ?? null, reviews: self.reviewsCount ?? 0 },
  };

  const p = toProfileVM(self, social) as ProfileVMInternal;
  p.bioLike = !!self.bio;

  const widgets = deriveWidgets(p);
  const stages = deriveStages(p, journey, funnel, referral);
  const recommendations = deriveRecommendations(p, journey, funnel);
  const completeness = deriveCompleteness(p);
  const { embeds, forbidden } = await getTeacherEmbeds();

  // Referral / invite widget (NOSTOPS network growth). Invite link uses the
  // canonical recruitment page + the PUBLIC referral code (no token). Matches
  // the existing Refer & Earn convention (/become-a-teacher?ref=CODE).
  let invite: WidgetStudioState['invite'] = null;
  if (referral && referral.code) {
    const link = `${canonical('/join')}?ref=${encodeURIComponent(referral.code)}`;
    invite = {
      code: referral.code,
      link,
      shareText: `🧘 Join me on NOSTOPS — India's teacher-first yoga cooperative. Keep 70–85% on eligible institutional programmes. Use my invite code ${referral.code}:`,
      totalEarned: referral.totalEarned,
      available: referral.available,
      empanelled: referral.empanelled,
      referrals: referral.referrals,
      tier: referral.tier,
    };
  }

  return {
    profile: p,
    widgets,
    journey,
    stages,
    recommendations,
    funnel,
    referral,
    invite,
    demand,
    leaderboard,
    completeness,
    embedsForbidden: forbidden,
    embeds,
  };
}
