import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';
import { reportPaymentUpstream } from '@/lib/server/monitor';
import { BILLING_HEADER, routeCashfreeCheckout } from '@/lib/server/payment-routing';
import { DOMESTIC_COUNTRY } from '@/lib/payment-routing';
import { retreatOpenRefusal } from '@/lib/server/retreat-eligibility';

// Create a GROUP reservation on a retreat (tiered discount; backend enforces the
// per-retreat minimum group size). The group is held (typically 72h) and the
// host shares payment details — matches the backend next_step. CSRF + session guarded.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  // Payments Prompt 2C — a group hold uses capacity for a payment (founder decision: no holds
  // outside India for now, host-paid groups included). Checked first; nothing is held otherwise.
  const b = await req.json().catch(() => ({}));
  const routingRefusal = await routeCashfreeCheckout(req, b, 'retreat_group', { hold: true });
  if (routingRefusal) return routingRefusal;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to book a group.' }, { status: 401 });

  const { id } = await params;
  // Payments Prompt 2D — no group hold once the retreat has started (read from the retreat itself).
  const closed = await retreatOpenRefusal(id);
  if (closed) return closed;
  const groupSize = Math.floor(Number(b?.group_size));
  const organisationName = String(b?.organisation_name || '').trim();
  const organisationType = b?.organisation_type ? String(b.organisation_type).slice(0, 60) : undefined;
  const contactName = String(b?.contact_name || '').trim();
  const contactEmail = String(b?.contact_email || '').trim();
  const contactPhone = String(b?.contact_phone || '').replace(/[^\d+]/g, '');
  const notes = b?.notes ? String(b.notes).slice(0, 500) : undefined;

  if (!Number.isFinite(groupSize) || groupSize < 2 || groupSize > 500) return NextResponse.json({ error: 'Enter a valid group size.' }, { status: 400 });
  if (organisationName.length < 2 || organisationName.length > 120) return NextResponse.json({ error: 'Give your group a name.' }, { status: 400 });
  if (contactName.length < 2) return NextResponse.json({ error: 'Enter the lead contact name.' }, { status: 400 });
  if (!contactEmail.includes('@')) return NextResponse.json({ error: 'Enter a valid contact email.' }, { status: 400 });
  if (contactPhone.length < 5 || contactPhone.length > 20) return NextResponse.json({ error: 'Enter a valid contact phone.' }, { status: 400 });

  const payload: Record<string, unknown> = {
    group_size: groupSize,
    organisation_name: organisationName,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
  };
  if (organisationType) payload.organisation_type = organisationType;
  if (notes) payload.notes = notes;

  const up = await backendFetch(`/retreats/${encodeURIComponent(id)}/group-book`, {
    method: 'POST',
    headers: { [BILLING_HEADER]: DOMESTIC_COUNTRY },
    body: JSON.stringify(payload),
  });
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    reportPaymentUpstream('/bff/retreats/:id/group-book', up.status);
    const detail = Array.isArray((d as any)?.detail) ? (d as any).detail[0]?.msg : (d as any)?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not reserve your group.') }, { status: up.status || 502 });
  }
  return NextResponse.json({
    ok: true,
    reservation_id: (d as any)?.reservation_id ?? null,
    pricing: (d as any)?.pricing ?? null,
    next_step: (d as any)?.next_step ?? null,
    instructions: (d as any)?.instructions ?? null,
    whatsapp_link: (d as any)?.whatsapp_link ?? null,
    expires_at: (d as any)?.expires_at ?? null,
  });
}
