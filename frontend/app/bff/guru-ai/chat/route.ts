import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// "Ask GuruAI" chat WRITE. CSRF-guarded proxy to the SAME backend the mobile app
// uses (single AI + single conversation store): POST /home/guru-ai/chat.
// Body: { message, session_id? }. Returns { session_id, reply, model }.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'Please type a message.' }, { status: 400 });

  const payload: Record<string, unknown> = { message };
  if (typeof body?.session_id === 'string' && body.session_id) payload.session_id = body.session_id;

  const up = await backendFetch('/home/guru-ai/chat', { method: 'POST', body: JSON.stringify(payload) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json(
      { error: toErrorText(data?.detail, 'GuruAI is unavailable right now. Please try again.') },
      { status: up.status || 502 },
    );
  }
  return NextResponse.json({
    session_id: data?.session_id ?? null,
    reply: typeof data?.reply === 'string' ? data.reply : '',
    model: data?.model ?? null,
  });
}
