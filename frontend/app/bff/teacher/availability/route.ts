import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BLOCKS = new Set(['morning', 'afternoon', 'evening']);

function normalizeSlots(raw: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of DAYS) {
    const v = raw && Array.isArray(raw[d]) ? raw[d] : [];
    out[d] = v.filter((x: any) => BLOCKS.has(String(x))).map(String);
  }
  return out;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  try {
    const up = await backendFetch('/teachers/me/availability');
    if (up.ok) {
      const d = await up.json().catch(() => ({}));
      return NextResponse.json({
        available: d?.available ?? true,
        timezone: d?.timezone || 'Asia/Kolkata',
        slots: normalizeSlots(d?.slots),
        supported: true,
      });
    }
  } catch {
    /* backend not ready — fall through */
  }
  // Graceful default until the backend endpoint ships.
  return NextResponse.json({ available: true, timezone: 'Asia/Kolkata', slots: normalizeSlots(null), supported: false });
}

export async function PUT(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload = { available: Boolean(body?.available), slots: normalizeSlots(body?.slots) };

  try {
    const up = await backendFetch('/teachers/me/availability', { method: 'PUT', body: JSON.stringify(payload) });
    if (up.ok) {
      const d = await up.json().catch(() => payload);
      return NextResponse.json({ ok: true, ...d, supported: true });
    }
    if (up.status === 404 || up.status === 405 || up.status === 501) {
      return NextResponse.json(
        { ok: false, pending: true, error: 'Your weekly schedule is saved locally — real saving switches on once the scheduler backend goes live.' },
        { status: 200 },
      );
    }
    const d = await up.json().catch(() => null);
    return NextResponse.json({ ok: false, error: toErrorText(d?.detail || d?.error, 'Could not save your schedule.') }, { status: up.status });
  } catch {
    return NextResponse.json(
      { ok: false, pending: true, error: 'Your weekly schedule is saved locally — real saving switches on once the scheduler backend goes live.' },
      { status: 200 },
    );
  }
}
