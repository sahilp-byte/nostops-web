import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Owner response to an incoming enquiry: accept (in principle) / discuss / propose_dates / decline.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const body: Record<string, string> = { action: String(raw.action || '').slice(0, 20), message: String(raw.message || '').slice(0, 2000) };
  for (const k of ['proposed_start', 'proposed_end', 'proposed_time_from', 'proposed_time_to']) if (raw[k]) body[k] = String(raw[k]).slice(0, 10);
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}/respond`, { method: 'POST', body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not send your response.') }, { status: r.status });
  return NextResponse.json(r.data);
}
