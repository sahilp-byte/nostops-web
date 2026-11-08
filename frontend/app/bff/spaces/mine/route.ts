import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// My Spaces: list (GET) and start a new draft (POST). Owner = signed-in user, set server-side.
export async function GET() {
  const r = await spacesCall('/mine');
  return NextResponse.json(r.status === 200 ? r.data : { error: spacesError(r.data?.detail, 'Could not load your Spaces.') }, { status: r.status });
}

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const r = await spacesCall('/mine', { method: 'POST', body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not save your Space.') }, { status: r.status });
  return NextResponse.json(r.data);
}
