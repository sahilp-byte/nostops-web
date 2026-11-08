import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Invite a teacher partner (co-host) onto an owner listing, agreeing the venue
// economics. CSRF-guarded, whitelisted -> POST /retreats/{retreat_id}/partnerships.
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: any, len: number): string => s(v).slice(0, len);
const pct = (v: any): number | undefined => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) && x >= 0 && x <= 100 ? x : undefined;
};
const money = (v: any): number | undefined => {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) && x >= 0 && x <= 10000000 ? x : undefined;
};
const MODELS = new Set(['co_host', 'rental', 'revenue_share']);

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));

  const retreatId = s(raw.retreat_id);
  const email = clip(raw.partner_email, 200);
  if (!retreatId) return NextResponse.json({ error: 'Choose which listing to invite a teacher to.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid teacher email.' }, { status: 400 });

  const body: Record<string, unknown> = {
    partner_email: email,
    model: MODELS.has(s(raw.model)) ? s(raw.model) : 'co_host',
  };
  const name = clip(raw.partner_name, 120);
  if (name) body.partner_name = name;
  const ownerShare = pct(raw.owner_share_pct);
  if (ownerShare !== undefined) body.owner_share_pct = ownerShare;
  const guestFee = money(raw.guest_fee_inr);
  if (guestFee !== undefined) body.guest_fee_inr = guestFee;
  const rental = money(raw.rental_inr);
  if (rental !== undefined) body.rental_inr = rental;
  const rentalShare = pct(raw.rental_owner_share_pct);
  if (rentalShare !== undefined) body.rental_owner_share_pct = rentalShare;
  const note = clip(raw.note, 500);
  if (note) body.note = note;

  const up = await backendFetch(`/retreats/${encodeURIComponent(retreatId)}/partnerships`, { method: 'POST', body: JSON.stringify(body) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not send the invitation.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
