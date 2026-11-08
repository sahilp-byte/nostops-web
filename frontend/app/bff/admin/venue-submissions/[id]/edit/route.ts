import type { NextRequest } from 'next/server';
import { toErrorText } from '@/lib/server/bff';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server/session';
import { requireAdmin } from '@/lib/server/admin-guard';
import { editLocalSubmission } from '@/lib/server/venue-submissions-local';

// Admin edit/enrich a venue submission before publication (PROMPT 31). CSRF +
// admin only. Remote-first PATCH (retains provenance); on 404/unreachable it
// falls back to the LOCAL store so edits persist today — flips to remote when it ships.
const ALLOWED_FIELDS = ['venue_name', 'venue_type', 'city', 'state', 'address', 'website_or_maps_url', 'google_business_url', 'description', 'capacity'];
const URL_FIELDS = new Set(['website_or_maps_url', 'google_business_url']);
// A photo is kept only if it's one of our own stored media URLs or an absolute
// http(s) URL — blocks javascript:/data: or other unsafe values being injected.
const isSafePhoto = (u: string) => /^\/bff\/media\//.test(u) || /^https?:\/\//i.test(u);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Unknown submission.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] === undefined || body[f] === null || body[f] === '') continue;
    if (URL_FIELDS.has(f)) {
      const raw = String(body[f]).trim().slice(0, 400);
      const low = raw.toLowerCase();
      if (!low.startsWith('http://') && !low.startsWith('https://')) {
        return NextResponse.json({ error: 'Enter a valid http(s) link (for example a Google Maps URL).', field: f }, { status: 400 });
      }
      patch[f] = raw;
    } else {
      patch[f] = f === 'capacity' ? Number(body[f]) : String(body[f]).slice(0, 4000);
    }
  }
  // Photo curation: an explicit array (even empty) replaces the stored photos.
  if (Array.isArray(body.photos)) {
    patch.photos = body.photos
      .filter((x: unknown): x is string => typeof x === 'string')
      .map((x: string) => x.trim())
      .filter((x: string) => x.length > 0 && x.length <= 2000 && isSafePhoto(x))
      .slice(0, 5);
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  let up: Response | null = null;
  try {
    up = await backendFetch(`/admin/venue-submissions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  } catch {
    up = null;
  }
  if (up && up.status !== 404) {
    const data = await up.json().catch(() => ({}));
    if (!up.ok) return NextResponse.json({ error: toErrorText(data?.detail || data?.error, 'Could not save changes.') }, { status: up.status || 502 });
    return NextResponse.json({ ok: true, ...data });
  }

  // Remote not live (404) or unreachable → local fallback store.
  const local = await editLocalSubmission(id, patch);
  if (!local.ok) return NextResponse.json({ error: local.error || 'Could not save changes.' }, { status: local.status || 502 });
  return NextResponse.json({ ok: true });
}
