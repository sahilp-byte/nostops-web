import type { AppRole } from '@/lib/roles';
import { canAccessFeature, type AccessContext, type TeacherFeature } from '@/lib/teacher-access';
import { ROI_CALCULATOR_ENABLED } from '@/lib/org/roi';

// Central, role-aware navigation config (single source of truth). Items marked
// `available: false` are structural placeholders for features not yet built and
// render as disabled ("Soon") — never as dead links. Items marked `lock: true`
// (teacher only) render disabled behind the verification gate. Navigation
// visibility is UX only; server-side authorization at each route/data boundary
// remains mandatory.
export type NavItem = { label: string; href?: string; available: boolean; lock?: boolean; icon?: string; badge?: number; promo?: { sub: string; cta: string }; emphasis?: { sub?: string } };

// A titled group of items. `title: null` renders an ungrouped block (no header).
export type NavSection = { title: string | null; items: NavItem[] };

const COMMON_TOP: NavItem = { label: 'Overview', href: '/app', available: true };

// Sentinel the layout replaces with the teacher's real /teachers/{handle} link.
export const PUBLIC_PROFILE_LABEL = 'Public Profile';

const NAV_SECTIONS_BY_ROLE: Record<AppRole, NavSection[]> = {
  learner: [
    {
      title: 'My Practice',
      items: [
        { label: 'My Dashboard', href: '/app', available: true, icon: '🏠' },
        { label: 'My Bookings', href: '/app/bookings', available: true, icon: '📅' },
        { label: 'Programme Registrations', href: '/app/spaces/registrations', available: true, icon: '🧘' },
        { label: 'Community Partner', href: '/app/spaces/partner', available: true, icon: '🤝' },
        { label: 'My Wellness Journey', href: '/app/wellness', available: true, icon: '🌱' },
      ],
    },
    {
      title: 'Discover',
      items: [
        { label: 'Bring Yoga to my Workplace', href: '/for-organisations/companies', available: true, icon: '🏢' },
        { label: 'Yoga Teachers', href: '/app/discover', available: true, icon: '🧘' },
        { label: 'Book a 1:1 Session', href: '/app/book-journey', available: true, icon: '🎯' },
        { label: 'Retreats', href: '/retreats', available: true, icon: '🏕️' },
        { label: 'Spaces near me', href: '/spaces', available: true, icon: '📍' },
      ],
    },
    {
      title: 'Growth',
      items: [{ label: 'Ask GuruAI', href: '/app/guru-ai', available: true, icon: '✨' }],
    },
    {
      title: 'Account',
      items: [
        { label: 'My Spaces', href: '/app/spaces', available: true, icon: '🏡' },
        { label: 'Enquiries Received', href: '/app/spaces/incoming', available: true, icon: '📨' },
        { label: 'Saved', href: '/app/saved', available: true, icon: '🔖' },
        { label: 'My Reservations', href: '/app/reservations', available: true, icon: '🎟️' },
        { label: 'Notifications', href: '/app/notifications', available: true, icon: '🔔' },
        { label: 'Settings', href: '/app/settings', available: true, icon: '⚙️' },
      ],
    },
  ],
  teacher: [
    {
      title: 'Workspace',
      items: [
        { label: 'Dashboard', href: '/app', available: true },
        { label: 'Progression Path', href: '/app/teacher/levels', available: true },
        { label: 'My Profile', href: '/app/teacher/profile', available: true },
        { label: PUBLIC_PROFILE_LABEL, href: '', available: true },
        { label: 'Write for NOSTOPS', href: '/app/teacher/voices', available: true, icon: '✍️' },
        { label: 'Bookings', href: '/app/teacher/bookings', available: true },
        { label: 'Sessions', href: '/app/teacher/sessions', available: true },
        { label: 'My Widgets', href: '/app/teacher/widgets', available: true },
        { label: 'Wallet', href: '/app/teacher/wallet', available: true },
      ],
    },
    {
      title: 'Get Verified',
      items: [
        { label: 'Onboarding', href: '/app/teacher/onboarding', available: true, emphasis: { sub: 'Create your teacher profile' } },
        { label: 'KYC', href: '/app/teacher/kyc', available: true },
        { label: 'Empanelment', href: '/app/teacher/empanelment', available: true },
        { label: 'Payments', available: false },
      ],
    },
    {
      title: 'Teaching & Programmes',
      items: [
        { label: 'Offerings', href: '/app/teacher/offerings', available: true },
        { label: 'Retreats', href: '/app/teacher/retreats', available: true },
        { label: 'Venue Studio', href: '/app/venue', available: true },
        { label: 'My Spaces', href: '/app/spaces', available: true },
        { label: 'Space Enquiries', href: '/app/spaces/enquiries', available: true },
        { label: 'Teaching Localities', href: '/app/spaces/teaching-localities', available: true },
        { label: 'Enquiries Received', href: '/app/spaces/incoming', available: true },
        { label: 'Group Dashboard', href: '/app/teacher/dashboard', available: true },
        { label: 'Institutional Events', href: '/app/teacher/institutional', available: true, icon: '🏢' },
      ],
    },
    {
      title: 'Community & Coordination',
      items: [
        { label: 'Teacher Pulse', href: '/app/pulse', available: true },
        { label: 'Guru Nominations', href: '/app/nominations', available: true, icon: '📜' },
        { label: 'My Mentor', href: '/app/teacher/mentor', available: true },
        { label: 'Refer & Earn', href: '/app/teacher/refer', available: true },
        { label: 'Notifications', href: '/app/notifications', available: true },
        { label: 'Messages', available: false },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Settings', href: '/app/settings', available: true },
        { label: 'Help & Support', href: '/support', available: true },
      ],
    },
  ],
  corporate: [
    {
      title: null,
      items: [
        COMMON_TOP,
        // Primary action for organisation users: the Council-programme wizard.
        { label: 'Create a Programme', href: '/app/org/events/new', available: true, icon: '✨' },
        { label: 'Programme Dashboard', href: '/app/org/dashboard', available: true, icon: '📊' },
        { label: 'Programme Events', href: '/app/org/events', available: true, icon: '📋' },
        // The older "New Batch" flow is hidden from menus; new programmes use the
        // Council-programme wizard. Existing batches stay reachable from the overview.
        ...(ROI_CALCULATOR_ENABLED ? [{ label: 'ROI Calculator', href: '/app/org/roi', available: true }] : []),
        { label: 'Analytics', available: false },
        { label: 'Billing', available: false },
      ],
    },
  ],
  coordinator: [
    {
      title: null,
      items: [
        // City Coordinator tools are temporarily deactivated (Phase 1) — their pages redirect to /app.
        COMMON_TOP,
        { label: 'Teacher Pulse', href: '/app/pulse', available: true },
      ],
    },
  ],
  council: [
    {
      title: null,
      items: [
        COMMON_TOP,
        { label: 'Interview Queue', href: '/app/council/interviews', available: true },
        { label: 'Trust Review', href: '/app/council/trust-review', available: true },
        { label: 'Empanelment Decisions', href: '/app/council/empanelment-decisions', available: true },
        { label: 'Institutional Programmes', href: '/app/council/institutional', available: true, icon: '🏢' },
        { label: 'Vouch Lineage', href: '/app/council/vouch', available: true },
        { label: 'My Contribution', href: '/app/council/contribution', available: true },
        { label: 'Editorial Picks', href: '/app/council/editorial', available: true },
        { label: 'Guru Nominations', href: '/app/nominations', available: true, icon: '📜' },
        { label: 'Teacher Pulse', href: '/app/pulse', available: true },
        { label: 'Venue Studio', href: '/app/venue', available: true },
        { label: 'My Spaces', href: '/app/spaces', available: true },
        { label: 'Space Enquiries', href: '/app/spaces/enquiries', available: true },
        { label: 'Enquiries Received', href: '/app/spaces/incoming', available: true },
        { label: 'Mentees', available: false },
        { label: 'Retreats', available: false },
      ],
    },
  ],
  admin: [
    {
      title: null,
      items: [{ label: 'Admin Dashboard', href: '/app/admin', available: true, icon: '🏠' }],
    },
    {
      title: 'Operations',
      items: [
        { label: 'KYC', href: '/app/admin/kyc', available: true, icon: '🛡️' },
        { label: 'Video Reviews', href: '/app/admin/video-reviews', available: true, icon: '🎬' },
        { label: 'Empanelment', href: '/app/admin/empanelment', available: true, icon: '🎖️' },
        { label: 'Fast-Track', href: '/app/admin/empanelment/fast-track', available: true, icon: '⚡' },
        { label: 'Empanelment Decisions', href: '/app/admin/empanelment/decisions', available: true, icon: '🏅' },
        { label: 'Empanelment Compliance', href: '/app/admin/empanelment/compliance', available: true, icon: '📋' },
        { label: 'Trust Review', href: '/app/admin/trust-review', available: true, icon: '⚖️' },
        { label: 'People', href: '/app/admin/people', available: true, icon: '👥' },
        { label: 'Recent Joins', href: '/app/admin/recent-joins', available: true, icon: '🆕' },
        { label: 'Leadership', href: '/app/admin/leadership', available: true, icon: '🚀' },
        { label: 'Teacher Discovery', href: '/app/admin/discovery', available: true, icon: '🧭' },
      ],
    },
    {
      title: 'Money & Growth',
      items: [
        { label: 'Payouts', href: '/app/admin/payouts', available: true, icon: '💸' },
        { label: 'Bookings', href: '/app/admin/bookings', available: true, icon: '📅' },
        { label: '1:1 Sessions', href: '/app/admin/one-on-one', available: true, icon: '🧘‍♀️' },
        { label: 'Referrals', href: '/app/admin/referrals', available: true, icon: '🔗' },
        { label: 'Reports', href: '/app/admin/reports', available: true, icon: '📊' },
      ],
    },
    {
      title: 'Platform',
      items: [
        { label: 'Teachers', href: '/app/admin/teachers', available: true, icon: '🧘' },
        { label: 'Homepage & Listings', href: '/app/admin/listings', available: true, icon: '🏠' },
        { label: 'Onboarding Conversion', href: '/app/admin/onboarding-conversion', available: true, icon: '📈' },
        { label: 'Festive KYC Claims', href: '/app/admin/festive-kyc', available: true, icon: '🎁' },
        { label: 'Teacher Reconciliation', href: '/app/admin/teacher-reconciliation', available: true, icon: '🧮' },
        { label: 'Institutional', href: '/app/admin/institutional', available: true, icon: '🏢' },
        { label: 'Org Enquiries', href: '/app/admin/org-enquiries', available: true, icon: '📨' },
        { label: 'Voices', href: '/app/admin/voices', available: true, icon: '✍️' },
        { label: 'Intro Videos', href: '/app/admin/intro-videos', available: true, icon: '🎞️' },
        { label: 'Venue Submissions', href: '/app/admin/venue-review', available: true, icon: '📍' },
        { label: 'Venue Claims', href: '/app/admin/venue-claims', available: true, icon: '🔑' },
        { label: 'Venue Widgets', href: '/app/admin/venue-widgets', available: true, icon: '🧩' },
        { label: 'Venue Partners', href: '/app/admin/venue-partners', available: true, icon: '🤝' },
        { label: 'Spaces Verification', href: '/app/admin/spaces', available: true, icon: '🏡' },
        { label: 'Space Programme Registrations', href: '/app/admin/space-registrations', available: true, icon: '🧘' },
        { label: 'Community Partners', href: '/app/admin/community-partners', available: true, icon: '🤝' },
        { label: 'Spaces Localities', href: '/app/admin/spaces-localities', available: true, icon: '📮' },
        { label: 'Venue Monitor', href: '/app/admin/venue-monitor', available: true, icon: '🩺' },
        { label: 'Error Monitor', href: '/app/admin/error-monitor', available: true, icon: '🚨' },
        { label: 'Council', href: '/app/admin/council-roster', available: true, icon: '🏛️' },
        { label: 'Interviewers', href: '/app/admin/interviewers', available: true, icon: '🎤' },
        { label: 'Nominations', href: '/app/admin/nominations', available: true, icon: '📜' },
        { label: 'Beta Feedback', href: '/app/admin/beta-feedback', available: true, icon: '💬' },
        { label: 'Support Requests', href: '/app/admin/support', available: true, icon: '🛟' },
        { label: 'Broadcast', href: '/app/admin/broadcast', available: true, icon: '📣' },
        { label: 'Audit Trail', href: '/app/admin/audit-log', available: true, icon: '🧾' },
      ],
    },
    {
      title: 'Community',
      items: [
        { label: 'Teacher Pulse', href: '/app/admin/pulse', available: true, icon: '💗' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Admin Profile', href: '/app/settings', available: true, icon: '⚙️' },
        { label: 'Security / 2FA', href: '/app/admin/security', available: true, icon: '🔐' },
      ],
    },
  ],
};

export function navSectionsFor(role: AppRole): NavSection[] {
  const base = NAV_SECTIONS_BY_ROLE[role] ?? NAV_SECTIONS_BY_ROLE.learner;
  return [...base];
}

/** Flat list of items across all sections — used to derive the search "Pages" set. */
export function flattenNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items);
}

// Nav label → central feature key (lib/teacher-access). Lock/hide is derived from
// canAccessFeature() so the MENU, the PAGE guard and the API guard all agree — one
// authoritative eligibility system, no duplicated per-label rules. Navigation
// visibility is UX only; server-side authorization at each route/data boundary
// remains mandatory.
const NAV_FEATURE: Record<string, TeacherFeature> = {
  Offerings: 'offerings',
  Bookings: 'bookings',
  Sessions: 'sessions',
  'My Widgets': 'widgets',
  Wallet: 'wallet',
  'Refer & Earn': 'refer',
  'City Coordinator': 'coordinator',
  'Coordinator Agreement': 'coordinator',
  'Venue Studio': 'venue_studio',
};
// Features that HIDE (rather than render a locked/disabled row) when denied.
const NAV_HIDE_WHEN_DENIED = new Set<string>(['Venue Studio']);

// Builds the final teacher navigation from the SAME AccessContext used by the page
// and API guards: injects the dynamic Public Profile link (or hides it
// pre-onboarding), drops the one-time Onboarding step once onboarded, and locks/
// hides every gated feature via canAccessFeature — so a status change (level,
// empanelment, verification) is reflected in the menu on the next request.
export function buildTeacherNav(sections: NavSection[], ctx: AccessContext, opts: { handle?: string | null; publicVisible?: boolean; kycComplete?: boolean; empanelled?: boolean; isAuthor?: boolean }): NavSection[] {
  return sections
    .map((section) => {
      // Once verification AND empanelment are both complete, the "Get Verified"
      // onboarding section has served its purpose — drop it entirely so a fully
      // onboarded teacher isn't shown finished workflows. Routes + records remain.
      if (section.title === 'Get Verified' && opts.kycComplete && opts.empanelled) {
        return { title: section.title, items: [] as NavItem[] };
      }
      return {
        title: section.title,
        items: section.items.flatMap((it) => {
          // Onboarding is a one-time step; once done the page redirects to profile,
          // so hide it from the roadmap to avoid a confusing self-redirect.
          if (it.label === 'Onboarding' && ctx.onboarded) return [];
          // KYC is a one-time verification step. Once InstaKYC is complete, drop the
          // nav item so a verified teacher isn't repeatedly sent to "verify" — the
          // status stays visible on the dashboard access card, and the KYC record +
          // route remain intact for authorization, audit and admin.
          if (it.label === 'KYC' && opts.kycComplete) return [];
          // Empanelment is a one-time onboarding step — hide once empanelled (the
          // empanelment page + records remain for status, audit and admin).
          if (it.label === 'Empanelment' && opts.empanelled) return [];
          // "Write for NOSTOPS" appears only for teachers an admin has enabled
          // as a NOSTOPS Author.
          if (it.label === 'Write for NOSTOPS' && !opts.isAuthor) return [];
      // Public Profile: only show when the profile is actually live (handle +
      // publicly visible + not suspended) — never link to a 404 dead-end.
      if (it.label === PUBLIC_PROFILE_LABEL) {
        return opts.handle && opts.publicVisible ? [{ ...it, href: `/teachers/${opts.handle}` }] : [];
      }
      // Central eligibility: lock (or hide) any gated feature per canAccessFeature.
      const feature = NAV_FEATURE[it.label];
      if (feature && !canAccessFeature(ctx, feature).allowed) {
        return NAV_HIDE_WHEN_DENIED.has(it.label) ? [] : [{ ...it, available: false, lock: true }];
      }
      return [it];
        }),
      };
    })
    .filter((s) => s.items.length > 0);
}
