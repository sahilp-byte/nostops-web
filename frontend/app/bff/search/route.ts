import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiGet } from '@/lib/api';
import { isTeacherActivePublic } from '@/lib/public-teacher';
import { backendFetch } from '@/lib/server/session';

// Header search proxy → GET /api/search?q=&limit=. Read-only; no CSRF needed.
// The backend search has no notion of retired demo/test profiles, so teacher hits
// are kept only when they pass the SAME rule as the public profile page they link
// to (isTeacherActivePublic over the directory). Fails closed: no directory → no
// teacher hits. Only the groups the header search renders are returned, so other
// groups (e.g. retreats hosted by retired demo profiles) are never disclosed here.
async function listedHandles(): Promise<Set<string> | null> {
  try {
    const d = await apiGet<{ teachers?: any[] }>('/teachers/directory?limit=1000', { revalidate: 60 });
    return new Set((Array.isArray(d?.teachers) ? d.teachers : []).filter(isTeacherActivePublic).map((t) => String(t.handle)));
  } catch {
    return null;
  }
}

const handleOf = (it: any) => String(it?.route || '').split('/').filter(Boolean).pop() || '';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ q: '', results: {}, total: 0 });
  const [up, listed] = await Promise.all([backendFetch(`/search?q=${encodeURIComponent(q)}&limit=6`), listedHandles()]);
  if (!up.ok) return NextResponse.json({ q, results: {}, total: 0 }, { status: up.status || 502 });
  const data = await up.json().catch(() => null);
  const res = data?.results || {};
  const teachers = (Array.isArray(res.teachers) ? res.teachers : []).filter((it: any) => listed?.has(handleOf(it)));
  const councilGurus = Array.isArray(res.council_gurus) ? res.council_gurus : [];
  return NextResponse.json({
    q,
    results: { teachers, council_gurus: councilGurus },
    total: teachers.length + councilGurus.length,
  });
}
