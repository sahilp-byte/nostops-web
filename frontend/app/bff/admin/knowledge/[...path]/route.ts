// Admin-only Knowledge-Graph verification actions (CSRF + admin-guarded).
// Verifying a teacher affiliation is ALWAYS a manual, evidence-backed decision.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePulseUser } from '@/lib/server/pulse';
import { kgAdminFetch } from '@/lib/server/knowledge';

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }, method: string) {
  const guard = await requirePulseUser(req);
  if (!guard.ok) return guard.res;
  if (guard.actor.role !== 'admin') return NextResponse.json({ error: 'Administrators only.' }, { status: 403 });
  const { path } = await ctx.params;
  const sub = (path || []).join('/');
  const body = method === 'GET' ? undefined : await req.json().catch(() => ({}));
  const actor = { user_id: guard.actor.user_id, role: guard.actor.role, name: guard.actor.name };
  const upstream = await kgAdminFetch(`/admin/${sub}`, { method, body, actor });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'GET');
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'POST');
