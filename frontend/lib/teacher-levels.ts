// SINGLE SOURCE OF TRUTH for the Yoga Teacher LEVEL model (L1/L2/L3) and the
// privileges each level unlocks. A teacher's level comes from the backend
// `tier` field (or, as a fallback, the primary badge label). Every surface —
// the dashboard progression card, retreat/venue host tooling, profile badges —
// derives its level, label, colour and "what you unlock" copy from THIS map so
// they never drift apart.
//
// NOTE ON GATING: the runtime gate for retreat/venue hosting stays
// backend-authoritative (`GET /retreats/host-eligibility`). This map is the
// canonical *catalogue* of level privileges (L2+ may host); the backend remains
// the final authority on whether a specific teacher is host-eligible today.
// See BUSINESS_LOGIC.md §6.

export type TeacherLevel = 1 | 2 | 3;

// Programmatic privilege flags per level (the "can they do X" catalogue).
export type LevelPrivileges = {
  verifiedProfile: boolean; // listed as a verified teacher
  discoverable: boolean; // appears in public directory / search
  groupClasses: boolean; // run group sessions
  oneOnOne: boolean; // paid 1:1 offering (once verified)
  corporatePrograms: boolean; // receive corporate / organisation leads
  retreatHosting: boolean; // host retreats (backend host-eligibility is final)
  venueStudio: boolean; // access the Venue Studio tooling
  premiumPricing: boolean; // premium pricing tiers
  platformCourses: boolean; // platform-backed courses / thought leadership
};

export type LevelMeta = {
  level: TeacherLevel;
  tierKeys: string[]; // backend `tier` values that map to this level
  badgeLabel: string; // primary badge, e.g. 'Yoga Shikshak' (also the BADGE_COLORS key)
  levelLabel: string; // 'Level 1'
  name: string; // 'Certified Yoga Instructor'
  sub: string; // 'Foundation Level'
  fullLabel: string; // 'Yoga Shikshak · Level 1'
  color: string; // brand colour used across cards / badges
  unlocks: string[]; // human-readable list shown on the dashboard
  headline: { perk: string; blurb: string }; // the single marquee perk for the "next-level teaser"
  privileges: LevelPrivileges;
  whoFor: string; // "Who it's for" — Progression Path copy
  unlocksDetailed: string[]; // "What you unlock" — full Progression Path bullets
  nextStep: string; // "Next step" — Progression Path copy
};

const P = (over: Partial<LevelPrivileges>): LevelPrivileges => ({
  verifiedProfile: true,
  discoverable: true,
  groupClasses: true,
  oneOnOne: true,
  corporatePrograms: false,
  retreatHosting: false,
  venueStudio: false,
  premiumPricing: false,
  platformCourses: false,
  ...over,
});

// Ordered L1 → L3. This is the ONE place the level ladder is defined.
export const TEACHER_LEVELS: Record<TeacherLevel, LevelMeta> = {
  1: {
    level: 1,
    tierKeys: ['shikshak'],
    badgeLabel: 'Yoga Shikshak',
    levelLabel: 'Level 1',
    name: 'Certified Yoga Instructor',
    sub: 'Foundation Level',
    fullLabel: 'Yoga Shikshak · Level 1',
    color: '#0D9488',
    unlocks: ['Verified profile', 'Discoverability', 'Group sessions', 'Basic earnings'],
    headline: { perk: 'Group sessions & 1:1', blurb: 'Teach and earn as a verified instructor.' },
    privileges: P({}),
    whoFor: 'For teachers beginning their professional journey on NOSTOPS.',
    unlocksDetailed: [
      'Verified NOSTOPS profile',
      'Discoverability on the platform',
      'Eligibility to conduct live classes and group sessions',
      'Entry-level pricing bands',
      'Access to basic earning opportunities',
    ],
    nextStep: 'Build consistency, gain student feedback, and deliver sessions that reflect authentic practice.',
  },
  2: {
    level: 2,
    tierKeys: ['pracharak'],
    badgeLabel: 'Yoga Pracharak',
    levelLabel: 'Level 2',
    name: 'Accredited Yoga Teacher',
    sub: 'Growth Level',
    fullLabel: 'Yoga Pracharak · Level 2',
    color: '#0EA5E9',
    unlocks: ['Higher search visibility', 'Corporate leads', 'Reviews & testimonials', 'Retreat & venue hosting'],
    headline: { perk: 'Retreat & venue hosting', blurb: 'Host paid retreats and list your own venues.' },
    privileges: P({ corporatePrograms: true, retreatHosting: true, venueStudio: true }),
    whoFor: 'For teachers building consistency, student trust, and signature content.',
    unlocksDetailed: [
      'Higher search visibility',
      'Ability to create and sell structured courses',
      'Access to corporate and institutional leads',
      'Verified reviews and testimonials',
      'Priority onboarding for new initiatives',
    ],
    nextStep: 'Develop specialised programmes, grow student cohorts, and cultivate professional reputation.',
  },
  3: {
    level: 3,
    tierKeys: ['guru', 'council_guru'],
    badgeLabel: 'Yoga Guru',
    levelLabel: 'Level 3',
    name: 'Yoga Master (Yoga Guru)',
    sub: 'Leadership Level',
    fullLabel: 'Yoga Guru · Level 3',
    color: '#0F766E',
    unlocks: ['Premium pricing', 'Platform-backed courses', 'Thought leadership', 'Strategic partnerships'],
    headline: { perk: 'Premium pricing', blurb: 'Command premium rates and lead platform-backed courses.' },
    privileges: P({ corporatePrograms: true, retreatHosting: true, venueStudio: true, premiumPricing: true, platformCourses: true }),
    whoFor: 'For teachers shaping thought, lineage, and large-scale impact.',
    unlocksDetailed: [
      'Premium pricing eligibility',
      'Platform-backed course production and promotion',
      'Thought leadership opportunities (blogs, talks, features)',
      'Invitations to curated cohorts, retreats, and certifications',
      'Strategic partnership opportunities with NOSTOPS',
    ],
    nextStep: 'Mentor the next generation of teachers, contribute to Council decisions, and lead flagship initiatives.',
  },
};

// ── Progression Path page content (mirrors the mobile "Progression Path" screen) ──
export const PROGRESSION_INTRO = {
  eyebrow: '3 Levels of Yoga Teachers',
  headline: 'A merit-based progression system',
  blurb:
    'NOSTOPS offers a transparent 3-level progression path that reflects both experience and contribution — not gatekeeping. You advance on real signals, not connections.',
};

// "Progression is based on transparent criteria"
export const PROGRESSION_CRITERIA: string[] = [
  'Teaching hours on the platform',
  'Student outcomes and retention',
  'Content quality and course reviews',
  'Community contribution and mentorship',
];

export const NOSTOPS_PROMISE =
  'Helping yoga teachers earn consistently and grow professionally, while retaining autonomy and respect.';

export const EMPANELLED_TEACHER = {
  title: 'Empanelled Teacher',
  blurb: 'Top-tier Council verification for senior teachers — no platform fee, corporate access, and a trusted network.',
};

export const LEVELS_ORDERED: LevelMeta[] = [TEACHER_LEVELS[1], TEACHER_LEVELS[2], TEACHER_LEVELS[3]];

// council_guru is Level 3 but carries its own display label.
const SPECIAL_TIER_LABEL: Record<string, string> = { council_guru: 'Council Guru' };

const norm = (v?: string | null): string => String(v || '').trim().toLowerCase();

/** Backend `tier` string → level (null when the tier is unknown/absent). */
export function tierToLevel(tier?: string | null): TeacherLevel | null {
  const t = norm(tier);
  if (!t) return null;
  for (const meta of LEVELS_ORDERED) if (meta.tierKeys.includes(t)) return meta.level;
  return null;
}

/** Primary badge label ('Yoga Shikshak' …) → level (fallback when no tier). */
export function badgeToLevel(badge?: string | null): TeacherLevel | null {
  const b = norm(badge);
  if (!b) return null;
  for (const meta of LEVELS_ORDERED) if (norm(meta.badgeLabel) === b) return meta.level;
  return null;
}

/** Canonical level derivation for a teacher. Prefers `tier`, falls back to the
 *  badge, and defaults a registered teacher to Level 1 (Shikshak). */
export function getTeacherLevel(input?: { tier?: string | null; badgePrimary?: string | null } | null): TeacherLevel {
  if (!input) return 1;
  return tierToLevel(input.tier) ?? badgeToLevel(input.badgePrimary) ?? 1;
}

export function levelMeta(level: TeacherLevel): LevelMeta {
  return TEACHER_LEVELS[level];
}

/** Full display label for a backend tier ('Council Guru' special-cased). */
export function tierLabel(tier?: string | null): string | null {
  const t = norm(tier);
  if (!t) return null;
  if (SPECIAL_TIER_LABEL[t]) return SPECIAL_TIER_LABEL[t];
  const lvl = tierToLevel(t);
  return lvl ? TEACHER_LEVELS[lvl].fullLabel : null;
}

/** Brand colour for a badge label (used by the dashboard header + cards). */
export function badgeColor(badge?: string | null): string {
  const lvl = badgeToLevel(badge);
  return lvl ? TEACHER_LEVELS[lvl].color : '#64748B';
}

export function privilegesForLevel(level: TeacherLevel): LevelPrivileges {
  return TEACHER_LEVELS[level].privileges;
}

/** Does a level unlock a given privilege? */
export function levelHasPrivilege(level: TeacherLevel, key: keyof LevelPrivileges): boolean {
  return TEACHER_LEVELS[level].privileges[key];
}
