// Shared, pure helpers for structured retreat content that lives inside the
// backend's free-text `description` (the backend has no dedicated itinerary /
// extended-pricing fields, and is read-only). These serialize (wizard) and
// parse (public page) a compact, human-readable + machine-readable format.
// PURE functions only — safe to import from client and server.

// PROMPT 20 — Minimum Confirmed Cohort safeguard (min/max/deadline + shortfall policy).
export type MinCohortInfo = { min?: number; max?: number; deadline?: string; policy?: string };

export type ItineraryCategory = 'yoga' | 'pranayama' | 'meditation' | 'meals' | 'excursion' | 'satsang' | 'rest' | 'free';

export const ITINERARY_CATEGORIES: { key: ItineraryCategory; label: string; icon: string }[] = [
  { key: 'yoga', label: 'Yoga', icon: '🧘' },
  { key: 'pranayama', label: 'Pranayama', icon: '🌬️' },
  { key: 'meditation', label: 'Meditation', icon: '🕉️' },
  { key: 'meals', label: 'Meals', icon: '🍲' },
  { key: 'excursion', label: 'Excursion', icon: '🥾' },
  { key: 'satsang', label: 'Satsang', icon: '📿' },
  { key: 'rest', label: 'Rest', icon: '😴' },
  { key: 'free', label: 'Free time', icon: '✨' },
];

const LABEL_TO_KEY = new Map<string, ItineraryCategory>(ITINERARY_CATEGORIES.map((c) => [c.label.toLowerCase(), c.key]));
export function categoryMeta(key?: string) {
  return ITINERARY_CATEGORIES.find((c) => c.key === key);
}

export type ItineraryItem = {
  day?: number;
  time?: string; // HH:MM
  durationMin?: number;
  category?: ItineraryCategory;
  activity: string;
  leader?: string;
};

const num = (v: string) => {
  const n = parseInt(v.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

// Serialize one item -> "Day 1 · 06:30 · 60m · Pranayama — Sunrise breathwork · with Anjali"
export function serializeItineraryItem(it: ItineraryItem): string {
  const parts: string[] = [];
  if (typeof it.day === 'number') parts.push(`Day ${it.day}`);
  if (it.time && /^\d{1,2}:\d{2}$/.test(it.time)) parts.push(it.time);
  if (typeof it.durationMin === 'number' && it.durationMin > 0) parts.push(`${it.durationMin}m`);
  const label = it.category ? categoryMeta(it.category)?.label : undefined;
  const activity = (it.activity || '').trim();
  parts.push(label ? `${label} — ${activity}` : activity);
  if (it.leader && it.leader.trim()) parts.push(`with ${it.leader.trim()}`);
  return parts.join(' · ');
}

export function serializeItinerary(items: ItineraryItem[]): string {
  return items.filter((i) => (i.activity || '').trim()).map(serializeItineraryItem).join('\n');
}

// Parse one itinerary line (structured OR legacy freeform "Day 1 — Arrival …").
export function parseItineraryLine(line: string): ItineraryItem | null {
  const raw = line.trim().replace(/^[-•]\s*/, '');
  if (!raw) return null;
  const tokens = raw.split('·').map((t) => t.trim()).filter(Boolean);
  const item: ItineraryItem = { activity: '' };
  const leftover: string[] = [];

  for (const tok of tokens) {
    const dayM = /^Day\s*(\d+)$/i.exec(tok);
    if (dayM) { item.day = num(dayM[1]); continue; }
    if (/^\d{1,2}:\d{2}$/.test(tok)) { item.time = tok; continue; }
    const durM = /^(\d+)\s*m(in)?$/i.exec(tok);
    if (durM) { item.durationMin = num(durM[1]); continue; }
    const withM = /^with\s+(.+)$/i.exec(tok);
    if (withM) { item.leader = withM[1].trim(); continue; }
    leftover.push(tok);
  }

  let body = leftover.join(' · ').trim();
  // Legacy freeform: "Day 1 — Arrival, opening circle"
  if (!item.day) {
    const legacy = /^Day\s*(\d+)\s*[—–-]\s*(.+)$/i.exec(body);
    if (legacy) { item.day = num(legacy[1]); body = legacy[2].trim(); }
  }
  // Category — activity
  const emDash = body.split(/\s*[—–]\s*/);
  if (emDash.length >= 2) {
    const maybe = emDash[0].trim().toLowerCase();
    if (LABEL_TO_KEY.has(maybe)) { item.category = LABEL_TO_KEY.get(maybe); item.activity = emDash.slice(1).join(' — ').trim(); }
    else item.activity = body;
  } else {
    item.activity = body;
  }
  if (!item.activity) return null;
  return item;
}

export function parseItinerary(block: string): ItineraryItem[] {
  return block.split('\n').map(parseItineraryLine).filter((x): x is ItineraryItem => x !== null);
}

export type ParsedRetreatContent = {
  intro: string;
  itinerary: ItineraryItem[];
  carryHome?: string;
  yogaSeKyaHoga?: string;
  stay?: string;
  food?: string;
  notIncluded: string[];
  cancellation?: string;
  minCohort?: number;
  minCohortInfo?: MinCohortInfo;
  taxNote?: string;
  groupNote?: string;
};

const SECTION_HEADS: Record<string, keyof ParsedRetreatContent | 'carryHome' | 'notIncluded' | 'cancellation' | 'groupNote' | 'itinerary' | 'yogaSeKyaHoga' | 'stay' | 'food'> = {
  'daily rhythm': 'itinerary',
  'what you carry home': 'carryHome',
  'yoga se kya hoga': 'yogaSeKyaHoga',
  'your stay': 'stay',
  'food and meals': 'food',
  'not included': 'notIncluded',
  'cancellation policy': 'cancellation',
  'group bookings': 'groupNote',
};
const money = (v: string): number | undefined => {
  const n = parseInt(v.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

export function parseRetreatContent(description?: string | null): ParsedRetreatContent {
  const out: ParsedRetreatContent = { intro: '', itinerary: [], notIncluded: [] };
  if (!description) return out;
  const blocks = description.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const introParts: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const head = lines[0].trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    // Single-line priced notes. Prompt 3C (founder option B): early-bird, limited-time and
    // teacher-cohort offers written in the description are UNVERIFIED, so they are consumed
    // here (kept out of the intro text) and never shown, and no saving is worked out from them.
    if (/^(Early bird|Limited-time|Cohort price):/i.test(block) || /^Cohort benefit/i.test(block) || /\[cb:[ABCD]/i.test(block)) continue;
    const mcc = /\[mcc:([^\]]*)\]/i.exec(block);
    if (/^This retreat runs with a minimum of/i.test(block) || /^Confirmed cohort capacity/i.test(block) || mcc) {
      if (mcc) {
        const info: MinCohortInfo = {};
        for (const kv of mcc[1].split(';')) {
          const [k, v] = kv.split('=');
          if (k === 'min') info.min = parseInt(v, 10) || undefined;
          else if (k === 'max') info.max = parseInt(v, 10) || undefined;
          else if (k === 'deadline') info.deadline = v;
          else if (k === 'policy') info.policy = v;
        }
        out.minCohortInfo = info;
        if (info.min) out.minCohort = info.min;
      } else {
        const mm = /minimum of\s*(\d+)/i.exec(block);
        if (mm) { out.minCohort = money(mm[1]); out.minCohortInfo = { min: out.minCohort }; }
      }
      continue;
    }
    const tx = /^Taxes:\s*(.+)$/is.exec(block);
    if (tx) { out.taxNote = tx[1].trim(); continue; }

    if (head in SECTION_HEADS) {
      const target = SECTION_HEADS[head];
      if (target === 'itinerary') out.itinerary = parseItinerary(body);
      else if (target === 'notIncluded') out.notIncluded = body.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      else if (target === 'carryHome') out.carryHome = body;
      else if (target === 'yogaSeKyaHoga') out.yogaSeKyaHoga = body;
      else if (target === 'stay') out.stay = body;
      else if (target === 'food') out.food = body;
      else if (target === 'cancellation') out.cancellation = body;
      else if (target === 'groupNote') out.groupNote = body;
      continue;
    }
    introParts.push(block);
  }
  out.intro = introParts.join('\n\n');
  return out;
}
