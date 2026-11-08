// Admin Support Queue proxy — list requests or analytics. Admin-gated
// (role resolved from the httpOnly session); never an open relay.
import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';

const AI_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const view = url.searchParams.get('view');
  let path = '/api/guru/support/requests';
  if (view === 'analytics') {
    path = '/api/guru/support/analytics';
  } else {
    const qs = new URLSearchParams();
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    if (status) qs.set('status', status);
    if (category) qs.set('category', category);
    if ([...qs].length) path += `?${qs.toString()}`;
  }

  try {
    const upstream = await fetch(`${AI_BASE}${path}`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Support service unavailable.' }, { status: 504 });
  }
}
