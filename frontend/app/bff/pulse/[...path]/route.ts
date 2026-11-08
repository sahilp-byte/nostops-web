// Community writes proxy (CSRF + participant-guarded). Forwards to the internal
// Pulse service with the authenticated identity. Never allows admin paths.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePulseUser, pulseFetchRaw, pulseRelay } from '@/lib/server/pulse';

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }, method: string) {
  const { path } = await ctx.params;
  if (!path || path[0] === 'admin') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  const guard = await requirePulseUser(req);
  if (!guard.ok) return guard.res;
  let body: unknown = undefined;
  if (method !== 'DELETE') body = await req.json().catch(() => ({}));
  const upstream = await pulseFetchRaw(`/${path.join('/')}`, { method, body, actor: guard.actor });
  return pulseRelay(upstream);
}

export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'POST');
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'PATCH');
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'DELETE');
