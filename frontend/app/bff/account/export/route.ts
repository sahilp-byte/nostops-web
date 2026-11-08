import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';

// DPDP "data portability": stream the learner's data export as a download.
export async function GET(_req: NextRequest) {
  const up = await backendFetch('/me/account/export');
  if (!up.ok) {
    return NextResponse.json({ error: 'Could not export your data. Please sign in again.' }, { status: up.status || 502 });
  }
  const data = await up.json().catch(() => null);
  if (!data) return NextResponse.json({ error: 'Export unavailable.' }, { status: 502 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="nostops-my-data.json"',
      'Cache-Control': 'no-store',
    },
  });
}
