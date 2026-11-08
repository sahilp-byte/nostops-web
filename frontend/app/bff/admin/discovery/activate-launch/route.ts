import type { NextRequest } from 'next/server';
import { discoveryAdminRelay } from '@/lib/server/discovery-admin';

// Idempotently create/activate the nine independent launch-city campaigns.
export async function POST(req: NextRequest) {
  return discoveryAdminRelay(req, '/campaigns/activate-launch', 'POST');
}
