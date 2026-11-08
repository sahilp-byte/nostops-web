import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getMyAuthorIdentity, upsertArticle } from '@/lib/server/voices';
import { ARTICLE_TYPES } from '@/lib/voices-shared';

// Teacher submits/saves their OWN NOSTOPS Voices article. CSRF-guarded. The
// author identity (teacher_id, name, handle, bio, avatar, city) is resolved
// SERVER-SIDE from the authoritative native profile — the client can never
// write as another teacher. Author-enablement is enforced by the backend.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const me = await getMyAuthorIdentity();
  if (!me) return NextResponse.json({ error: 'Only NOSTOPS teachers can write for NOSTOPS.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'No article supplied.' }, { status: 400 });

  const type = ARTICLE_TYPES.includes(body.type) ? body.type : 'Article';
  const payload = {
    id: typeof body.id === 'string' && body.id ? body.id : undefined,
    teacher_id: me.teacherId,
    author_name: me.name,
    author_handle: me.handle,
    author_bio: me.bio,
    author_avatar_url: me.avatarUrl,
    author_city: me.city,
    title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
    type,
    topic: typeof body.topic === 'string' ? body.topic.slice(0, 120) : '',
    source_language: typeof body.source_language === 'string' ? body.source_language : 'en',
    content_md: typeof body.content_md === 'string' ? body.content_md.slice(0, 40000) : '',
    summary: typeof body.summary === 'string' ? body.summary.slice(0, 320) : '',
    consent: body.consent === true,
    action: body.action === 'submit' ? 'submit' : 'draft',
  };

  const res = await upsertArticle(payload);
  if (!res.ok) return NextResponse.json({ error: res.error || 'Could not save the article.' }, { status: res.code || 502 });
  return NextResponse.json({ ok: true, id: res.id, slug: res.slug, status: res.status });
}
