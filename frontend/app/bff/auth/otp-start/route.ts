import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, NextResponse } from '@/lib/server/bff';

// Start phone OTP for an EXISTING account of any persona (Twilio Verify on the main backend sends
// the SMS). Indian (+91) mobiles only. The number is checked with the backend's own pre-flight
// lookup first, so no SMS is sent (and no account can be started) for an unknown number — new
// people sign up through /signup. Light per-number throttle on top of the backend's own limits.
const COOLDOWN_MS = 30_000;
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 5;
const MAX_PER_IP = 20;
const OTP_TIMEOUT_MS = 25_000;
const SLOW_MESSAGE = 'Mobile login is taking longer than usual. Please wait a few seconds and tap Send OTP again.';
// Every request counts (also unknown numbers), per number AND per client IP, so the account
// lookup can't be used to check many numbers. In-memory (per server instance) and pruned.
const sends = new Map<string, number[]>();

function hits(key: string, now: number): number[] {
  const recent = (sends.get(key) || []).filter((t) => now - t < WINDOW_MS);
  sends.set(key, recent);
  return recent;
}

function throttle(phone: string, ip: string): number {
  const now = Date.now();
  if (sends.size > 5000) for (const [k, v] of sends) if (!v.length || now - v[v.length - 1] > WINDOW_MS) sends.delete(k);
  const byPhone = hits(`p:${phone}`, now);
  const byIp = hits(`i:${ip}`, now);
  const last = byPhone[byPhone.length - 1];
  if (last && now - last < COOLDOWN_MS) return Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
  if (byPhone.length >= MAX_PER_WINDOW) return Math.ceil((WINDOW_MS - (now - byPhone[0])) / 1000);
  if (byIp.length >= MAX_PER_IP) return Math.ceil((WINDOW_MS - (now - byIp[0])) / 1000);
  byPhone.push(now);
  byIp.push(now);
  return 0;
}

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const phone = String(body?.phone || '');
  if (!/^\+91[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: 'Enter your 10-digit Indian mobile number.' }, { status: 400 });
  }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const wait = throttle(phone, ip);
  if (wait > 0) {
    return NextResponse.json(
      { error: wait > 60 ? 'Too many codes requested for this number. Please try again later or log in with email.' : `Please wait ${wait}s before requesting another code.`, retry_after: wait },
      { status: 429 },
    );
  }

  // The main backend can take a while to wake up and Twilio adds its own delay, so the OTP
  // calls get a longer timeout; a timeout or network failure returns a clear message
  // instead of an empty error.
  let look: Response;
  let found: any;
  try {
    look = await forward('/auth/otp/lookup', { phone }, OTP_TIMEOUT_MS);
    found = await readJson(look);
  } catch {
    return NextResponse.json({ error: SLOW_MESSAGE }, { status: 504 });
  }
  if (!look.ok) {
    return NextResponse.json({ error: 'Mobile login is unavailable right now. Please try again or log in with email.' }, { status: 502 });
  }
  if (found?.exists !== true) {
    return NextResponse.json(
      { no_account: true, error: 'No NOSTOPS account uses this mobile number. Log in with email, or sign up first.' },
      { status: 404 },
    );
  }

  let up: Response;
  let data: any;
  try {
    up = await forward('/auth/otp/start', { phone, purpose: 'login', channel: body?.channel === 'whatsapp' ? 'whatsapp' : 'sms' }, OTP_TIMEOUT_MS);
    data = await readJson(up);
  } catch {
    return NextResponse.json({ error: SLOW_MESSAGE }, { status: 504 });
  }
  if (!up.ok) {
    return NextResponse.json({ error: errorMessage(data, 'Could not send OTP. Please try again.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
