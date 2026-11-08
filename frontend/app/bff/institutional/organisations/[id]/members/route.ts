// Institutional engine — list an org's authorised members (for the Programme
// Champion selector). Read; session-gated (engine enforces membership).
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await params;
  try {
    const r = await institutionalFetch(`/organisations/${encodeURIComponent(id)}/members`, { actor: institutionalActor(user) });
    const d = await r.json().catch(() => ({}));
    return NextResponse.json(d, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }
}
