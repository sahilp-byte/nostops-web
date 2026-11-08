import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';

// Collect beta feedback (works for anonymous public visitors AND signed-in
// users). Forwards to POST /beta/feedback. If a session cookie exists,
// backendFetch attaches the bearer so the backend can link the persona;
// otherwise it posts anonymously. CSRF double-submit is intentionally NOT
// required here: this endpoint is low-risk, non-sensitive, and must work on
// public (cookie-less) marketing pages. Input is validated + size-capped.
const CATEGORIES = new Set(['bug', 'idea', 'praise', 'confusing', 'other']);

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  const message = typeof b?.message === 'string' ? b.message.trim() : '';
  if (message.length < 3) {
    return NextResponse.json({ error: 'Please share a little more detail.' }, { status: 400 });
  }

  const payload: Record<string, unknown> = { message: message.slice(0, 4000) };
  const category = typeof b?.category === 'string' ? b.category.toLowerCase() : '';
  if (CATEGORIES.has(category)) payload.category = category;
  if (typeof b?.contact_email === 'string' && b.contact_email.includes('@')) {
    payload.contact_email = b.contact_email.trim().slice(0, 200);
  }
  for (const k of ['screen', 'persona', 'viewport', 'device_platform', 'app_version']) {
    if (typeof b?.[k] === 'string' && b[k]) payload[k] = String(b[k]).slice(0, 120);
  }

  try {
    const up = await backendFetch('/beta/feedback', { method: 'POST', body: JSON.stringify(payload) });
    if (!up.ok) return NextResponse.json({ error: 'Could not send your feedback. Please try again.' }, { status: up.status || 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not send your feedback. Please try again.' }, { status: 502 });
  }
}
