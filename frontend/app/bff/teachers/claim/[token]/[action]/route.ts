import type { NextRequest } from 'next/server';
import { badOrigin, withSession, NextResponse } from '@/lib/server/bff';
import { getSessionToken } from '@/lib/server/session';
import { claimCall, websiteRoute, type Upstream } from '@/lib/server/teacher-claim';

// Stage 5C — claim journey BFF (POST only, CSRF-protected, explicit user actions only).
//   complete     → POST /teachers/claim/{token}            (new account; sets the existing session cookie)
//   link         → POST /teachers/claim/{token}/link       (existing session bearer; teacher_id from the backend GET)
//   otp-request  → POST /teachers/claim/{token}/otp/request (backend picks the stored phone; none accepted here)
//   otp-verify   → POST /teachers/claim/{token}/otp/verify  (verification_id kept in an httpOnly cookie, never in JS)
// Responses carry only safe codes; backend error bodies, ids and tokens never reach the browser or logs.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string; action: string }> };
const VCOOKIE = 'nostops_claim_v';
const OPS = new Set(['claim', 'link']);

function out(body: Record<string, unknown>, status = 200) {
  const r = NextResponse.json(body, { status });
  r.headers.set('Cache-Control', 'no-store, private, max-age=0');
  r.headers.set('Referrer-Policy', 'no-referrer');
  return r;
}

function fail(up: Upstream, fallback = 'failed') {
  if (up.status === 0 || up.status >= 500) return out({ code: 'unavailable' }, 503);
  if (up.status === 410) return out({ code: 'invalid_link' }, 410);
  if (up.status === 401) return out({ code: 'auth_required' }, 401);
  if (up.status === 429) return out({ code: 'rate_limited' }, 429);
  if (up.status === 409) return out({ code: 'conflict' }, 409);
  if (up.status === 403) return out({ code: 'ownership_failed' }, 403);
  if (up.status === 400 || up.status === 422) return out({ code: fallback }, 422);
  return out({ code: 'failed' }, 400);
}

function takeVerification(req: NextRequest, op: string): string | undefined {
  const raw = req.cookies.get(VCOOKIE)?.value || '';
  const [vop, vid] = raw.split(':', 2);
  return vop === op && vid ? vid : undefined;
}

function clearVerification<T extends NextResponse>(r: T): T {
  r.cookies.set(VCOOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/bff/teachers/claim', maxAge: 0 });
  return r;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (badOrigin(req)) return out({ code: 'invalid_origin' }, 403);
  const { token, action } = await params;
  const body = (await req.json().catch(() => ({}))) || {};

  if (action === 'complete') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (body.confirm !== true) return out({ code: 'confirm_required' }, 422);
    if (password.length < 8 || password.length > 128) return out({ code: 'password_invalid' }, 422);
    const verification_id = takeVerification(req, 'claim');
    const up = await claimCall(token, '', { method: 'POST', body: verification_id ? { password, verification_id } : { password } });
    if (up.status !== 200) return fail(up, 'password_invalid');
    if (typeof up.data?.session_token !== 'string' || !up.data.session_token) return out({ code: 'unavailable' }, 503);
    return clearVerification(withSession(out({ ok: true, next: websiteRoute(up.data.next_route) }), up.data.session_token));
  }

  if (action === 'link') {
    if (body.confirm !== true) return out({ code: 'confirm_required' }, 422);
    const bearer = await getSessionToken();
    if (!bearer) return out({ code: 'auth_required' }, 401);
    const inv = await claimCall(token, '', { method: 'GET' }); // teacher_id comes from the backend, never the browser
    if (inv.status !== 200) return fail(inv);
    const teacher_id = typeof inv.data?.teacher_id === 'string' ? inv.data.teacher_id : '';
    if (!teacher_id) return out({ code: 'link_unavailable' }, 409);
    const verification_id = takeVerification(req, 'link');
    const up = await claimCall(token, '/link', { method: 'POST', bearer, body: verification_id ? { teacher_id, verification_id } : { teacher_id } });
    if (up.status !== 200 || up.data?.linked !== true) return fail(up.status === 200 ? { status: 0, data: null } : up);
    return clearVerification(out({ ok: true, next: websiteRoute(up.data.next_route) })); // existing session untouched
  }

  if (action === 'otp-request') {
    if (!OPS.has(body.operation)) return out({ code: 'bad_request' }, 422);
    const up = await claimCall(token, '/otp/request', { method: 'POST', body: { operation: body.operation } });
    if (up.status !== 200) return fail(up);
    if (up.data?.status === 'manual_review') return out({ status: 'manual_review' });
    if (up.data?.status === 'otp_sent') return out({ status: 'otp_sent', phone_masked: String(up.data.phone_masked || '').slice(0, 24) });
    return out({ code: 'unavailable' }, 503);
  }

  if (action === 'otp-verify') {
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!OPS.has(body.operation) || !/^\d{4,8}$/.test(code)) return out({ code: 'otp_invalid' }, 422);
    const up = await claimCall(token, '/otp/verify', { method: 'POST', body: { operation: body.operation, code } });
    if (up.status !== 200 || up.data?.ok !== true || typeof up.data?.verification_id !== 'string') return fail(up, 'otp_invalid');
    const ttl = Math.min(600, Math.max(30, Number(up.data.expires_in_seconds) || 600));
    const r = out({ ok: true, operation: body.operation, expires_in_seconds: ttl });
    r.cookies.set(VCOOKIE, `${body.operation}:${up.data.verification_id}`, {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/bff/teachers/claim', maxAge: ttl,
    });
    return r;
  }

  return out({ code: 'not_found' }, 404);
}
