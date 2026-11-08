import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { teacherWhatsappUrl } from '@/lib/server/host-whatsapp';

// Prompt 2C — "Message the teacher" for a buyer outside India, who can't book a 1:1 slot yet.
// Same rules as the retreat route: the number is resolved server-side, never sent to the page.
const HANDLE = /^[A-Za-z0-9_.-]{2,64}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const text = req.nextUrl.searchParams.get('text') || '';
  return NextResponse.redirect(await teacherWhatsappUrl(HANDLE.test(handle) ? handle : null, text));
}
