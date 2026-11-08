import 'server-only';
import { NextResponse } from 'next/server';
import { actorHeader } from '@/lib/server/local-admin';
import { testTagHeaders } from '@/lib/server/test-tag';
import { toErrorText } from '@/lib/server/bff';
import type { User } from '@/lib/roles';

// Server-only access to the local intro-video library (backend/intro_videos.py → Cloudflare R2).
// The shared secret and the viewer identity are added here from the httpOnly session — never from
// browser input. R2 credentials never reach this layer: they live only in the backend.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export const INTRO_VIDEO_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_ID_RE = /^iv_[0-9a-f]{16}$/;

export function introVideoFetch(path: string, user: User | null, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() };
  if (user) headers['X-Pulse-User'] = actorHeader(user);
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}/api/intro-videos${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
}

/** Relay the backend's JSON answer; errors become `{ error }` (same contract as the other BFF routes). */
export async function relay(up: Response, fallback: string): Promise<NextResponse> {
  const data = await up.json().catch(() => ({}));
  const headers = { 'Cache-Control': 'no-store, private' };
  if (!up.ok) {
    const body: Record<string, unknown> = { error: toErrorText(data?.detail, fallback) };
    if (data?.code) body.code = data.code;
    if (data?.existing_id) body.existing_id = data.existing_id;
    return NextResponse.json(body, { status: up.status, headers });
  }
  return NextResponse.json(data, { headers });
}

export const unavailable = () => NextResponse.json({ error: 'The video library is unavailable right now.' }, { status: 504 });
