import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { spacesCall } from '@/lib/server/spaces';

// PRIVATE enquiry document: only the teacher, the Space owner (once sent) and admins (checked by the backend).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await spacesCall(`/enquiries/doc/${encodeURIComponent(id)}`);
  if (r.status !== 200) return NextResponse.json({ error: 'Not found.' }, { status: r.status === 401 ? 401 : 404 });
  return new NextResponse(Buffer.from(String(r.data.base64 || ''), 'base64'), {
    headers: { 'Content-Type': String(r.data.type), 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'Content-Disposition': 'inline' },
  });
}
