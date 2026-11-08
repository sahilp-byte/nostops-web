import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';

// CSRF-guarded claim proxy → LOCAL /api/discovery/claim/{city}/{teacher}.
// Any signed-in NOSTOPS account may claim (claiming is what starts the teacher
// journey). Identity is injected server-side; never trusted from the client.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ city: string; teacher: string }> },
) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in to claim this profile.' }, { status: 401 });
  const { city, teacher } = await params;
  const body = await req.json().catch(() => ({}));
  const actor = {
    user_id: String(user.user_id || user.email || ''),
    name: (user.name as string) || (user.email as string) || '',
    role: normalizeRole(user.role),
  };
  const uHeader = Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
  try {
    const up = await fetch(
      `${BASE}/api/discovery/claim/${encodeURIComponent(city)}/${encodeURIComponent(teacher)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pulse-Secret': SECRET, ...testTagHeaders(),
          'X-Pulse-User': uHeader,
        },
        body: JSON.stringify({ is_authorised: body?.is_authorised === true }),
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = await up.json().catch(() => ({}));
    if (!up.ok) {
      const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
      return NextResponse.json({ error: detail || data?.error || 'Could not claim this profile.' }, { status: up.status || 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Network error. Please try again.' }, { status: 502 });
  }
}
