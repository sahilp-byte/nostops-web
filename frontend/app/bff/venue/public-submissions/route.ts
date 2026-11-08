import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';

// PUBLIC (unauthenticated) venue submission intake. Anyone — owner, manager,
// host, teacher or community member — can suggest a venue for review from the
// public /venues/submit form. CSRF double-submit still applies (proxy.ts issues
// nostops_csrf on /venues/submit page loads; sendBff echoes it). The shared
// secret is attached server-side here and never reaches the browser. Feeds the
// SAME local admin review queue as owner mirrors.
export const runtime = 'nodejs';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: unknown, len: number): string => s(v).slice(0, len);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 20) : [];

// Only accept photos we just stored ourselves — same-origin /bff/media/** JPG/PNG/WebP
// URLs returned by /bff/venue/public-photo. Blocks arbitrary/off-site URL injection.
const isOwnMediaUrl = (u: string): boolean => /^\/bff\/media\/[A-Za-z0-9/_-]+\.(?:jpg|jpeg|png|webp)$/i.test(u);
const photoArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && isOwnMediaUrl(x.trim())).map((x) => x.trim()).slice(0, 2) : [];

// In-memory per-IP throttle — a cheap first gate before we even call the
// backend (which also enforces a persistent Mongo-backed limit). Resets on
// redeploy; that's fine as a coarse burst-limiter.
const MIN_DWELL_MS = 4000; // humans take longer than this to fill the form
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return (xff.split(',')[0] || '').trim().slice(0, 64) || 'unknown';
}

function throttled(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // guard against unbounded growth
  return false;
}

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  if (!SECRET) return NextResponse.json({ error: 'Submissions are temporarily unavailable.' }, { status: 503 });

  const raw = await req.json().catch(() => ({}));

  // 1) Honeypot — a hidden field real users never see. If it's filled, a bot
  //    did it: return a convincing fake success and store nothing.
  if (s(raw.company).length > 0) return NextResponse.json({ ok: true, deduped: false });

  // 2) Time-trap — the form stamps when it rendered. Reject instant/robotic
  //    submits and stamps that are missing or implausibly old.
  const startedAt = Number(raw.form_started_at);
  const elapsed = Number.isFinite(startedAt) ? Date.now() - startedAt : NaN;
  if (!Number.isFinite(elapsed) || elapsed < MIN_DWELL_MS || elapsed > MAX_AGE_MS) {
    return NextResponse.json({ error: 'Please take a moment to fill in the form and try again.' }, { status: 429 });
  }

  // 3) Coarse per-IP burst limit.
  const ip = clientIp(req);
  if (throttled(ip)) {
    return NextResponse.json({ error: "You've submitted a few venues recently — please try again later." }, { status: 429 });
  }

  const venue_name = clip(raw.venue_name, 120);
  const city = clip(raw.city, 80);
  const submitter_name = clip(raw.submitter_name, 120);
  const submitter_email = clip(raw.submitter_email, 160);

  if (venue_name.length < 2) return NextResponse.json({ error: 'Enter the venue name.' }, { status: 400 });
  if (city.length < 2) return NextResponse.json({ error: 'Enter the venue city.' }, { status: 400 });
  if (submitter_name.length < 1) return NextResponse.json({ error: 'Enter your name.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(submitter_email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const photos = photoArr(raw.photos);
  if (photos.length < 1) return NextResponse.json({ error: 'Please add at least one photo of your venue (up to 2).' }, { status: 400 });

  const capRaw = Number(raw.capacity);
  const capacity = Number.isFinite(capRaw) && capRaw >= 1 && capRaw <= 5000 ? Math.floor(capRaw) : undefined;

  const body: Record<string, unknown> = {
    venue_name,
    city,
    state: clip(raw.state, 60),
    country: clip(raw.country, 60),
    address: clip(raw.address, 200),
    venue_type: clip(raw.venue_type, 60),
    best_for: strArr(raw.best_for),
    amenities: strArr(raw.amenities),
    description: clip(raw.description, 4000),
    website_or_maps_url: clip(raw.website_or_maps_url, 400),
    photos,
    submitter_role: clip(raw.submitter_role, 40) || 'owner',
    submitter_name,
    submitter_email,
    submitter_phone: clip(raw.submitter_phone, 40),
    relationship_note: clip(raw.relationship_note, 1000),
    honeypot: '',
    captcha_token: clip(raw.captcha_token, 512),
    captcha_answer: clip(raw.captcha_answer, 16),
  };
  if (capacity !== undefined) body.capacity = capacity;

  try {
    const up = await fetch(`${BASE}/api/venues/public-submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Pulse-Secret': SECRET, ...testTagHeaders(),
        // Forward the client IP so the backend can rate-limit persistently.
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      return NextResponse.json({ error: toErrorText(data?.detail, 'Could not submit the venue. Please try again.') }, { status: up.status || 502 });
    }
    // kit_token: read-only link to the new submitter's free Venue Partner toolkit (Thank You page).
    return NextResponse.json({ ok: true, deduped: !!data?.deduped, submission_id: data?.submission_id, kit_token: typeof data?.kit_token === 'string' ? data.kit_token : undefined });
  } catch {
    return NextResponse.json({ error: 'Submission service is unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}
