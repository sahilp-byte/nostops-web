import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyGuruToken } from '@/lib/server/guru-csrf';
import { toErrorText } from '@/lib/server/bff';

// PUBLIC Organisation Enquiry intake ("Request a proposal"). Org pages are
// cacheable public pages without the nostops_csrf cookie, so CSRF uses the
// stateless signed token from /bff/guru/token (x-guru-csrf). Layered anti-spam:
// honeypot → time-trap → per-IP burst limit here; validation, CAPTCHA, content
// heuristics, the persistent 5/hour/IP limit and the 24h duplicate rule are all
// enforced again by the backend. The shared secret never reaches the browser.
export const runtime = 'nodejs';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

const COHORTS = new Set(['COMPANY', 'EDUCATIONAL_INSTITUTION', 'STARTUP_NETWORK']);
const INTERESTS = new Set(['MIND', 'BODY', 'SPECIAL_NEEDS']);
const PARTICIPANTS = new Set(['UNDER_15', '15_28', '29_40', '41_PLUS']);
const DURATIONS = new Set(['1_MONTH', '3_MONTHS', '6_MONTHS', '12_MONTHS', 'NOT_SURE']);
const STARTS = new Set(['THIS_MONTH', 'NEXT_MONTH', 'IN_2_3_MONTHS', 'LATER', 'NOT_SURE']);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const MIN_DWELL_MS = 3000;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: unknown, len: number): string => s(v).slice(0, len);

function clientIp(req: NextRequest): string {
  return ((req.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim().slice(0, 64) || 'unknown';
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
  if (hits.size > 5000) hits.clear();
  return false;
}

export async function POST(req: NextRequest) {
  if (!verifyGuruToken(req.headers.get('x-guru-csrf'))) {
    return NextResponse.json({ error: 'Your session expired. Please refresh the page and try again.' }, { status: 403 });
  }
  if (!SECRET) return NextResponse.json({ error: 'Enquiries are temporarily unavailable.' }, { status: 503 });

  const raw = await req.json().catch(() => ({}));

  // 1) Honeypot — bots fill the hidden field: fake success, store nothing.
  if (s(raw?.company).length > 0) {
    return NextResponse.json({ ok: true, ref: `ENQ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, deduped: false });
  }

  // 2) Time-trap.
  const startedAt = Number(raw?.form_started_at);
  const elapsed = Number.isFinite(startedAt) ? Date.now() - startedAt : NaN;
  if (!Number.isFinite(elapsed) || elapsed < MIN_DWELL_MS || elapsed > MAX_AGE_MS) {
    return NextResponse.json({ error: 'Please take a moment to fill in the form and try again.' }, { status: 429 });
  }

  // 3) Server-side validation (mirrors the backend; field errors for the UI).
  const organisation_name = clip(raw?.organisation_name, 160);
  const contact_name = clip(raw?.contact_name, 120);
  const email = clip(raw?.email, 200);
  const phone = clip(raw?.phone, 40);
  const city = clip(raw?.city, 80);
  const cohort = s(raw?.cohort);
  const participants = s(raw?.participants);
  const duration = s(raw?.duration);
  const start_period = s(raw?.start_period);
  const interests = Array.isArray(raw?.interests) ? [...new Set(raw.interests.filter((x: unknown) => typeof x === 'string' && INTERESTS.has(x)))] : [];
  const fields: Record<string, string> = {};
  if (organisation_name.length < 2) fields.organisation_name = "Enter your organisation's name.";
  if (!contact_name) fields.contact_name = 'Enter your name.';
  if (!email && !phone) fields.email = 'Give a work email or a phone number so we can reach you.';
  else if (email && !EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
  if (phone && !/^[\d\s()+\-.]{7,20}$/.test(phone)) fields.phone = 'Enter a valid phone number.';
  if (!COHORTS.has(cohort)) fields.cohort = 'Choose your organisation type.';
  if (city.length < 2) fields.city = 'Enter the city.';
  if (!PARTICIPANTS.has(participants)) fields.participants = 'Choose the approximate number of participants.';
  if (interests.length === 0) fields.interests = 'Choose at least one programme area.';
  if (!DURATIONS.has(duration)) fields.duration = 'Choose a preferred duration.';
  if (!STARTS.has(start_period)) fields.start_period = 'Choose when you would like to start.';
  if (raw?.consent !== true) fields.consent = 'Please agree to be contacted about your enquiry.';
  if (clip(raw?.captcha_answer, 16).length < 4 || !s(raw?.captcha_token)) fields.captcha = 'Type the characters shown in the verification image.';
  if (Object.keys(fields).length) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields }, { status: 400 });
  }

  // 4) Coarse per-IP burst limit (backend also enforces a persistent one).
  const ip = clientIp(req);
  if (throttled(ip)) {
    return NextResponse.json({ error: "You've sent several enquiries recently. Please try again in an hour." }, { status: 429 });
  }

  const utmIn = raw?.utm && typeof raw.utm === 'object' ? raw.utm : {};
  const utm: Record<string, string> = {};
  for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
    const v = clip(utmIn[k], 100);
    if (v) utm[k] = v;
  }
  const sourcePage = clip(raw?.source_page, 200);

  try {
    const up = await fetch(`${BASE}/api/org-enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders(), 'X-Forwarded-For': ip },
      body: JSON.stringify({
        organisation_name,
        contact_name,
        designation: clip(raw?.designation, 120),
        email,
        phone,
        cohort,
        city,
        participants,
        interests,
        duration,
        start_period,
        message: clip(raw?.message, 2000),
        consent: true,
        customisation_requested: raw?.customisation_requested === true,
        source_page: sourcePage.startsWith('/') ? sourcePage : '',
        landing_page: clip(raw?.landing_page, 300),
        referrer: clip(raw?.referrer, 300),
        utm,
        honeypot: '',
        captcha_token: clip(raw?.captcha_token, 512),
        captcha_answer: clip(raw?.captcha_answer, 16),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      const d = data?.detail;
      if (d && typeof d === 'object' && !Array.isArray(d) && d.fields) {
        return NextResponse.json({ error: toErrorText(d.message, 'Please check the highlighted fields.'), fields: d.fields }, { status: up.status });
      }
      return NextResponse.json({ error: toErrorText(d, 'Could not send your enquiry. Please try again.') }, { status: up.status || 502 });
    }
    return NextResponse.json({ ok: true, ref: data?.ref, deduped: !!data?.deduped });
  } catch {
    return NextResponse.json({ error: 'The enquiry service is unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}
