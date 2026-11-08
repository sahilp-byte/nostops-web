import type { NextRequest } from 'next/server';
import { discoveryAdminRelay } from '@/lib/server/discovery-admin';

// Start a discovery background job for a campaign (admin).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return discoveryAdminRelay(req, `/campaigns/${encodeURIComponent(id)}/run`, 'POST');
}
