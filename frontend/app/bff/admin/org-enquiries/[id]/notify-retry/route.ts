// Admin — re-send the enquiry notifications that failed (team alert and/or the
// enquirer acknowledgement). Admin-gated + CSRF.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { orgEnquiryFetch } from '@/lib/server/org-enquiries';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  try {
    const up = await orgEnquiryFetch(`/${encodeURIComponent(id)}/notify-retry`, guard.user, { method: 'POST', body: '{}' });
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, 'Could not resend.') }, { status: up.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Enquiry service unavailable.' }, { status: 504 });
  }
}
