// Event page SEO + AI-search (AISO) helpers — pure, shared by the public event
// page, its Register page and the per-event share card. Every value is built
// from the event's real details; nothing is invented.
import type { Metadata } from 'next';
import { canonical } from '@/lib/site';
import { fitDescription } from '@/lib/seo';
import { weekdayList } from '@/lib/org/schedule';
import type { PublicEvent } from '@/lib/server/institutional';

const MAX_DESC = 300;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-11-18' → 'Wed, 18 Nov 2026' (calendar date, never shifts a day). */
function formatSessionDate(date: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime())) return date;
  return `${DAY_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const SCHEMA_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COHORT_KEYWORD: Record<string, string> = {
  COMPANY: 'corporate yoga programme',
  EDUCATIONAL_INSTITUTION: 'yoga for students',
  STARTUP_NETWORK: 'yoga for founders and startup teams',
};

function clampWords(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const i = cut.lastIndexOf(' ');
  return `${(i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

function isRecurring(ev: PublicEvent): boolean {
  return ev.schedule?.type === 'RECURRING' && Array.isArray(ev.sessions);
}

function absolute(src?: string | null): string | undefined {
  return src ? canonical(src) : undefined;
}

/** '10:00' → '10:00 AM' */
export function fmtTime(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Per-participant fee label ('₹500'), or null for free / unpriced events. */
export function eventFee(ev: PublicEvent): string | null {
  return ev.pricing_type === 'PAID' && typeof ev.participant_fee === 'number' && ev.participant_fee > 0
    ? `₹${Math.round(ev.participant_fee).toLocaleString('en-IN')}` : null;
}

/** 'Free to attend' · '₹500 per participant' · '₹500 per session' · 'By invitation'. */
export function eventPriceLabel(ev: PublicEvent): string {
  const fee = eventFee(ev);
  if (fee) return `${fee} per ${isRecurring(ev) ? 'session' : 'participant'}`;
  if (ev.registration_access === 'ORGANISATION_ONLY') return 'By invitation';
  return ev.is_free ? 'Free to attend' : 'See event page';
}

function timeRange(ev: PublicEvent): string {
  const t = [fmtTime(ev.start_time), fmtTime(ev.end_time)].filter(Boolean).join(' – ');
  return t && ev.timezone === 'Asia/Kolkata' ? `${t} IST` : t;
}

/** Full schedule line, e.g. 'Wed, 18 Nov 2026, 10:00 AM – 11:00 AM IST'. */
export function eventWhen(ev: PublicEvent): string {
  const time = timeRange(ev);
  if (isRecurring(ev)) {
    const days = ev.schedule?.weekdays?.length ? `Every ${weekdayList(ev.schedule.weekdays)}` : 'Repeating sessions';
    const range = ev.event_date
      ? `from ${formatSessionDate(ev.event_date)}${ev.last_session_date ? ` to ${formatSessionDate(ev.last_session_date)}` : ''}`
      : '';
    return [days, range, time].filter(Boolean).join(', ');
  }
  if (!ev.event_date) return 'Date to be announced';
  return [formatSessionDate(ev.event_date), time].filter(Boolean).join(', ');
}

/** Short schedule line for the share card, e.g. 'Wed, 18 Nov 2026 · 10:00 AM'. */
export function eventWhenShort(ev: PublicEvent): string {
  const start = fmtTime(ev.start_time);
  if (isRecurring(ev)) {
    const days = ev.schedule?.weekdays?.length ? `Every ${weekdayList(ev.schedule.weekdays)}` : 'Repeating programme';
    return [days, ev.event_date ? `from ${formatSessionDate(ev.event_date)}` : ''].filter(Boolean).join(' · ');
  }
  if (!ev.event_date) return 'Date to be announced';
  return [formatSessionDate(ev.event_date), start].filter(Boolean).join(' · ');
}

/** Meta / Open Graph description: the organiser's own text, else a sentence built from the event details. */
export function eventDescription(ev: PublicEvent): string {
  const demo = ev.demo ? 'Illustrative example: ' : '';
  const own = (ev.subtitle || '').trim();
  if (own) return clampWords(`${demo}${own}`, MAX_DESC);

  const p = ev.programme;
  const category = p?.taxonomy_label ? `${p.taxonomy_label} ` : '';
  const progName = p?.name && !ev.title.toLowerCase().includes(p.name.toLowerCase()) ? ` (${p.name})` : '';
  const host = ev.organisation?.name ? ` hosted by ${ev.organisation.name}` : '';
  const venueEndsWithCity = !!(ev.venue && ev.city && ev.venue.toLowerCase().endsWith(ev.city.toLowerCase()));
  const where = ev.venue
    ? ` at ${ev.venue}${ev.city && !venueEndsWithCity ? `, ${ev.city}` : ''}`
    : ev.city ? ` in ${ev.city}` : '';
  const when = eventWhen(ev);
  const lead = `${ev.title}: a Council-curated ${category}yoga programme${progName}${host}${where}. ${when}.`;
  const lang = ev.language ? `In ${ev.language}.` : '';
  const fee = eventFee(ev);
  const price = fee ? `${eventPriceLabel(ev)}.` : ev.is_free ? 'Free to attend.' : '';
  const cta = ev.registration_access === 'ORGANISATION_ONLY'
    ? 'Open to invited participants.'
    : ev.registration_open ? 'Register on NOSTOPS.' : '';
  return clampWords(`${demo}${[lead, lang, price, cta].filter(Boolean).join(' ')}`, MAX_DESC);
}

export function eventKeywords(ev: PublicEvent): string[] {
  const p = ev.programme;
  const list = [
    ev.title,
    p?.name,
    p?.taxonomy_label ? `${p.taxonomy_label} yoga` : null,
    ev.city ? `yoga in ${ev.city}` : null,
    ev.city ? `yoga programme ${ev.city}` : null,
    COHORT_KEYWORD[ev.cohort_type] || null,
    ev.organisation?.name,
    ev.language ? `yoga in ${ev.language}` : null,
    'Council-curated yoga programme',
    'NOSTOPS',
  ];
  return Array.from(new Set(list.filter(Boolean) as string[]));
}

/**
 * Title, description, keywords and social tags for an event page (or its
 * Register page, which shares the same preview). The share image comes from
 * the per-event opengraph-image / twitter-image files next to each page.
 */
export function eventMetadata(ev: PublicEvent, opts: { path: string; title: string; indexable: boolean }): Metadata {
  const ogTitle = `${ev.title} · NOSTOPS`;
  const description = fitDescription(eventDescription(ev));
  const url = canonical(opts.path);
  return {
    title: opts.title,
    description,
    keywords: eventKeywords(ev),
    category: 'Yoga',
    robots: { index: opts.indexable, follow: opts.indexable },
    alternates: opts.indexable ? { canonical: url } : undefined,
    openGraph: { title: ogTitle, description, url, type: 'website', siteName: 'NOSTOPS', locale: 'en_IN' },
    twitter: { card: 'summary_large_image', title: ogTitle, description },
    // Rich link unfurls (Slack, X): two labelled facts under the preview.
    other: {
      'twitter:label1': 'When',
      'twitter:data1': eventWhen(ev),
      'twitter:label2': 'Price',
      'twitter:data2': eventPriceLabel(ev),
    },
  };
}

// '+05:30' for a time zone on a given date ('' if unknown).
function tzOffset(tz: string, date: string): string {
  try {
    const v = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(new Date(`${date}T12:00:00Z`))
      .find((x) => x.type === 'timeZoneName')?.value || '';
    if (v === 'GMT') return '+00:00';
    return /GMT([+-]\d{2}:\d{2})/.exec(v)?.[1] || '';
  } catch {
    return '';
  }
}

function isoAt(date?: string | null, time?: string | null, tz?: string | null): string | undefined {
  if (!date) return undefined;
  if (!time) return date;
  return `${date}T${time}:00${tz ? tzOffset(tz, date) : ''}`;
}

/** schema.org EducationEvent for search engines and AI answer engines. */
export function buildEventJsonLd(ev: PublicEvent, opts: { url: string; image: string }) {
  const recurring = isRecurring(ev);
  const tz = ev.timezone;
  const p = ev.programme;
  const org = ev.organisation;
  const feeNum = eventFee(ev) ? Math.round(ev.participant_fee as number) : 0;
  const teacherOk = !ev.demo && !!ev.teacher_verified && !!ev.teacher?.name;
  const status = 'https://schema.org/EventScheduled';
  const mode = 'https://schema.org/OfflineEventAttendanceMode';
  const location = (ev.venue || ev.city) ? {
    '@type': 'Place',
    name: ev.venue || ev.city,
    address: { '@type': 'PostalAddress', addressLocality: ev.city || undefined, addressCountry: 'IN' },
  } : undefined;
  const availability = ev.is_full
    ? 'https://schema.org/SoldOut'
    : ev.registration_open ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

  return {
    '@context': 'https://schema.org',
    '@type': 'EducationEvent',
    '@id': `${opts.url}#event`,
    name: ev.title,
    description: eventDescription(ev),
    url: opts.url,
    image: [opts.image],
    startDate: isoAt(ev.event_date, ev.start_time, tz),
    endDate: isoAt(recurring ? (ev.last_session_date || ev.event_date) : ev.event_date, ev.end_time, tz),
    eventStatus: status,
    eventAttendanceMode: mode,
    inLanguage: ev.language || undefined,
    location,
    organizer: org ? { '@type': 'Organization', name: org.name, url: opts.url, logo: absolute(org.logo_url) } : undefined,
    performer: teacherOk ? {
      '@type': 'Person',
      name: ev.teacher!.name,
      url: ev.teacher!.handle ? canonical(`/teachers/${ev.teacher!.handle}`) : undefined,
    } : undefined,
    // Phase 5B — NOSTOPS Spaces programmes take no registrations or payments: no Offer is advertised.
    offers: ev.host_kind === 'SPACE' ? undefined : {
      '@type': 'Offer',
      url: canonical(`/events/${ev.slug}/register`),
      price: String(feeNum),
      priceCurrency: 'INR',
      availability,
      validFrom: ev.published_at || undefined,
      validThrough: ev.registration_closing_date || undefined,
    },
    isAccessibleForFree: !!ev.is_free,
    maximumAttendeeCapacity: ev.capacity || undefined,
    remainingAttendeeCapacity: typeof ev.seats_remaining === 'number' ? ev.seats_remaining : undefined,
    educationalLevel: p?.level || undefined,
    teaches: p?.objectives?.length ? p.objectives : undefined,
    audience: p?.recommended_audience?.length
      ? { '@type': 'Audience', audienceType: p.recommended_audience.join(', ') } : undefined,
    about: p?.name ? { '@type': 'Thing', name: p.name, description: p.essence || undefined } : undefined,
    keywords: eventKeywords(ev).join(', '),
    eventSchedule: recurring && ev.schedule ? {
      '@type': 'Schedule',
      startDate: ev.event_date || undefined,
      endDate: ev.last_session_date || ev.schedule.end_date || undefined,
      repeatFrequency: 'P1W',
      byDay: (ev.schedule.weekdays || []).map((d) => `https://schema.org/${SCHEMA_DAYS[d]}`),
      startTime: ev.start_time ? `${ev.start_time}:00` : undefined,
      endTime: ev.end_time ? `${ev.end_time}:00` : undefined,
      scheduleTimezone: tz || undefined,
    } : undefined,
    subEvent: recurring
      ? (ev.sessions || []).filter((s) => !s.is_past).slice(0, 12).map((s) => ({
        '@type': 'EducationEvent',
        name: `${ev.title} — Session ${s.seq}`,
        startDate: isoAt(s.date, ev.start_time, tz),
        endDate: isoAt(s.date, ev.end_time, tz),
        eventStatus: status,
        eventAttendanceMode: mode,
        location,
        url: `${opts.url}#sessions`,
      }))
      : undefined,
  };
}
