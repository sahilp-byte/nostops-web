// Admin moderation proxy (admin-guarded). Forwards to the internal Pulse
// /admin/* endpoints with the acting admin identity. GET (reads/export) skips
// CSRF; state changes enforce the double-submit token via requireAdmin.
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { actorFrom, pulseFetchRaw, pulseRelay } from '@/lib/server/pulse';

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }, method: string) {
  const { path } = await ctx.params;
  const guard = await requireAdmin(req, { csrf: method !== 'GET' });
  if (!guard.ok) return guard.res;
  const search = req.nextUrl.search || '';
  let body: unknown = undefined;
  if (method === 'POST' || method === 'PATCH') body = await req.json().catch(() => ({}));
  // AI digest generation can take much longer than a normal request.
  const isDigest = (path || []).join('/').startsWith('digest');
  const upstream = await pulseFetchRaw(`/admin/${(path || []).join('/')}${search}`, {
    method, body, actor: actorFrom(guard.user), timeoutMs: isDigest ? 60000 : 15000,
  });
  return pulseRelay(upstream);
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'GET');
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'POST');
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'PATCH');
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => handle(req, ctx, 'DELETE');
