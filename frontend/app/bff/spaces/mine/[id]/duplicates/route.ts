import { NextResponse } from 'next/server';
import { spacesCall } from '@/lib/server/spaces';

// Read-only duplicate-listing warning for the owner's own Space (same official locality + same address or name).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await spacesCall(`/mine/${encodeURIComponent(id)}/duplicates`);
  if (r.status !== 200) return NextResponse.json({ duplicates: [] }, { status: r.status });
  return NextResponse.json(r.data, { headers: { 'Cache-Control': 'no-store' } });
}
