import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { growthFetch, growthOrigin } from '@/lib/server/venue-growth';

// Admin-only: the Venue Partner overview + partner email controls (type=monthly | reminder).
//   GET  ?view=overview                                  → every venue's widget/badge/counts + email status
//   GET  ?view=preview&type=&venue_id=&month=            → the exact email a venue would get
//   POST {action:'test', type, venue_id}                 → sends that email to the signed-in ADMIN only
//   POST {action:'run', type, month?}                    → sends every due email now (idempotent)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function relay(up: Response, fallback: string) {
  const d = await up.json().catch(() => null);
  if (!up.ok) return NextResponse.json({ error: toErrorText(d?.detail, fallback) }, { status: up.status || 502 });
  return NextResponse.json(d);
}

const kindOf = (v: unknown) => (v === 'reminder' ? 'reminder' : 'monthly');

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const sp = new URL(req.url).searchParams;
  if (sp.get('view') === 'preview') {
    const venueId = encodeURIComponent((sp.get('venue_id') || '').slice(0, 80));
    const month = encodeURIComponent((sp.get('month') || '').slice(0, 7));
    const base = encodeURIComponent(growthOrigin(req.headers));
    const path = kindOf(sp.get('type')) === 'reminder'
      ? `/admin/reminder/preview?venue_id=${venueId}&base=${base}`
      : `/admin/monthly/preview?venue_id=${venueId}&month=${month}&base=${base}`;
    return relay(await growthFetch(path), 'Could not build the preview.');
  }
  return relay(await growthFetch('/admin/overview'), 'The overview is unavailable right now.');
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const raw = await req.json().catch(() => ({}));
  const base = growthOrigin(req.headers);
  const kind = kindOf(raw?.type);
  if (raw?.action === 'test') {
    const to = String(guard.user?.email || '');
    if (!to) return NextResponse.json({ error: 'Your admin account has no email address.' }, { status: 400 });
    const body = { venue_id: String(raw.venue_id || '').slice(0, 80), to, base };
    return relay(await growthFetch(`/admin/${kind}/test`, { method: 'POST', body: JSON.stringify(body) }), 'Could not send the test email.');
  }
  if (raw?.action === 'run') {
    const body = { month: typeof raw.month === 'string' ? raw.month.slice(0, 7) : '', base };
    return relay(await growthFetch(`/admin/${kind}/run`, { method: 'POST', body: JSON.stringify(body) }), 'Could not send the emails.');
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
