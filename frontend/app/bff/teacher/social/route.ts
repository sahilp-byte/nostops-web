import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Update the teacher's social handles. Forwards to PUT /teachers/me/social.
const KEYS = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'website'] as const;

export async function PUT(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'No links supplied.' }, { status: 400 });

  const social: Record<string, string> = {};
  for (const k of KEYS) if (typeof body[k] === 'string') social[k] = body[k].trim();

  const up = await backendFetch('/teachers/me/social', { method: 'PUT', body: JSON.stringify(social) });
  if (!up.ok) {
    const d = await up.json().catch(() => null);
    return NextResponse.json({ error: toErrorText(d?.detail || d?.message, 'Could not save your social links.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
