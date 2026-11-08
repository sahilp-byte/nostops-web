import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

type Ctx = { params: Promise<{ id: string }> };

// Attach (POST) or detach (DELETE ?doc=) a private supporting document on a draft enquiry.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const body = { name: String(raw.name || 'document').slice(0, 160), type: String(raw.type || '').slice(0, 60), base64: String(raw.base64 || '') };
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}/documents`, { method: 'POST', body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not attach the document.') }, { status: r.status });
  return NextResponse.json(r.data);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const doc = new URL(req.url).searchParams.get('doc') || '';
  const r = await spacesCall(`/enquiries/${encodeURIComponent(id)}/documents/${encodeURIComponent(doc)}`, { method: 'DELETE' });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not remove the document.') }, { status: r.status });
  return NextResponse.json(r.data);
}
