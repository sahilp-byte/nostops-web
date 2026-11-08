import type { NextRequest } from 'next/server';
import { badOrigin, forward, readJson, errorMessage, withSession, NextResponse, toErrorText } from '@/lib/server/bff';

// Verify phone OTP for an EXISTING account of any persona -> { session_token, user }.
// No `role` and no signup fields are sent, so the backend signs in the account that owns the
// number with the role it already has (no persona attached, no new account). /app then routes
// the user to their own dashboard. A number without an account gets 409 needs_signup.
// Wrong codes are limited per number here too (5 per 15 minutes), on top of the backend/Twilio.
const FAIL_WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;
const fails = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const phone = String(body?.phone || '');
  const code = String(body?.code || '');
  if (!/^\+91[6-9]\d{9}$/.test(phone) || !/^\d{4,8}$/.test(code)) {
    return NextResponse.json({ error: 'Phone and code are required.' }, { status: 400 });
  }
  const now = Date.now();
  if (fails.size > 5000) for (const [k, v] of fails) if (!v.length || now - v[v.length - 1] > FAIL_WINDOW_MS) fails.delete(k);
  const recentFails = (fails.get(phone) || []).filter((t) => now - t < FAIL_WINDOW_MS);
  fails.set(phone, recentFails);
  if (recentFails.length >= MAX_FAILS) {
    return NextResponse.json({ error: 'Too many incorrect codes. Please wait 15 minutes, then request a new code.' }, { status: 429 });
  }
  let up: Response;
  let data: any;
  try {
    up = await forward('/auth/otp/verify', { phone, code, purpose: 'login' }, 25_000);
    data = await readJson(up);
  } catch {
    return NextResponse.json({ error: 'Verification is taking longer than usual. Please tap Verify again.' }, { status: 504 });
  }
  const detail = errorMessage(data, '');
  if (/NEW_USER_NEEDS_SIGNUP/i.test(detail)) {
    return NextResponse.json({ needs_signup: true, error: 'No NOSTOPS account uses this mobile number. Please sign up first.' }, { status: 409 });
  }
  if (!up.ok || typeof data?.session_token !== 'string') {
    recentFails.push(now);
    const expired = /expire/i.test(detail);
    const fallback = expired ? 'This code has expired. Tap “Resend OTP” for a new one.' : 'That code is incorrect or has expired. Try again or resend.';
    return NextResponse.json({ error: toErrorText(detail, fallback) }, { status: up.status >= 400 && up.status < 600 ? up.status : 502 });
  }
  return withSession(NextResponse.json({ user: data.user ?? null }), data.session_token);
}
