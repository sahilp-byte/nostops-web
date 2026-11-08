// Admin Org Enquiries proxy — list with filters. Admin-gated (role from the
// httpOnly session); never an open relay. The backend re-checks the admin role.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { orgEnquiryFetch } from '@/lib/server/org-enquiries';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const src = new URL(req.url).searchParams;
  const qs = new URLSearchParams();
  for (const k of ['stage', 'cohort', 'city', 'q']) {
    const v = (src.get(k) || '').trim().slice(0, 80);
    if (v) qs.set(k, v);
  }
  try {
    const up = await orgEnquiryFetch([...qs].length ? `?${qs}` : '', guard.user);
    return NextResponse.json(await up.json().catch(() => ({})), { status: up.status });
  } catch {
    return NextResponse.json({ error: 'Enquiry service unavailable.' }, { status: 504 });
  }
}
