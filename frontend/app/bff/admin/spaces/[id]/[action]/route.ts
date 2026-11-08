import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Admin: approve / reject / request_changes / unlist / relist (POST) or record the site-visit checklist (PUT, action = site-visit).
type Ctx = { params: Promise<{ id: string; action: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id, action } = await params;
  if (!['approve', 'reject', 'request_changes', 'unlist', 'relist'].includes(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });
  const raw = await req.json().catch(() => ({}));
  const r = await spacesCall(`/admin/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: { note: String(raw.note || '').slice(0, 2000) } });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not save the decision.') }, { status: r.status });
  revalidateTag('spaces', { expire: 0 });
  return NextResponse.json(r.data);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id, action } = await params;
  if (action !== 'site-visit') return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });
  const raw = await req.json().catch(() => ({}));
  const r = await spacesCall(`/admin/${encodeURIComponent(id)}/site-visit`, {
    method: 'PUT', body: { checklist: raw.checklist || {}, visited_on: String(raw.visited_on || '').slice(0, 10) || null, notes: String(raw.notes || '').slice(0, 2000) },
  });
  if (r.status !== 200) return NextResponse.json({ error: spacesError(r.data?.detail, 'Could not save the site visit.') }, { status: r.status });
  return NextResponse.json(r.data);
}
