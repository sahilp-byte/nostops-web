// Admin — render the exact proposal email (no sending) for the preview pane.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { orgEnquiryFetch, proposalPayload } from '@/lib/server/org-enquiries';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = proposalPayload(await req.json().catch(() => ({})));
  try {
    const up = await orgEnquiryFetch(`/${encodeURIComponent(id)}/proposal/preview`, guard.user, { method: 'POST', body: JSON.stringify(body) });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not build the preview.') }, { status: up.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Enquiry service unavailable.' }, { status: 504 });
  }
}
