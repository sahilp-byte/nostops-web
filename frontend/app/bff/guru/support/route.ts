// Create a Support Request from the Ask AI Guru chat. Stateless-token CSRF (same
// as the chat). The signed-in user's email/name/role are taken from the httpOnly
// session (trusted); anonymous users must supply an email. The AI conversation +
// page context are captured so the human never asks the user to repeat themselves.
import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyGuruToken } from '@/lib/server/guru-csrf';
import { getSessionUser } from '@/lib/server/session';

const AI_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  if (!verifyGuruToken(req.headers.get('x-guru-csrf'))) {
    return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category.trim() : '';
  const issue = typeof body?.issue === 'string' ? body.issue.trim() : '';
  if (!category || !issue) {
    return NextResponse.json({ error: 'Please choose a category and describe the issue.' }, { status: 400 });
  }

  const user = await getSessionUser();
  const email = (user?.email || (typeof body?.email === 'string' ? body.email.trim() : '')).slice(0, 200);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please provide a valid email so we can reach you.' }, { status: 400 });
  }
  const name = (user?.name || (typeof body?.name === 'string' ? body.name.trim() : '') || '').slice(0, 120) || undefined;
  const role = user?.role ? String(user.role).toLowerCase() : undefined;

  const conversation: Turn[] = Array.isArray(body?.conversation)
    ? body.conversation
        .filter((t: any) => (t?.role === 'user' || t?.role === 'assistant') && typeof t?.content === 'string' && t.content.trim())
        .slice(-20)
        .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 4000) }))
    : [];

  const cin = body?.context && typeof body.context === 'object' ? body.context : {};
  const context: Record<string, unknown> = {};
  for (const k of ['page_type', 'route', 'journey', 'event_slug'] as const) {
    if (typeof cin[k] === 'string' && cin[k].trim()) context[k] = String(cin[k]).slice(0, 120);
  }
  context.authenticated = !!user;
  if (role) context.role = role;

  try {
    const upstream = await fetch(`${AI_BASE}/api/guru/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      body: JSON.stringify({
        email,
        name,
        role,
        category,
        issue: issue.slice(0, 4000),
        summary: typeof body?.summary === 'string' ? body.summary.slice(0, 500) : undefined,
        conversation,
        context,
        reference: typeof body?.reference === 'string' ? body.reference.slice(0, 200) : undefined,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json({ error: data?.detail || 'Could not create your request. Please try again.' }, { status: upstream.status || 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Could not reach support just now. Please try again.' }, { status: 504 });
  }
}
