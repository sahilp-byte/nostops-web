// NOSTOPS Institutional Engine — §8 PARTICIPANT server-only data layer.
// Reads the opaque participant session token from the httpOnly nostops_participant
// cookie and forwards it to the ISOLATED local engine as X-Participant-Session
// (never exposed to the browser). Writes go through /bff/institutional/participant/*.
import 'server-only';
import { cookies } from 'next/headers';
import { PARTICIPANT_COOKIE } from '@/lib/session-cookie';
import { institutionalFetch } from '@/lib/server/institutional';
import { BACKEND_BASE } from '@/lib/api';
import { refuseFinancialCall } from '@/lib/server/financial-lock';

export type ParticipantInfo = {
  participant_id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
};

export type ParticipantRegistration = {
  registration_id: string;
  event_id: string;
  event_slug?: string | null;
  event_title?: string | null;
  event_subtitle?: string | null;
  event_date?: string | null;
  // B2.2 — a registration for ONE session of a repeating programme.
  session_id?: string | null;
  session_date?: string | null;
  session_seq?: number | null;
  session_count?: number | null;
  session_past?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  city?: string | null;
  venue?: string | null;
  timezone?: string | null;
  programme_name?: string | null;
  programme_taxonomy_label?: string | null;
  organisation_name?: string | null;
  organisation_logo?: string | null;
  lifecycle_effective?: string | null;
  registration_status?: string;
  booking_status?: string;
  payment_status?: string;
  pricing_type?: string;
  amount?: number | null;
  currency?: string | null;
  payment_order_id?: string | null;
  participant_name?: string | null;
  participant_type?: string | null;
  created_at?: string;
  // §12 feedback/attendance flags
  is_completed?: boolean;
  attendance_status?: string | null;
  feedback_given?: boolean;
  feedback_rating?: number | null;
  can_feedback?: boolean;
  can_certificate?: boolean;
};

export async function getParticipantSessionToken(): Promise<string | null> {
  return (await cookies()).get(PARTICIPANT_COOKIE)?.value ?? null;
}

export async function getParticipantMe(): Promise<ParticipantInfo | null> {
  const token = await getParticipantSessionToken();
  if (!token) return null;
  try {
    const r = await institutionalFetch('/participant/me', { participantSession: token });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return (d?.participant as ParticipantInfo) ?? null;
  } catch {
    return null;
  }
}

export async function getMyRegistrations(): Promise<ParticipantRegistration[]> {
  const token = await getParticipantSessionToken();
  if (!token) return [];
  try {
    const r = await institutionalFetch('/participant/me/registrations', { participantSession: token });
    if (!r.ok) return [];
    const d = await r.json().catch(() => ({}));
    return (d?.registrations as ParticipantRegistration[]) ?? [];
  } catch {
    return [];
  }
}

// §12/§13 — re-verify a Cashfree order with the gateway and, when PAID, confirm
// the attached PENDING_PAYMENT registration (idempotent, keyed by order_id).
// Shared by the confirm BFF route and the SSR return page so the booking still
// confirms even if the client CSRF poll is blocked (embedded/cross-site webview).
const PAID_STATUSES = new Set(['PAID', 'SUCCESS']);
export async function confirmParticipantPayment(orderId: string): Promise<{ status: string; confirmed: boolean }> {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(orderId)) return { status: 'UNKNOWN', confirmed: false };
  const orderPath = `/payments/cashfree/orders/${encodeURIComponent(orderId)}`;
  if (refuseFinancialCall('GET', orderPath)) return { status: 'UNKNOWN', confirmed: false };
  try {
    const sr = await fetch(`${BACKEND_BASE}/api${orderPath}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const sd = await sr.json().catch(() => null);
    if (!sr.ok) return { status: 'UNKNOWN', confirmed: false };
    const status = String(sd?.order_status || sd?.status || 'UNKNOWN').toUpperCase();
    const amount =
      typeof sd?.order_amount === 'number' ? sd.order_amount : typeof sd?.amount === 'number' ? sd.amount : undefined;
    let confirmed = false;
    if (PAID_STATUSES.has(status)) {
      // Currency and reference come from the order itself — never assumed — so the engine can
      // refuse a payment that doesn't match the registration (P0 Decision 2).
      const currency = sd?.order_currency || sd?.currency || undefined;
      const reference = typeof sd?.reference_id === 'string' ? sd.reference_id : undefined;
      const cr = await institutionalFetch('/participant/payment/confirm', {
        method: 'POST',
        body: { order_id: orderId, amount_paid: amount, currency, reference_id: reference },
      });
      confirmed = cr.ok;
    }
    return { status, confirmed };
  } catch {
    return { status: 'UNKNOWN', confirmed: false };
  }
}
