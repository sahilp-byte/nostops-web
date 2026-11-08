import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

// Update the signed-in teacher's own record. Forwards a whitelisted patch to
// the authed backend PATCH /teachers/me/profile (bearer from the httpOnly
// cookie). Availability toggling reuses this route with { is_available }.
const STRING_FIELDS = ['name', 'bio', 'city', 'phone', 'parampara', 'root_guru_name', 'root_guru_location', 'lineage_declaration'] as const;
const STRING_ARRAY_FIELDS = ['styles', 'specializations', 'languages_spoken', 'yoga_dimensions', 'paramparas'] as const;

export async function PATCH(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const f of STRING_FIELDS) if (typeof body[f] === 'string') patch[f] = body[f].trim();
  for (const f of STRING_ARRAY_FIELDS)
    if (Array.isArray(body[f])) patch[f] = body[f].filter((x: unknown) => typeof x === 'string');
  if (typeof body.experience_years === 'number') patch.experience_years = body.experience_years;
  if (typeof body.is_available === 'boolean') patch.is_available = body.is_available;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });

  const up = await backendFetch('/teachers/me/profile', { method: 'PATCH', body: JSON.stringify(patch) });
  if (!up.ok) {
    const d = await up.json().catch(() => null);
    return NextResponse.json({ error: toErrorText(d?.detail || d?.message, 'Could not update your profile.') }, { status: up.status || 502 });
  }
  const d = await up.json().catch(() => ({}));
  return NextResponse.json({ ok: true, fields_updated: d?.fields_updated ?? 0 });
}
