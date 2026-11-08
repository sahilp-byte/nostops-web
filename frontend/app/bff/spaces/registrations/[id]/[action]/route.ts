import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { srCall, srError } from '@/lib/server/space-registrations';

// Phase 6 — verify (server re-reads the gateway), cancel (participant), admin-cancel (admin + reason).
const ACTIONS = new Set(['verify', 'cancel', 'admin-cancel']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const raw = await req.json().catch(() => ({}));
  const body = action === 'admin-cancel' ? { reason: String(raw.reason || '').slice(0, 1000) } : {};
  const r = await srCall(`/${encodeURIComponent(id)}/${action}`, { method: 'POST', body });
  if (r.status !== 200) return NextResponse.json({ error: srError(r.data?.detail, 'Could not complete that action.') }, { status: r.status });
  return NextResponse.json(r.data);
}
