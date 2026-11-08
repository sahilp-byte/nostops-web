// AI 2-line summary for a NOSTOPS Voices article. CSRF-guarded + signed-in.
// Forwards the author's title + article body to the internal AI service (which
// holds the LLM key) and returns a crisp summary. Nothing is stored here.
import { testTagHeaders } from '@/lib/server/test-tag';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';

const AI_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === 'string' ? body.title : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (content.length < 20) {
    return NextResponse.json({ error: 'Write a little more of your article first, then generate a summary.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${AI_BASE}/api/ai/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      body: JSON.stringify({ title: title.slice(0, 200), content: content.slice(0, 40000) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json({ error: data?.detail || 'AI could not write a summary right now.' }, { status: upstream.status });
    }
    return NextResponse.json({ summary: data?.summary || '' });
  } catch {
    return NextResponse.json({ error: 'AI is taking too long. Please try again.' }, { status: 504 });
  }
}
