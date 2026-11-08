import 'server-only';
import { NextResponse } from 'next/server';
import { actorHeader } from '@/lib/server/local-admin';
import { testTagHeaders } from '@/lib/server/test-tag';
import { toErrorText } from '@/lib/server/bff';
import type { User } from '@/lib/roles';

// Admin side of backend/site_curation.py (featured teachers + website removals). The shared secret
// and the admin identity are added here from the httpOnly session — never from browser input.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export function curationAdminFetch(path: string, user: User, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Pulse-Secret': SECRET,
    'X-Pulse-User': actorHeader(user),
    ...testTagHeaders(),
  };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}/api/site-curation${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
}

export async function relayCuration(up: Response, fallback: string): Promise<NextResponse> {
  const data = await up.json().catch(() => ({}));
  if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail, fallback) }, { status: up.status });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, private' } });
}
