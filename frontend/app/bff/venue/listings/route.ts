import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Owner-create a retreat LISTING at one of the owner's centers. CSRF-guarded,
// whitelisted -> POST /retreats/listings/owner-create. Backend owns eligibility.
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: any, len: number): string => s(v).slice(0, len);
const strArr = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 20) : [];
const THEMES = new Set(['faculty', 'founders', 'general', 'leadership', 'lineage', 'pranayama', 'stress']);

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const raw = await req.json().catch(() => ({}));

  const centerId = s(raw.center_id);
  const title = clip(raw.title, 120);
  const startsOn = s(raw.starts_on);
  const endsOn = s(raw.ends_on);
  const seatsTotal = Math.floor(Number(raw.seats_total));
  const price = Math.floor(Number(raw.price_per_seat_inr));

  if (!centerId) return NextResponse.json({ error: 'Choose which venue to host at.' }, { status: 400 });
  if (title.length < 6) return NextResponse.json({ error: 'Title must be at least 6 characters.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}/.test(endsOn)) return NextResponse.json({ error: 'Choose valid start and end dates.' }, { status: 400 });
  if (endsOn < startsOn) return NextResponse.json({ error: 'End date must be on or after the start date.' }, { status: 400 });
  if (!Number.isFinite(seatsTotal) || seatsTotal < 1 || seatsTotal > 500) return NextResponse.json({ error: 'Seats must be between 1 and 500.' }, { status: 400 });
  if (!Number.isFinite(price) || price < 500 || price > 500000) return NextResponse.json({ error: 'Price per seat must be between ₹500 and ₹5,00,000.' }, { status: 400 });

  const body: Record<string, unknown> = {
    center_id: centerId,
    title,
    starts_on: startsOn,
    ends_on: endsOn,
    seats_total: seatsTotal,
    price_per_seat_inr: price,
    theme: THEMES.has(s(raw.theme)) ? s(raw.theme) : 'general',
  };
  const inclusions = strArr(raw.inclusions);
  if (inclusions.length) body.inclusions = inclusions;
  const curriculum = clip(raw.curriculum, 2000);
  if (curriculum) body.curriculum = curriculum;
  const ebSeats = Math.floor(Number(raw.early_bird_seats));
  if (Number.isFinite(ebSeats) && ebSeats > 0) body.early_bird_seats = Math.min(ebSeats, seatsTotal);
  const ebPrice = Math.floor(Number(raw.early_bird_price_inr));
  if (Number.isFinite(ebPrice) && ebPrice > 0 && ebPrice < price) body.early_bird_price_inr = ebPrice;

  const up = await backendFetch('/retreats/listings/owner-create', { method: 'POST', body: JSON.stringify(body) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not create the listing.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
