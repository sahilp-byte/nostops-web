import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Retire an editorial pick early. CSRF-guarded proxy to
// DELETE /council/editorial/{featureId}.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ featureId: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const { featureId } = await params;
  if (!featureId) return NextResponse.json({ error: 'unknown pick' }, { status: 404 });

  const up = await backendFetch(`/council/editorial/${encodeURIComponent(featureId)}`, { method: 'DELETE' });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not retire pick.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
