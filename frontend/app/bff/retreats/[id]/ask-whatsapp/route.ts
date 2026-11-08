import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiGet } from '@/lib/api';
import { isPublicRetreatRecord, toPublicRetreat } from '@/lib/server/retreats';
import { teacherWhatsappUrl } from '@/lib/server/host-whatsapp';

// B4.7 — "Ask the teacher" on WhatsApp. The host teacher's number is never part of
// public page data; it is resolved server-side (lib/server/host-whatsapp.ts) only when
// a visitor chooses to send a question, and the browser is redirected straight to WhatsApp.
const ID = /^rt_[A-Za-z0-9_-]{3,64}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const text = req.nextUrl.searchParams.get('text') || '';
  let handle: string | null = null;
  if (ID.test(id)) {
    try {
      const raw = await apiGet<any>(`/retreats/${id}`, { revalidate: 900 });
      const r = isPublicRetreatRecord(raw) ? toPublicRetreat(raw) : null;
      handle = r?.guruHandle || null;
    } catch {
      /* the plain WhatsApp link below */
    }
  }
  return NextResponse.redirect(await teacherWhatsappUrl(handle, text));
}
