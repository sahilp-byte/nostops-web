import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, forward, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Public retreat waitlist — open ONLY when the retreat is sold out (the existing rule, now also
// checked here). Anonymous visitors use it from public pages, which carry no CSRF token, so
// Prompt 2D protects it server-side, before anything is sent:
//  • JSON only, at most 2 KB, strict checks on the retreat id, name, email and optional phone;
//  • a browser request marked cross-site (Sec-Fetch-Site) is refused — the Origin header is
//    never treated as proof of anything;
//  • the visitor's session is attached ONLY with a matching double-submit CSRF token; otherwise
//    the sign-up is sent without it, so a forged request can never act as someone's account;
//  • rate limits: 5 tries per IP per 10 minutes and 2 per email per retreat per day (per server
//    instance, reset on redeploy — a coarse gate, like the public photo upload);
//  • the retreat is read on the server and must have no seats left.
// In preview the sign-up itself is then refused by the preview write guard (nothing is sent).
const RETREAT_ID = /^rt_[A-Za-z0-9]{4,40}$/;
const EMAIL = /^[^\s@<>"',;]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const MAX_BODY_BYTES = 2048;
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX = 5;
const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_MAX = 2;
const hits = new Map<string, number[]>();

function limited(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

function clientIp(req: NextRequest): string {
  return ((req.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim().slice(0, 64) || 'unknown';
}

function seatsRemaining(r: any): number | null {
  if (typeof r?.seats_remaining === 'number' && Number.isFinite(r.seats_remaining)) return r.seats_remaining;
  if (typeof r?.seats_total === 'number' && typeof r?.seats_filled === 'number') return r.seats_total - r.seats_filled;
  return null;
}

const refuse = (status: number, reason: string, error: string) =>
  NextResponse.json({ error, reason, waitlist_refused: true }, { status });
const UNAVAILABLE = "We couldn't check this retreat right now, so you haven't been added to a waitlist. Please try again.";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!RETREAT_ID.test(id)) return refuse(404, 'retreat_not_found', 'This retreat could not be found.');
  if ((req.headers.get('sec-fetch-site') || '').toLowerCase() === 'cross-site') {
    return refuse(403, 'cross_site', 'This request was refused. Please use the form on the retreat page.');
  }
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return refuse(415, 'json_required', 'Please send the form again.');
  }
  const text = await req.text().catch(() => '');
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return refuse(413, 'too_large', 'That form was too long. Please shorten it.');
  let b: any = null;
  try {
    b = JSON.parse(text);
  } catch {
    b = null;
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return refuse(400, 'invalid_body', 'Please fill in the form.');
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const phone = typeof b.phone === 'string' ? b.phone.replace(/[\s().-]/g, '') : b.phone == null ? '' : null;
  if (name.length < 2 || name.length > 120 || CONTROL.test(name)) return refuse(400, 'invalid_name', 'Please enter your name.');
  if (email.length > 200 || !EMAIL.test(email)) return refuse(400, 'invalid_email', 'Please enter a valid email.');
  if (phone === null || (phone && !/^\+?\d{5,20}$/.test(phone))) {
    return refuse(400, 'invalid_phone', 'Please enter a valid phone number, or leave it empty.');
  }
  if (limited(`ip:${clientIp(req)}`, IP_WINDOW_MS, IP_MAX) || limited(`em:${id}:${email.toLowerCase()}`, EMAIL_WINDOW_MS, EMAIL_MAX)) {
    return refuse(429, 'rate_limited', "You've tried to join this waitlist a few times recently. Please try again later.");
  }

  // The existing rule, checked here too: the waitlist opens only when no seats are left.
  let retreat: any = null;
  try {
    const r = await backendFetch(`/retreats/${encodeURIComponent(id)}`);
    if (r.status === 404) return refuse(404, 'retreat_not_found', 'This retreat could not be found.');
    if (!r.ok) return refuse(503, 'retreat_unavailable', UNAVAILABLE);
    const d = await r.json().catch(() => null);
    retreat = d?.retreat ?? d;
  } catch {
    return refuse(503, 'retreat_unavailable', UNAVAILABLE);
  }
  const remaining = seatsRemaining(retreat);
  if (remaining === null) return refuse(503, 'retreat_unavailable', UNAVAILABLE);
  if (remaining > 0) {
    return refuse(409, 'seats_available', "Seats are still available on this retreat, so its waitlist isn't open. You haven't been added to a waitlist.");
  }

  const path = `/retreats/${encodeURIComponent(id)}/waitlist`;
  const payload = { name, email, phone: phone || '' };
  try {
    // Session only with a matching CSRF token; otherwise the sign-up goes without it.
    const up = badOrigin(req) ? await forward(path, payload) : await backendFetch(path, { method: 'POST', body: JSON.stringify(payload) });
    const d = await up.json().catch(() => ({}));
    if (!up.ok) {
      return NextResponse.json(
        { error: toErrorText((d as any)?.detail ?? (d as any)?.error, 'Could not submit right now. Please try again.'), ...((d as any)?.preview_read_only ? { preview_read_only: true } : {}) },
        { status: up.status || 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not submit right now. Please try again.' }, { status: 502 });
  }
}
