import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';

// Read-only ROI calculator proxy (GET /corporate/roi-calculator?employees=&months=).
// No CSRF token needed for a safe GET; the bearer is attached server-side.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employees = Math.max(1, Math.min(100000, parseInt(sp.get('employees') || '50', 10) || 50));
  const months = Math.max(1, Math.min(36, parseInt(sp.get('months') || '3', 10) || 3));
  const up = await backendFetch(`/corporate/roi-calculator?employees=${employees}&months=${months}`);
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not compute ROI.') }, { status: up.status || 502 });
  }
  return NextResponse.json(data);
}
