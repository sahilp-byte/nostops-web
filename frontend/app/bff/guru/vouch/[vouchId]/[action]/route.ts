import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Council lineage-vouch decisions. CSRF-guarded proxy to
// POST /lineage/vouches/{vouchId}/{action}. approve|decline carry {note};
// revoke carries {reason}. Only these three actions are allowed.
const ALLOWED = new Set(['approve', 'decline', 'revoke']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ vouchId: string; action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const { vouchId, action } = await params;
  if (!ALLOWED.has(action) || !vouchId) {
    return NextResponse.json({ error: 'unknown action' }, { status: 404 });
  }

  const raw = await req.json().catch(() => ({}));
  const text = typeof raw?.note === 'string' ? raw.note.slice(0, 1000) : '';
  const body = action === 'revoke' ? { reason: text } : { note: text };

  const up = await backendFetch(`/lineage/vouches/${encodeURIComponent(vouchId)}/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not process decision.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
