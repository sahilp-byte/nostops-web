import type { NextRequest } from 'next/server';
import { discoveryAdminRelay } from '@/lib/server/discovery-admin';

// Candidate management action (admin): mark_irrelevant | mark_duplicate |
// approve | reject | invite | resend_invite | set_stage | clear.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return discoveryAdminRelay(req, `/candidates/${encodeURIComponent(id)}/action`, 'POST');
}
