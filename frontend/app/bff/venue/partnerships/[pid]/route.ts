import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Partnership actions. CSRF-guarded.
//   DELETE /retreats/partnerships/{pid}            -> cancel (owner-sent, pending)
//   POST   {action:accept|decline}                 -> respond (partner side)
//   POST   {action:counter, owner_share_pct?, ...} -> counter terms
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  if (badOrigin(_req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { pid } = await params;
  if (!pid) return NextResponse.json({ error: 'missing partnership id' }, { status: 400 });
  const up = await backendFetch(`/retreats/partnerships/${encodeURIComponent(pid)}`, { method: 'DELETE' });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not cancel the partnership.') }, { status: up.status || 502 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { pid } = await params;
  if (!pid) return NextResponse.json({ error: 'missing partnership id' }, { status: 400 });
  const raw = await req.json().catch(() => ({}));
  const action = s(raw.action);
  if (!['accept', 'decline', 'counter'].includes(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  let body = '{}';
  if (action === 'counter') {
    const counter: Record<string, unknown> = {};
    const ownerShare = pct(raw.owner_share_pct);
    if (ownerShare !== undefined) counter.owner_share_pct = ownerShare;
    const guestFee = money(raw.guest_fee_inr);
    if (guestFee !== undefined) counter.guest_fee_inr = guestFee;
    const rental = money(raw.rental_inr);
    if (rental !== undefined) counter.rental_inr = rental;
    const rentalShare = pct(raw.rental_owner_share_pct);
    if (rentalShare !== undefined) counter.rental_owner_share_pct = rentalShare;
    const note = clip(raw.note, 500);
    if (note) counter.note = note;
    if (Object.keys(counter).length === 0) return NextResponse.json({ error: 'Propose at least one term to counter.' }, { status: 400 });
    body = JSON.stringify(counter);
  }

  const up = await backendFetch(`/retreats/partnerships/${encodeURIComponent(pid)}/${action}`, { method: 'POST', body });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not update the partnership.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
