import type { NextRequest } from 'next/server';
import { discoveryAdminRelay } from '@/lib/server/discovery-admin';

// Update a campaign: status (active|paused|stopped|completed) and/or target.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return discoveryAdminRelay(req, `/campaigns/${encodeURIComponent(id)}`, 'PATCH');
}
