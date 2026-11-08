import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { reportPaymentUpstream } from '@/lib/server/monitor';
import { paymentsDisabled } from '@/lib/server/payment-guard';
import { BILLING_HEADER, routeCashfreeCheckout } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';
import { retreatOpenRefusal } from '@/lib/server/retreat-eligibility';
import { displayName } from '@/lib/roles';
import { apiGet } from '@/lib/api';
import { toPublicRetreat, fmtRange } from '@/lib/server/retreats';
import { SITE_URL } from '@/lib/site';
import { divertTestEmail } from '@/lib/server/test-tag';

const EMAIL_BASE_URL = 'https://integrations.emergentagent.com';
function escapeHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Best-effort held-seat confirmation email — never blocks/breaks the reserve flow.
async function sendReserveEmail(opts: { id: string; to: string; name: string; whatsapp: string | null; expiresAt: string | null; req: NextRequest }) {
  const key = process.env.EMERGENT_EMAIL_KEY;
  if (!key || !opts.to.includes('@')) return;
  try {
    let title = 'your NOSTOPS retreat';
    let dates = '';
    let venue = '';
    let price = '';
    try {
      const raw = await apiGet<any>(`/retreats/${opts.id}`, { noStore: true });
      const r = raw ? toPublicRetreat(raw) : null;
      if (r) {
        title = r.title || title;
        dates = fmtRange(r.startDate, r.endDate);
        venue = [r.venueName, r.city, r.state].filter(Boolean).join(', ');
        if (typeof r.priceInr === 'number') price = `₹${Math.round(r.priceInr).toLocaleString('en-IN')} / seat`;
      }
    } catch {
      /* fall back to generic copy */
    }
    const payUrl = `${SITE_URL}/app/retreats/${opts.id}`;
    const expiry = opts.expiresAt ? new Date(opts.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
    const rows = [
      dates ? `<tr><td style="color:#64748b;padding:2px 0">Dates</td><td style="text-align:right;font-weight:bold">${escapeHtml(dates)}</td></tr>` : '',
      venue ? `<tr><td style="color:#64748b;padding:2px 0">Venue</td><td style="text-align:right;font-weight:bold">${escapeHtml(venue)}</td></tr>` : '',
      price ? `<tr><td style="color:#64748b;padding:2px 0">Price</td><td style="text-align:right;font-weight:bold">${escapeHtml(price)}</td></tr>` : '',
    ].join('');
    const html =
      `<table role="presentation" width="100%" style="max-width:560px;margin:0 auto"><tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">` +
      `<p style="font-size:18px;font-weight:bold;margin:0 0 8px">Your seat is held, ${escapeHtml(opts.name)}</p>` +
      `<p style="margin:0 0 12px;line-height:1.6">We&#39;re holding your seat for <b>${escapeHtml(title)}</b>${expiry ? ` until <b>${escapeHtml(expiry)}</b>` : ''}. Complete payment to confirm.</p>` +
      (rows ? `<table width="100%" style="font-size:14px;margin:0 0 16px">${rows}</table>` : '') +
      `<p style="margin:0 0 20px"><a href="${payUrl}" style="background:#F59E0B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">Complete payment</a></p>` +
      (opts.whatsapp ? `<p style="margin:0 0 12px;line-height:1.6">Prefer UPI / bank transfer? <a href="${escapeHtml(opts.whatsapp)}" style="color:#0D9488;font-weight:bold">Message the host on WhatsApp</a>.</p>` : '') +
      `<p style="font-size:12px;color:#64748b;margin:16px 0 0;line-height:1.5">Sent by NOSTOPS. We never ask for your password or card details by email.</p>` +
      `</td></tr></table>`;
    const subject = `Your seat is held — ${title}`;
    // Prompt 2F — a signed test request's email goes to the test outbox, never to the provider.
    if (await divertTestEmail(opts.req.headers, { to: opts.to, subject, html, source: 'retreat-reserve' })) return;
    await fetch(`${EMAIL_BASE_URL}/api/v1/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Email-Key': key },
      body: JSON.stringify({ to: [opts.to], subject, html, from_name: process.env.EMAIL_FROM_NAME || 'NOSTOPS' }),
    });
  } catch {
    /* best-effort: swallow */
  }
}

// Reserve a seat on a retreat for the signed-in seeker. The reservation is held
// (typically 48h) in a pending state; payment is completed via the sibling
// /reservations/[rid]/pay route (hosted Cashfree checkout) or off-platform per the
// host's setup. CSRF double-submit enforced; bearer attached server-side.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  // Payments Prompt 2C — a held seat uses capacity for a payment, so the billing country is checked
  // first, server-side: missing/invalid → 400, outside India → 422. No seat is held.
  const b = await req.json().catch(() => ({}));
  const routingRefusal = await routeCashfreeCheckout(req, b, 'retreat_seat', { hold: true });
  if (routingRefusal) return routingRefusal;
  const disabled = paymentsDisabled(req);
  if (disabled) return disabled;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to reserve a seat.' }, { status: 401 });

  const { id } = await params;
  // Payments Prompt 2D — no seat once the retreat has started (read from the retreat itself).
  const closed = await retreatOpenRefusal(id);
  if (closed) return closed;
  const name = String(b?.name || '').trim();
  const email = String(b?.email || '').trim();
  const phone = String(b?.phone || '').replace(/[^\d+]/g, '');
  const notes = b?.notes ? String(b.notes).slice(0, 500) : undefined;
  const dietary = b?.dietary ? String(b.dietary).slice(0, 200) : undefined;
  const companyName = b?.company_name ? String(b.company_name).slice(0, 120) : undefined;

  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  if (!email.includes('@') || email.length > 200) return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });
  if (phone.length < 5 || phone.length > 20) return NextResponse.json({ error: 'A valid phone number is required to hold your seat.' }, { status: 400 });

  const payload: Record<string, unknown> = { name, email, phone };
  if (notes) payload.notes = notes;
  if (dietary) payload.dietary = dietary;
  if (companyName) payload.company_name = companyName;

  // PROMPT 12/13 — cohort attribution. A participant who arrives via a Teacher's
  // cohort link is TAGGED to that cohort for THIS retreat only (no ownership).
  const clip = (v: any, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const cohort = clip(b?.cohort, 120);
  const via = clip(b?.via, 80);
  // PROMPT 19 — no self-referral: a teacher cannot credit their own cohort by
  // booking their own link. If the booker's name matches the referrer, the
  // attribution is dropped and the seat books as a direct reservation.
  const flat = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const selfName = flat(displayName(user) || '');
  const selfReferral = !!via && !!selfName && flat(via) === selfName;
  if (cohort && !selfReferral) {
    payload.attribution = { source: 'cohort', cohort, ...(via ? { via } : {}) };
    payload.cohort_fit_note = `Joined “${cohort}” cohort${via ? ` via ${via}` : ''}`.slice(0, 200);
  }

  const up = await backendFetch(`/retreats/${encodeURIComponent(id)}/reserve`, {
    method: 'POST',
    headers: { [BILLING_HEADER]: DOMESTIC_COUNTRY },
    body: JSON.stringify(payload),
  });
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    reportPaymentUpstream('/bff/retreats/:id/reserve', up.status);
    const detail = Array.isArray((d as any)?.detail) ? (d as any).detail[0]?.msg : (d as any)?.detail;
    return NextResponse.json({ error: toErrorText(detail || (d as any)?.message, 'Could not reserve your seat.') }, { status: up.status || 502 });
  }
  const reservationId = (d as any)?.reservation_id ?? null;
  const whatsappLink = (d as any)?.whatsapp_link ?? null;
  const expiresAt = (d as any)?.expires_at ?? null;
  if (reservationId) {
    await sendReserveEmail({ id, to: email, name, whatsapp: whatsappLink, expiresAt, req });
  }
  return NextResponse.json({
    ok: true,
    reservation_id: reservationId,
    next_step: (d as any)?.next_step ?? null,
    instructions: (d as any)?.instructions ?? null,
    whatsapp_link: whatsappLink,
    expires_at: expiresAt,
  });
}
