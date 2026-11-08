import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Upload one PRIVATE verification document (only admins can open it).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const body = { kind: String(raw.kind || '').slice(0, 30), name: String(raw.name || 'document').slice(0, 160), type: String(raw.type || '').slice(0, 60), base64: String(raw.base64 || '') };
  const r = await spacesCall(`/mine/${encodeURIComponent(id)}/documents`, { method: 'POST', body });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not upload the document.') }, { status: r.status });
  return NextResponse.json(r.data);
}
