import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const r = await spacesCall(`/mine/${encodeURIComponent(id)}`);
  return NextResponse.json(r.status === 200 ? r.data : { error: spacesError(r.data?.detail, 'Space not found.') }, { status: r.status });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await spacesCall(`/mine/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not save your Space.') }, { status: r.status });
  return NextResponse.json(r.data);
}
