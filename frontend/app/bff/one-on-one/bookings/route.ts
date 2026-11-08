import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { apiGet } from '@/lib/api';
import { recordOneOnOne } from '@/lib/server/audit';
import { paymentsDisabled } from '@/lib/server/payment-guard';
import { BILLING_HEADER, routeCashfreeCheckout } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';

// Create a 1:1 booking in PENDING_PAYMENT state. The client sends the public
// teacher HANDLE (never the internal teacher_id); we resolve the id server-side
// so it never has to travel through the browser. CSRF double-submit enforced;
// the bearer token is attached server-side by backendFetch. Returns the
// booking_id + authoritative amount the Cashfree order is then created for.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  // Payments Prompt 2C — the booking holds the teacher's slot for a payment, so the billing country
  // is checked first, server-side: missing/invalid → 400, outside India → 422. Nothing is created.
  const body = await req.json().catch(() => ({}));
  const routingRefusal = await routeCashfreeCheckout(req, body, 'one_on_one', { hold: true });
  if (routingRefusal) return routingRefusal;
  const disabled = paymentsDisabled(req);
  if (disabled) return disabled;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to book.' }, { status: 401 });

  const handle = String(body?.teacher_handle || '').trim();
  const slotIso = String(body?.slot_iso || '').trim();
  const learnerName = String(body?.learner_name || '').trim();
  const learnerPhone = String(body?.learner_phone || '').replace(/[^\d+]/g, '');
  const note = body?.note ? String(body.note).slice(0, 500) : undefined;

  if (!handle) return NextResponse.json({ error: 'Missing teacher.' }, { status: 400 });
  if (learnerName.length < 1 || learnerName.length > 120) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  }
  if (learnerPhone.length < 5 || learnerPhone.length > 20) {
    return NextResponse.json({ error: 'A valid phone number is required.' }, { status: 400 });
  }
  const slotTs = Date.parse(slotIso);
  if (Number.isNaN(slotTs)) return NextResponse.json({ error: 'Please choose a valid date and time.' }, { status: 400 });
  if (slotTs < Date.now()) return NextResponse.json({ error: 'Please pick a time in the future.' }, { status: 400 });

  // Resolve handle -> teacher_id via the public endpoint (server-side only).
  let teacherId = '';
  let teacherName = '';
  try {
    const d = await apiGet<{ teacher?: any }>(`/teachers/public/${encodeURIComponent(handle)}`, { noStore: true });
    const t = (d && (d.teacher || d)) as any;
    teacherId = String(t?.teacher_id || '');
    teacherName = String(t?.name || '');
  } catch {
    /* fall through to 404 below */
  }
  if (!teacherId) return NextResponse.json({ error: 'That teacher is not available for booking.' }, { status: 404 });

  const up = await backendFetch('/one-on-one/bookings', {
    method: 'POST',
    headers: { [BILLING_HEADER]: DOMESTIC_COUNTRY },
    body: JSON.stringify({
      teacher_id: teacherId,
      slot_iso: slotIso,
      learner_name: learnerName,
      learner_phone: learnerPhone,
      ...(note ? { note } : {}),
    }),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json(
      { error: toErrorText(data?.detail || data?.message, 'Could not create the booking.') },
      { status: up.status || 502 },
    );
  }
  const bookingId = data?.booking_id ?? data?.id ?? null;
  const amount =
    typeof data?.amount === 'number' ? data.amount : typeof data?.amount_inr === 'number' ? data.amount_inr : null;

  // Record the reservation in the local audit ledger for admin visibility. The
  // remote backend has no 1:1 admin endpoint, so this is our only trail. It is
  // best-effort (recordOneOnOne never throws) and must never block the booking.
  if (bookingId) {
    const noteParts = note ? note.split(' · ') : [];
    const focusPart = noteParts.find((p) => p.startsWith('Focus:'));
    await recordOneOnOne(user, {
      booking_id: String(bookingId),
      event: 'reserve',
      status: 'PENDING_PAYMENT',
      teacher_id: teacherId,
      teacher_handle: handle,
      teacher_name: data?.teacher_name || teacherName || undefined,
      seeker_phone: learnerPhone,
      amount_inr: typeof amount === 'number' ? amount : undefined,
      currency: 'INR',
      session_mode: body?.session_mode ? String(body.session_mode).slice(0, 40) : undefined,
      matrix_reason: focusPart ? focusPart.replace(/^Focus:\s*/, '').trim() : undefined,
      note,
      slot_iso: data?.slot_iso || slotIso,
    });
  }

  return NextResponse.json({
    ok: true,
    booking_id: bookingId,
    amount,
    teacher_name: data?.teacher_name || teacherName || undefined,
    slot_iso: data?.slot_iso || slotIso,
  });
}
