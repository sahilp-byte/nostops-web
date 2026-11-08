import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

const AI_BIO_TIMEOUT_MS = 45000;

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arrStr = (v: unknown) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()).slice(0, 40) : [];

// AI-assisted bio draft for the onboarding wizard. CSRF-guarded proxy to
// POST /teachers/ai-bio-suggest (the backend owns the LLM). Returns { bio }.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const tone = ['warm', 'professional', 'humble'].includes(raw?.tone) ? raw.tone : 'warm';
  const body = {
    name: str(raw?.name, 120),
    city: str(raw?.city, 120),
    experience_years: Math.max(0, Math.floor(Number(raw?.experience_years) || 0)),
    parampara_name: str(raw?.parampara_name, 120),
    styles: arrStr(raw?.styles),
    specializations: arrStr(raw?.specializations),
    languages: arrStr(raw?.languages),
    tone,
  };

  // The backend drafts the bio with an LLM (~5 s typical, slower under load), so
  // this call gets its own budget instead of the 10 s default. A timeout or
  // network failure returns a clear JSON error instead of crashing the route.
  let up: Response;
  try {
    up = await backendFetch('/teachers/ai-bio-suggest', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AI_BIO_TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
    return NextResponse.json(
      { error: timedOut ? 'The AI helper is taking longer than usual. Please try again, or write your own.' : 'Could not draft a bio right now.' },
      { status: timedOut ? 504 : 502 },
    );
  }
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    // Upstream 5xx / edge 52x codes are not passed through (the preview edge
    // swaps 52x for an HTML page): answer with a JSON 504 for timeouts, else 502.
    const status = up.status >= 500 ? (up.status === 504 || up.status === 524 ? 504 : 502) : up.status || 502;
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not draft a bio right now.') }, { status });
  }
  return NextResponse.json({ ok: true, bio: str(data?.bio, 2000) });
}
