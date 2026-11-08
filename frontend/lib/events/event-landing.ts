// Event page content (founder-approved event page layout). Facts always come
// from the event record; per-event copy overrides only supply framing text
// (headline, benefit cards, audience) and must stay consistent with the record
// and free of clinical / guaranteed-outcome claims.
import type { PublicEvent } from '@/lib/server/institutional';
import type { CohortKey } from '@/lib/org/cohort-copy';
import { COHORT_LANDING } from '@/lib/org/cohort-landing';
import type { IconKey } from '@/components/ui/LineIcon';
import { AIM_LINES } from '@/lib/events/aim-lines';

export type EventBenefit = { icon: IconKey; title: string; text?: string; label?: string };
export type EventCopy = {
  eyebrow: string;
  heading: string;
  tagline?: string | null;
  intro?: string | null;
  tags: string[];
  valueHeading: string;
  valueText: string;
  benefits: EventBenefit[];
  about: string;
  audience: { icon: IconKey; text: string }[];
  pastNote: string;
  heroImg: string;
  heroAlt: string;
};

const OVERRIDES: Record<string, Partial<EventCopy>> = {
  // Founder-provided reference page (STARTUP_NETWORK demonstration event).
  'yoga-for-stress-resilience-founders-circle-mumbai': {
    eyebrow: 'Founders Circle',
    tagline: 'A shared pause for the people building what comes next.',
    intro:
      'A teacher-led, experiential session designed for startup founders, co-founders and early-stage leaders to ease everyday stress, regain focus and reconnect with what matters.',
    tags: ['Mind', 'Stress Relief', 'Focus', 'Community'],
    valueHeading: 'You don’t have to build through stress alone.',
    valueText:
      'Founders face unique pressures — constant decisions, uncertainty and long hours. This session offers a teacher-led space to pause, breathe and build resilience together.',
    benefits: [
      { icon: 'wind', title: 'Pause & breathe', text: 'Guided practices to help participants slow down, breathe mindfully and create space for calm.' },
      { icon: 'move', title: 'Move with care', text: 'Gentle yoga practices to support movement, body awareness and relaxation.' },
      { icon: 'teacher', title: 'Reconnect as a community', text: 'Share a practice with fellow founders in a welcoming, supportive environment.' },
    ],
    about:
      'Led by a NOSTOPS teacher, this session blends breathwork, mindful movement and simple, practical tools participants can carry into daily life.',
    audience: [
      { icon: 'rocket', text: 'Startup founders and co-founders' },
      { icon: 'teacher', text: 'Early-stage leadership teams' },
      { icon: 'user', text: 'Core team members of the Circle’s startups' },
      { icon: 'building', text: 'Members of startup and networking groups' },
    ],
    pastNote: 'Explore upcoming events and similar programmes for founders and organisations.',
    heroImg: '/brand/events/founders-hero.jpg',
    heroAlt: 'Illustrative photo: a yoga teacher guides a small group of founders seated on mats in a calm, plant-filled studio',
  },
};

function cohortImage(ev: PublicEvent): { img: string; alt: string } {
  const cohort = COHORT_LANDING[ev.cohort_type as CohortKey] || COHORT_LANDING.COMPANY;
  const pw = cohort.pathways.find((p) => p.key === ev.programme?.taxonomy) || cohort.pathways[0];
  return { img: pw.img, alt: `Illustrative photo: ${pw.alt.charAt(0).toLowerCase()}${pw.alt.slice(1)}` };
}

function genericCopy(ev: PublicEvent): EventCopy {
  const p = ev.programme;
  const org = ev.organisation;
  const label = p?.taxonomy_label || 'Yoga';
  const audience: EventCopy['audience'] = (p?.recommended_audience || []).map((a, i) => ({
    icon: (['teacher', 'user', 'building'] as const)[i % 3],
    text: a,
  }));
  if (ev.registration_access === 'ORGANISATION_ONLY' && org) audience.unshift({ icon: 'building', text: `Members of ${org.name}` });
  const img = cohortImage(ev);
  return {
    eyebrow: org?.name || 'NOSTOPS event',
    heading: p?.name || ev.title,
    tagline: p?.essence,
    intro: ev.subtitle,
    tags: [label, p?.level, ev.language].filter(Boolean) as string[],
    valueHeading: `What this ${label} programme supports`,
    valueText: `A Council-curated ${label} programme, delivered as a teacher-led group session${org ? ` for ${org.name}` : ''}. Its stated aims:`,
    benefits: (p?.objectives || []).slice(0, 3).map((o, i) => ({
      icon: (['wind', 'move', 'teacher'] as const)[i],
      title: o,
      text: AIM_LINES[o] || p?.essence || undefined,
      label: 'Programme aim',
    })),
    about: `${ev.duration_minutes ? `A ${ev.duration_minutes}-minute` : 'A'} teacher-led group session of the Council-curated ${label} programme “${p?.name || ev.title}”. ${p?.essence || ''}`.trim(),
    audience,
    pastNote: 'Explore upcoming events and similar programmes for organisations.',
    heroImg: img.img,
    heroAlt: img.alt,
  };
}

export function eventCopy(ev: PublicEvent): EventCopy {
  return { ...genericCopy(ev), ...OVERRIDES[ev.slug] };
}

/** Today's date in India (YYYY-MM-DD) — event dates are local calendar dates. */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** True once the event (or a repeating programme's last session) is over. */
export function eventIsPast(ev: PublicEvent, today = todayIST()): boolean {
  const lc = ev.lifecycle_effective || ev.lifecycle;
  if (lc === 'COMPLETED' || lc === 'ARCHIVED') return true;
  if (lc === 'EVERGREEN' || lc === 'LIVE') return false;
  if (ev.schedule?.type === 'RECURRING' && Array.isArray(ev.sessions)) {
    if (ev.sessions.some((s) => !s.is_past)) return false;
    const last = ev.last_session_date || ev.event_date;
    return !!last && last < today;
  }
  return !!ev.event_date && ev.event_date < today;
}

function to12h(t: string): { time: string; mer: string } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  return { time: `${h % 12 || 12}:${m[2]}`, mer: h < 12 ? 'AM' : 'PM' };
}

/** '7:30 – 8:30 AM (IST)' — omitted parts stay omitted. */
export function eventTimeLabel(ev: PublicEvent): string {
  const a = ev.start_time ? to12h(ev.start_time) : null;
  const b = ev.end_time ? to12h(ev.end_time) : null;
  if (!a) return '';
  const range = b ? (a.mer === b.mer ? `${a.time} – ${b.time} ${b.mer}` : `${a.time} ${a.mer} – ${b.time} ${b.mer}`) : `${a.time} ${a.mer}`;
  const tz = ev.timezone === 'Asia/Kolkata' ? 'IST' : ev.timezone?.replace(/_/g, ' ');
  return tz ? `${range} (${tz})` : range;
}

/** 'Sun, 11 Oct 2026' */
export function eventDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace(/^(\w+) /, '$1, ');
}
