// Admin Org Enquiries proxy — read one enquiry (GET) or update stage / owner /
// note (PATCH). Admin-gated; CSRF enforced on the write. The acting admin is
// taken from the session, never from the request body.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { orgEnquiryFetch } from '@/lib/server/org-enquiries';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const { id } = await params;
  try {
    const up = await orgEnquiryFetch(`/${encodeURIComponent(id)}`, guard.user);
    return NextResponse.json(await up.json().catch(() => ({})), { status: up.status });
  } catch {
    return NextResponse.json({ error: 'Enquiry service unavailable.' }, { status: 504 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const payload: Record<string, string> = {};
  if (typeof body?.stage === 'string') payload.stage = body.stage;
  if (typeof body?.owner === 'string') payload.owner = body.owner.slice(0, 120);
  if (typeof body?.note === 'string' && body.note.trim()) payload.note = body.note.slice(0, 4000);
  try {
    const up = await orgEnquiryFetch(`/${encodeURIComponent(id)}`, guard.user, { method: 'PATCH', body: JSON.stringify(payload) });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not save.') }, { status: up.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Enquiry service unavailable.' }, { status: 504 });
  }
}

// Permanent delete (spam / test). The backend also insists on confirm === "DELETE".
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const confirm = typeof body?.confirm === 'string' ? body.confirm.slice(0, 20) : '';
  try {
    const up = await orgEnquiryFetch(`/${encodeURIComponent(id)}`, guard.user, { method: 'DELETE', body: JSON.stringify({ confirm }) });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not delete.') }, { status: up.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Enquiry service unavailable.' }, { status: 504 });
  }
}
