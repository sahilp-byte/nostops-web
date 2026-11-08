import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { reportEvent } from '@/lib/server/monitor';

// PUBLIC beacon target for browser errors (lib/report-client-error). No
// cookies/CSRF needed: it only ever WRITES an anonymous, size-capped error
// sample into the Error Monitor. Abuse is bounded by a per-IP limit here and by
// grouping + alert cooldowns in the backend.
export const runtime = 'nodejs';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_PER_WINDOW;
}

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

export async function POST(req: NextRequest) {
  const raw = await req.text().catch(() => '');
  if (raw.length > 4000) return new NextResponse(null, { status: 413 });
  const ip = ((req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim();
  if (limited(ip)) return new NextResponse(null, { status: 429 });
  let b: any = {};
  try {
    b = JSON.parse(raw || '{}');
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const message = s(b.message, 400);
  const path = s(b.path, 300);
  if (!message || !path.startsWith('/')) return new NextResponse(null, { status: 400 });
  reportEvent('page', `browser ${s(b.where, 60) || 'error'}`, message, {
    path,
    context: { stack: s(b.stack, 600), digest: s(b.digest, 60), ua: s(req.headers.get('user-agent'), 160) },
  });
  return new NextResponse(null, { status: 204 });
}
