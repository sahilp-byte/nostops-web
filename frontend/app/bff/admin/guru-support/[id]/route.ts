// Admin Support Queue proxy — read one request (GET) or update status/assignee/
// note (POST). Admin-gated; CSRF enforced on the write.
import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';

const AI_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const { id } = await params;
  try {
    const upstream = await fetch(`${AI_BASE}/api/guru/support/requests/${encodeURIComponent(id)}`, {
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const upstream = await fetch(`${AI_BASE}/api/guru/support/requests/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      body: JSON.stringify({
        status: typeof body?.status === 'string' ? body.status : undefined,
        assignee: typeof body?.assignee === 'string' ? body.assignee : undefined,
        note: typeof body?.note === 'string' ? body.note : undefined,
        note_author: guard.user?.name || guard.user?.email || 'admin',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Support service unavailable.' }, { status: 504 });
  }
}
