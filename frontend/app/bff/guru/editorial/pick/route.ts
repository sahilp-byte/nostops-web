import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Make an editorial pick (Teacher of the Month / Featured Teacher of the Week).
// CSRF-guarded proxy to POST /council/editorial/pick with a whitelisted body.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const type = raw?.type === 'featured_teacher_week' || raw?.type === 'teacher_of_month' ? raw.type : '';
  const teacherId = typeof raw?.teacher_id === 'string' ? raw.teacher_id.trim() : '';
  const citation = typeof raw?.citation === 'string' ? raw.citation.trim() : '';

  if (!type) return NextResponse.json({ error: 'Choose a slot to fill.' }, { status: 400 });
  if (!teacherId) return NextResponse.json({ error: 'Pick a teacher first.' }, { status: 400 });
  if (citation.length < 10) return NextResponse.json({ error: 'Write at least 10 characters explaining your pick.' }, { status: 400 });

  const up = await backendFetch('/council/editorial/pick', {
    method: 'POST',
    body: JSON.stringify({ type, teacher_id: teacherId, citation: citation.slice(0, 600) }),
  });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not save pick.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true });
}
