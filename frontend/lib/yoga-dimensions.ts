// The three NOSTOPS "solution matrices" a Yoga Seeker explores in a 1:1 session,
// each with an optional list of more specific sub-requirements. This module is
// the SINGLE source of truth for the taxonomy — an administrator can expand the
// matrices or sub-requirements (labels + keyword signals) here WITHOUT any
// frontend rewrite; every screen reads from these arrays. Language is
// supportive / wellbeing-oriented — NEVER a medical claim or treatment promise.
export type DimensionId = 'mind' | 'body' | 'special_needs';

export type SubReq = {
  id: string;
  dim: DimensionId;
  label: string;
  // Substrings matched (case-insensitive) against a teacher's specializations +
  // styles to boost ranking. An empty list means "any teacher in this matrix".
  keywords: string[];
};

export type DimensionMeta = {
  id: DimensionId;
  label: string; // "Yoga for the Mind"
  short: string; // "Mind"
  emoji: string;
  color: string; // established matrix accent (app is light-theme only)
  tagline: string;
  blurb: string;
  examples: string[];
  subs: SubReq[];
};

// Ordered Mind → Body → Special Needs (matches the pre-launch brief).
export const DIMENSIONS: DimensionMeta[] = [
  {
    id: 'mind',
    label: 'Yoga for the Mind',
    short: 'Mind',
    emoji: '🧠',
    color: '#1E3A8A',
    tagline: 'Meditation, breath & mental balance',
    blurb: 'Explore practices that support calm, focus and steadiness — especially for demanding, knowledge-work lifestyles.',
    examples: ['Stress', 'Anxiety', 'Sleep', 'Mental fatigue', 'Focus', 'Relaxation'],
    subs: [
      { id: 'stress', dim: 'mind', label: 'Stress', keywords: ['stress'] },
      { id: 'anxiety', dim: 'mind', label: 'Anxiety', keywords: ['anxiet'] },
      { id: 'sleep', dim: 'mind', label: 'Sleep', keywords: ['sleep', 'nidra', 'insomnia'] },
      { id: 'mental_fatigue', dim: 'mind', label: 'Mental fatigue', keywords: ['fatigue', 'burnout'] },
      { id: 'focus', dim: 'mind', label: 'Focus', keywords: ['focus', 'concentrat', 'mindful'] },
      { id: 'relaxation', dim: 'mind', label: 'Relaxation', keywords: ['relax', 'restorative', 'calm', 'yin'] },
    ],
  },
  {
    id: 'body',
    label: 'Yoga for the Body',
    short: 'Body',
    emoji: '💪',
    color: '#EF4444',
    tagline: 'Posture, mobility, flexibility & strength',
    blurb: 'Explore practices that support physical wellbeing — helpful for sedentary, desk-bound routines.',
    examples: ['Posture', 'Mobility', 'Flexibility', 'General wellbeing', 'Sedentary lifestyle'],
    subs: [
      { id: 'posture', dim: 'body', label: 'Posture', keywords: ['posture', 'alignment'] },
      { id: 'mobility', dim: 'body', label: 'Mobility', keywords: ['mobilit', 'movement'] },
      { id: 'flexibility', dim: 'body', label: 'Flexibility', keywords: ['flex', 'stretch'] },
      { id: 'wellbeing', dim: 'body', label: 'General wellbeing', keywords: ['wellbeing', 'fitness', 'general'] },
      { id: 'sedentary', dim: 'body', label: 'Sedentary lifestyle', keywords: ['sedentary', 'desk', 'corporate', 'exec'] },
    ],
  },
  {
    id: 'special_needs',
    label: 'Yoga for Special Needs',
    short: 'Special Needs',
    emoji: '❤️',
    color: '#0D9488',
    tagline: 'Adapted practice for physical limitations & functional needs',
    blurb: 'Adapted yoga for people whose physical limitations, functional needs or circumstances call for modified practice. Suitability depends on your situation — a yoga teacher does not replace your healthcare professional.',
    // Illustrative examples only — never diagnoses or automatic recommendations.
    examples: ['Neck or back pain', 'Cervical spondylosis', 'Shoulder pain', 'Frozen shoulder', 'Reduced mobility'],
    subs: [
      { id: 'back', dim: 'special_needs', label: 'Neck or back pain', keywords: ['back', 'neck', 'spine', 'lumbar'] },
      { id: 'cervical', dim: 'special_needs', label: 'Cervical spondylosis', keywords: ['cervical', 'spondyl'] },
      { id: 'shoulder', dim: 'special_needs', label: 'Shoulder pain', keywords: ['shoulder'] },
      { id: 'frozen_shoulder', dim: 'special_needs', label: 'Frozen shoulder', keywords: ['frozen'] },
      { id: 'reduced_mobility', dim: 'special_needs', label: 'Reduced mobility', keywords: ['mobilit', 'chair', 'gentle'] },
      { id: 'other', dim: 'special_needs', label: 'Other adapted needs', keywords: [] },
    ],
  },
];

export const DIMENSION_BY_ID: Record<DimensionId, DimensionMeta> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.id, d]),
) as Record<DimensionId, DimensionMeta>;

// Retired sub-requirement ids: no longer offered, but still resolvable so older
// saved selections / links keep their label.
const LEGACY_SUBS: SubReq[] = [
  { id: 'ankylosing', dim: 'special_needs', label: 'Ankylosing spondylitis', keywords: ['ankylos', 'spondyl'] },
];

export const SUB_BY_ID: Record<string, SubReq> = Object.fromEntries(
  [...DIMENSIONS.flatMap((d) => d.subs), ...LEGACY_SUBS].map((s) => [s.id, s]),
);

export function isDimensionId(v: string): v is DimensionId {
  return v === 'mind' || v === 'body' || v === 'special_needs';
}

/** Canonical key for a declared pathway ('Body', 'special-needs' → 'body',
 *  'special_needs'); anything that is not one of the three keys → null. */
export function toDimensionId(v: unknown): DimensionId | null {
  const k = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return isDimensionId(k) ? k : null;
}

// Keyword signals mapped from a teacher's specializations/styles to Mind and
// Body (a teacher may match both). SPECIAL NEEDS is NEVER derived from keywords
// (e.g. prenatal, PCOS, yin): it comes only from the teacher's explicitly
// declared pathway, and verified adaptive-practice competence is a separate,
// NOSTOPS-reviewed record (see the "Adaptive practice verified" badge).
const KEYWORDS: Record<Exclude<DimensionId, 'special_needs'>, string[]> = {
  mind: ['meditat', 'mindful', 'pranayam', 'breath', 'anxiet', 'stress', 'mental', 'nidra', 'silence', 'mantra', 'enquiry', 'contempl', 'calm', 'sleep'],
  body: ['hatha', 'ashtanga', 'iyengar', 'vinyasa', 'power', 'asana', 'posture', 'alignment', 'strength', 'mobilit', 'flex', 'tadasana', 'sarvangasana', 'matsyendrasana', 'viparita', 'surya', 'sun salut', 'movement', 'core', 'fitness', 'sport', 'anusara', 'kundalini', 'kriya'],
};

type TeacherLike = { specializations?: string[]; styles?: string[]; yogaDimensions?: string[] };

function hay(t: TeacherLike): string {
  return [...(t.specializations || []), ...(t.styles || [])].join(' ').toLowerCase();
}

export function dimensionsOf(t: TeacherLike): Set<DimensionId> {
  const out = new Set<DimensionId>();
  // Explicitly declared pathways (profile yoga_dimensions).
  for (const d of t.yogaDimensions || []) {
    const id = toDimensionId(d);
    if (id) out.add(id);
  }
  const h = hay(t);
  if (h.trim()) {
    (Object.keys(KEYWORDS) as (keyof typeof KEYWORDS)[]).forEach((dim) => {
      if (KEYWORDS[dim].some((k) => h.includes(k))) out.add(dim);
    });
  }
  return out;
}

export function teacherMatchesDimension(t: TeacherLike, dim: DimensionId): boolean {
  return dimensionsOf(t).has(dim);
}

export function teacherMatchesReq(t: TeacherLike, reqId: string): boolean {
  const sub = SUB_BY_ID[reqId];
  if (!sub) return false;
  // "Other" (no keywords) matches any teacher in the parent matrix. Special
  // Needs sub-requirements only ever rank teachers who declared that pathway.
  if (sub.keywords.length === 0 || sub.dim === 'special_needs') {
    if (!dimensionsOf(t).has(sub.dim)) return false;
    if (sub.keywords.length === 0) return true;
  }
  const h = hay(t);
  return sub.keywords.some((k) => h.includes(k));
}

// Relevance score used by Teacher Discovery: matrices weigh 2, specific
// sub-requirements weigh 1. Teachers matching MORE of the seeker's selections
// rank higher; teachers matching none of the selected matrices score 0 (they
// are filtered out separately, never demoted arbitrarily).
export function scoreTeacher(t: TeacherLike, dims: DimensionId[], reqs: string[]): number {
  const ds = dimensionsOf(t);
  let s = 0;
  for (const d of dims) if (ds.has(d)) s += 2;
  for (const r of reqs) if (teacherMatchesReq(t, r)) s += 1;
  return s;
}
