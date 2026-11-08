import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { spacesCall } from '@/lib/server/spaces';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const r = await spacesCall(`/mine/${encodeURIComponent(id)}/submit`, { method: 'POST', body: {} });
  if (r.status !== 200) {
    const d = r.data?.detail;
    return NextResponse.json({ error: typeof d === 'object' && d?.message ? d.message : toErrorText(d, 'Could not submit your Space.'), missing: d?.missing || [] }, { status: r.status });
  }
  return NextResponse.json(r.data);
}
