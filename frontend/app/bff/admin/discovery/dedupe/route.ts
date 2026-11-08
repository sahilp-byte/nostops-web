import type { NextRequest } from 'next/server';
import { discoveryAdminRelay } from '@/lib/server/discovery-admin';

// Admin: clean up duplicate campaigns (one campaign per city).
export async function POST(req: NextRequest) {
  return discoveryAdminRelay(req, '/campaigns/dedupe', 'POST');
}
