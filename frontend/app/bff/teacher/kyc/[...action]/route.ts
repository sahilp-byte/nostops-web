import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Proxy for the teacher InstaKYC (Sandbox.co.in) flow. Only a fixed whitelist of
// backend sub-paths is forwarded; everything else is rejected. The bearer token
// is attached server-side by backendFetch. CSRF-guarded like all BFF writes.
// Payments Prompt 2A: 'create-payment' (the retired Razorpay InstaKYC payment link) is no
// longer forwarded. InstaKYC is paid through the Cashfree checkout. 'verify-payment' stays mapped
// for traceability, but Prompt 4B (founder decision) refuses it while the money lock is on: the
// website lock rule 'legacy-kyc-confirm' answers 423 in backendFetch before anything is sent.
const ALLOWED: Record<string, string> = {
  'verify-payment': '/kyc/sandbox/verify-payment',
  'aadhaar/otp': '/kyc/sandbox/aadhaar/otp',
  'aadhaar/verify': '/kyc/sandbox/aadhaar/verify',
  'pan/verify': '/kyc/sandbox/pan/verify',
  'bank/verify': '/kyc/sandbox/bank/verify',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string[] }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { action } = await params;
  const key = (action || []).join('/');
  const target = ALLOWED[key];
  if (!target) return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const up = await backendFetch(target, { method: 'POST', body: JSON.stringify(body ?? {}) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json(
      { error: toErrorText(data?.detail || data?.message, 'Verification step failed.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json(data);
}
