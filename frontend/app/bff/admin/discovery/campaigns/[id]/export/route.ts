import type { NextRequest } from 'next/server';
import { discoveryAdminRelay } from '@/lib/server/discovery-admin';

// CSV export of a campaign's candidates (admin). GET proxy (no CSRF).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return discoveryAdminRelay(req, `/campaigns/${encodeURIComponent(id)}/export`, 'GET', false);
}
