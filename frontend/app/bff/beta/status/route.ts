import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';

// Public beta status probe (is the beta programme running, deadline). Read-only,
// forwards to GET /beta/status. Used by the floating feedback widget to decide
// whether to render.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const up = await backendFetch('/beta/status');
    if (!up.ok) return NextResponse.json({ active: false }, { headers: { 'Cache-Control': 'no-store' } });
    const d = await up.json().catch(() => ({}));
    return NextResponse.json(
      { active: !!d?.active, deadline: typeof d?.deadline === 'string' ? d.deadline : null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ active: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
