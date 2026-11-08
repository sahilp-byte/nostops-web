import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { spacesCall } from '@/lib/server/spaces';

// Owner withdraws their own never-submitted draft (soft status change; record and history kept).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const r = await spacesCall(`/mine/${encodeURIComponent(id)}/withdraw`, { method: 'POST', body: {} });
  if (r.status !== 200) return NextResponse.json({ error: toErrorText(r.data?.detail, 'Could not withdraw this draft.') }, { status: r.status });
  return NextResponse.json(r.data);
}
