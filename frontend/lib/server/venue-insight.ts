// Server-only. Generates a short "NOSTOPS AI Insight" for a retreat venue from
// its LIVE Google reviews, using the Emergent Universal LLM key over the
// OpenAI-compatible integration proxy. This is a FALLBACK: the retreat detail
// page prefers the backend's own nostops_ai_summary and only calls this when the
// backend hasn't produced one yet, so the insight shows immediately instead of
// waiting for the backend's scheduled sync. Cached per venue signature so the
// model is called at most ~once/day per retreat. Never throws — returns null on
// any failure so the page renders unaffected.
import { unstable_cache } from 'next/cache';
import type { PublicRetreat, VenueEnrichment } from '@/lib/server/retreats';

const PROXY = (process.env.INTEGRATION_PROXY_URL || 'https://integrations.emergentagent.com').replace(/\/+$/, '');
const MODEL = 'gpt-5.4-mini';
const TIMEOUT_MS = 20000;

type Insight = { summary?: string; highlights: string[] };

function clean(s: unknown): string {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
}

function buildPrompt(r: PublicRetreat, v: VenueEnrichment): { system: string; user: string } {
  const reviews = (v.reviews || [])
    .map((rv) => clean(rv.text))
    .filter(Boolean)
    .slice(0, 6)
    .map((t, i) => `${i + 1}. "${t.slice(0, 600)}"`)
    .join('\n');
  const facts = [
    v.name ? `Venue: ${v.name}` : '',
    v.address ? `Location: ${v.address}` : '',
    typeof v.rating === 'number' ? `Google rating: ${v.rating}${v.reviewCount ? ` from ${v.reviewCount} reviews` : ''}` : '',
    r.title ? `Retreat: ${r.title}` : '',
    r.theme && r.theme !== 'general' ? `Theme: ${r.theme}` : '',
    [r.city, r.state].filter(Boolean).join(', ') ? `City: ${[r.city, r.state].filter(Boolean).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const system =
    'You are the NOSTOPS venue analyst for a yoga-teacher cooperative. Write a calm, factual, trustworthy insight ' +
    'for a seeker deciding whether to book a yoga retreat at this venue. Base it ONLY on the supplied Google reviews ' +
    'and facts — never invent amenities, prices, or claims. No marketing hyperbole. Neutral, warm, Indian-English tone. ' +
    'Return ONLY minified JSON: {"summary": string (2-3 sentences, <=60 words), "highlights": string[] (3-5 items, ' +
    'each <=8 words, concrete themes reviewers mention e.g. "Peaceful Ganga-side setting")}.';
  const user = `FACTS:\n${facts}\n\nGOOGLE REVIEWS:\n${reviews || '(no review text available)'}\n\nWrite the JSON now.`;
  return { system, user };
}

function parseInsight(content: string): Insight | null {
  const text = clean(content);
  if (!text) return null;
  // Tolerate code fences / stray prose around the JSON.
  const match = text.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : text;
  try {
    const o = JSON.parse(jsonStr);
    const summary = clean(o?.summary);
    const highlights = Array.isArray(o?.highlights)
      ? o.highlights.map((h: unknown) => clean(h)).filter(Boolean).slice(0, 5)
      : [];
    if (!summary && highlights.length === 0) return null;
    return { summary: summary || undefined, highlights };
  } catch {
    // If the model returned plain prose, use it as the summary.
    return { summary: text.slice(0, 400), highlights: [] };
  }
}

async function generate(r: PublicRetreat, v: VenueEnrichment): Promise<Insight | null> {
  const key = process.env.EMERGENT_LLM_KEY;
  if (!key) return null;
  const { system, user } = buildPrompt(r, v);
  try {
    const res = await fetch(`${PROXY}/llm/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseInsight(content) : null;
  } catch {
    return null;
  }
}

// Short, stable signature so the cache key changes only when the venue's review
// content materially changes (new place, new review set, or rating shift).
function signature(v: VenueEnrichment): string {
  const firstReview = clean(v.reviews?.[0]?.text).slice(0, 24);
  return [v.name || '', v.rating ?? '', v.reviewCount ?? '', (v.reviews || []).length, firstReview].join('|');
}

/** Returns a NOSTOPS insight for the venue, generated from its Google reviews.
 *  Cached ~24h per venue signature. Returns null when disabled/unavailable. */
export async function getNostopsInsight(r: PublicRetreat, v: VenueEnrichment): Promise<Insight | null> {
  if (!v || !(v.reviews && v.reviews.length)) return null;
  const cached = unstable_cache(
    () => generate(r, v),
    ['nostops-venue-insight', r.id, signature(v)],
    { revalidate: 86400, tags: [`venue-insight-${r.id}`] },
  );
  return cached();
}

// ---- PROMPT 27 — structured AI Retreat Intelligence ----
// A richer, clearly-separated insight: REVIEW SIGNAL (patterns grounded in the
// Google reviews) and AI INTERPRETATION (synthesis). FACT is built in code by
// the page from verified data — never by the model — so it can't be invented.
export type RetreatInsight = {
  reviewSignals: string[]; // concrete themes reviewers repeat (grounded in reviews)
  feelsLike?: string; // what the experience feels like
  whoEnjoys?: string; // who may enjoy it
  praise?: string; // what reviews consistently praise
  know?: string; // what participants should know
  demand?: string; // how demanding the schedule appears
  venueStrengths?: string; // venue strengths
  practical?: string; // practical considerations
};

function buildInsightPrompt(r: PublicRetreat, v: VenueEnrichment): { system: string; user: string } {
  const reviews = (v.reviews || [])
    .map((rv) => clean(rv.text))
    .filter(Boolean)
    .slice(0, 8)
    .map((t, i) => `${i + 1}. "${t.slice(0, 600)}"`)
    .join('\n');
  const facts = [
    v.name ? `Venue: ${v.name}` : '',
    v.address ? `Location: ${v.address}` : '',
    typeof v.rating === 'number' ? `Google rating: ${v.rating}${v.reviewCount ? ` from ${v.reviewCount} reviews` : ''}` : '',
    r.title ? `Retreat: ${r.title}` : '',
    r.theme && r.theme !== 'general' ? `Theme: ${r.theme}` : '',
    [r.city, r.state].filter(Boolean).join(', ') ? `Region: ${[r.city, r.state].filter(Boolean).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const system =
    'You are NOSTOPS Retreat Intelligence for a yoga-teacher cooperative, helping a seeker decide whether to book. ' +
    'STRICT RULES: base REVIEW SIGNAL only on the supplied Google reviews; base interpretation only on the supplied facts + reviews. ' +
    'NEVER invent amenities, prices, dates or claims. Never make medical claims. Never guarantee outcomes. Never write fake testimonials or quote reviewers by name. ' +
    'Never speak for or replace the teacher. Neutral, warm, Indian-English tone; no marketing hyperbole. Omit any field you cannot ground. ' +
    'Return ONLY minified JSON with these optional keys: {"reviewSignals": string[] (3-5, each <=8 words, concrete themes reviewers repeat), ' +
    '"feelsLike": string (<=30 words), "whoEnjoys": string (<=30 words), "praise": string (<=30 words, what reviews consistently praise), ' +
    '"know": string (<=30 words, practical thing to know), "demand": string (<=20 words, how demanding the schedule seems), ' +
    '"venueStrengths": string (<=25 words), "practical": string (<=25 words)}.';
  const user = `FACTS:\n${facts}\n\nGOOGLE REVIEWS:\n${reviews || '(no review text available)'}\n\nWrite the JSON now.`;
  return { system, user };
}

function parseRetreatInsight(content: string): RetreatInsight | null {
  const text = clean(content);
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const o = JSON.parse(match ? match[0] : text);
    const signals = Array.isArray(o?.reviewSignals)
      ? o.reviewSignals.map((h: unknown) => clean(h)).filter(Boolean).slice(0, 5)
      : [];
    const f = (k: string) => (clean(o?.[k]) || undefined);
    const out: RetreatInsight = {
      reviewSignals: signals,
      feelsLike: f('feelsLike'),
      whoEnjoys: f('whoEnjoys'),
      praise: f('praise'),
      know: f('know'),
      demand: f('demand'),
      venueStrengths: f('venueStrengths'),
      practical: f('practical'),
    };
    const hasAny = signals.length > 0 || out.feelsLike || out.whoEnjoys || out.praise || out.know || out.demand || out.venueStrengths || out.practical;
    return hasAny ? out : null;
  } catch {
    return null;
  }
}

async function generateInsight(r: PublicRetreat, v: VenueEnrichment): Promise<RetreatInsight | null> {
  const key = process.env.EMERGENT_LLM_KEY;
  if (!key) return null;
  const { system, user } = buildInsightPrompt(r, v);
  try {
    const res = await fetch(`${PROXY}/llm/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseRetreatInsight(content) : null;
  } catch {
    return null;
  }
}

/** Structured AI Retreat Intelligence (REVIEW SIGNAL + AI INTERPRETATION),
 *  grounded in the venue's Google reviews. Cached ~24h. Null when unavailable. */
export async function getRetreatInsight(r: PublicRetreat, v: VenueEnrichment | null): Promise<RetreatInsight | null> {
  if (!v || !(v.reviews && v.reviews.length)) return null;
  const cached = unstable_cache(
    () => generateInsight(r, v),
    ['nostops-retreat-insight-v2', r.id, signature(v)],
    { revalidate: 86400, tags: [`retreat-insight-${r.id}`] },
  );
  return cached();
}

// ---- NOSTOPS AI Analysis for a standalone VENUE profile ----
// Same structured intelligence as a retreat, but centred on the VENUE itself
// (no retreat schedule). Shown on venue detail pages that fetch photos + reviews
// from the venue's verified Google Business listing. Grounded ONLY in the real
// Google reviews + verified venue facts; never invents anything.
type VenueLike = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  summary?: string;
  capacity?: number;
  bestForFramings?: string[];
  sattvicCertified?: boolean;
};

function buildVenueAnalysisPrompt(vn: VenueLike, v: VenueEnrichment): { system: string; user: string } {
  const reviews = (v.reviews || [])
    .map((rv) => clean(rv.text))
    .filter(Boolean)
    .slice(0, 8)
    .map((t, i) => `${i + 1}. "${t.slice(0, 600)}"`)
    .join('\n');
  const region = [vn.city, vn.state].filter(Boolean).join(', ');
  const facts = [
    vn.name ? `Venue: ${vn.name}` : '',
    v.address ? `Location: ${v.address}` : region ? `Location: ${region}` : '',
    typeof v.rating === 'number' ? `Google rating: ${v.rating}${v.reviewCount ? ` from ${v.reviewCount} reviews` : ''}` : '',
    typeof vn.capacity === 'number' ? `Capacity: up to ${vn.capacity} guests` : '',
    vn.sattvicCertified ? 'Kitchen: sattvic vegetarian (certified)' : '',
    vn.bestForFramings && vn.bestForFramings.length ? `Best for: ${vn.bestForFramings.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const system =
    'You are NOSTOPS Venue Intelligence for a yoga-teacher cooperative, helping a seeker decide whether this venue suits a yoga retreat or residential practice. ' +
    'STRICT RULES: base REVIEW SIGNAL only on the supplied Google reviews; base interpretation only on the supplied facts + reviews. ' +
    'NEVER invent amenities, prices, dates or claims. Never make medical claims. Never guarantee outcomes. Never write fake testimonials or quote reviewers by name. ' +
    'Neutral, warm, Indian-English tone; no marketing hyperbole. Omit any field you cannot ground. ' +
    'Return ONLY minified JSON with these optional keys: {"reviewSignals": string[] (3-5, each <=8 words, concrete themes reviewers repeat), ' +
    '"feelsLike": string (<=30 words, what staying or practising here feels like), "whoEnjoys": string (<=30 words), ' +
    '"praise": string (<=30 words, what reviews consistently praise), "know": string (<=30 words, practical thing to know), ' +
    '"venueStrengths": string (<=25 words), "practical": string (<=25 words)}.';
  const user = `FACTS:\n${facts}\n\nGOOGLE REVIEWS:\n${reviews || '(no review text available)'}\n\nWrite the JSON now.`;
  return { system, user };
}

async function generateVenueAnalysis(vn: VenueLike, v: VenueEnrichment): Promise<RetreatInsight | null> {
  const key = process.env.EMERGENT_LLM_KEY;
  if (!key) return null;
  const { system, user } = buildVenueAnalysisPrompt(vn, v);
  try {
    const res = await fetch(`${PROXY}/llm/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? parseRetreatInsight(content) : null;
  } catch {
    return null;
  }
}

/** NOSTOPS AI Analysis for a venue, grounded in its Google Business reviews.
 *  Cached ~24h per venue signature. Returns null when disabled/unavailable. */
export async function getVenueAnalysis(vn: VenueLike, v: VenueEnrichment | null): Promise<RetreatInsight | null> {
  if (!v || !(v.reviews && v.reviews.length)) return null;
  const cached = unstable_cache(
    () => generateVenueAnalysis(vn, v),
    ['nostops-venue-analysis-v1', vn.id, signature(v)],
    { revalidate: 86400, tags: [`venue-analysis-${vn.id}`] },
  );
  return cached();
}
