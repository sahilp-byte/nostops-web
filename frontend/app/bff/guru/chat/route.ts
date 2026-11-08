// "Ask AI Guru" chat WRITE — CSRF-guarded proxy to the ISOLATED local product
// Guru (POST /api/guru/chat). The browser never holds the internal secret.
// The signed-in role + auth state are injected HERE from the httpOnly session —
// the client only supplies non-sensitive page context (route/page_type/event).
import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { verifyGuruToken } from '@/lib/server/guru-csrf';

const AI_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  // Stateless signed-token CSRF (works on every page incl. public + preview).
  if (!verifyGuruToken(req.headers.get('x-guru-csrf'))) {
    return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'Please type a message.' }, { status: 400 });

  // Sanitise client-supplied history (cap + shape).
  const history: Turn[] = Array.isArray(body?.history)
    ? body.history
        .filter((t: any) => (t?.role === 'user' || t?.role === 'assistant') && typeof t?.content === 'string' && t.content.trim())
        .slice(-12)
        .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 6000) }))
    : [];

  // Non-sensitive page context from the client.
  const cin = (body?.context && typeof body.context === 'object') ? body.context : {};
  const context: Record<string, unknown> = {};
  for (const k of ['page_type', 'route', 'journey', 'event_slug'] as const) {
    if (typeof cin[k] === 'string' && cin[k].trim()) context[k] = String(cin[k]).slice(0, 120);
  }
  if (cin.registration_open === true) context.registration_open = true;
  if (['company', 'educational', 'startup'].includes(cin.cohort)) context.cohort = cin.cohort;

  // Trusted auth/role — ALWAYS from the server session, never the client.
  const user = await getSessionUser();
  context.authenticated = !!user;
  if (user?.role) context.role = String(user.role).toLowerCase();

  try {
    const upstream = await fetch(`${AI_BASE}/api/guru/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      body: JSON.stringify({
        message: message.slice(0, 4000),
        history,
        context,
        session_id: typeof body?.session_id === 'string' ? body.session_id.slice(0, 80) : undefined,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.detail || 'Ask AI Guru is unavailable right now. Please try again.' },
        { status: upstream.status || 502 },
      );
    }
    return NextResponse.json({
      reply: typeof data?.reply === 'string' ? data.reply : '',
      ctas: Array.isArray(data?.ctas) ? data.ctas : [],
      session_id: data?.session_id ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Ask AI Guru is taking too long. Please try again.' }, { status: 504 });
  }
}
