import type { NextRequest } from 'next/server';
import { discoveryAdminRelay } from '@/lib/server/discovery-admin';

// Create a discovery campaign (admin).
export async function POST(req: NextRequest) {
  return discoveryAdminRelay(req, '/campaigns', 'POST');
}
