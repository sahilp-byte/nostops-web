import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireVerifiedTeacher } from '@/lib/server/teacher-guard';

// Read the suggested alternative teachers for a booking (#31 reassign flow).
// GET is a safe read, but we still require the CSRF token so only the app can
// enumerate the (public-safe) alternatives list. Projects to display-safe fields.
export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const gate = await requireVerifiedTeacher();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { bookingId } = await params;
  if (!bookingId) return NextResponse.json({ error: 'missing booking id' }, { status: 400 });

  const up = await backendFetch(`/one-on-one/booking/${bookingId}/alternative-teachers`);
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not load alternatives.') }, { status: up.status || 502 });
  }
  const alternatives = (Array.isArray(data?.alternatives) ? data.alternatives : []).map((t: any) => ({
    handle: String(t.handle || ''),
    name: t.name || 'Teacher',
    city: t.city || '',
    tier: t.tier || '',
    styles: Array.isArray(t.styles) ? t.styles.filter((x: any) => typeof x === 'string').slice(0, 4) : [],
    avatarUrl: t.avatar_url || null,
  })).filter((t: { handle: string }) => t.handle);

  return NextResponse.json({ ok: true, alternatives });
}
