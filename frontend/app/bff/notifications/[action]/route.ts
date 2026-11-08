import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Mark notifications read. CSRF-guarded proxy. action = "read-all" →
// POST /notifications/read-all; otherwise action is a notification id →
// POST /notifications/{id}/read.
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const { action } = await params;
  if (!action) return NextResponse.json({ error: 'unknown action' }, { status: 404 });

  const path = action === 'read-all' ? '/notifications/read-all' : `/notifications/${encodeURIComponent(action)}/read`;
  const up = await backendFetch(path, { method: 'POST', body: JSON.stringify({}) });
  if (!up.ok) {
    const data = await up.json().catch(() => ({}));
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not update.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
