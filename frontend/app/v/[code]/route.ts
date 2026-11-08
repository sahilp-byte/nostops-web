import type { NextRequest } from 'next/server';
import { venueInviteRedirect } from '@/lib/server/venue-invite';

// Public venue invitation link (widget / QR / PDF / WhatsApp): /v/{code}
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return venueInviteRedirect(req, code, 'listing');
}
