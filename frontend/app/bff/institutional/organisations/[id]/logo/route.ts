// Institutional engine — Organisation LOGO upload. CSRF-guarded. The client
// sends a compressed data-URI; we store it in Emergent Object Storage under the
// org namespace, then PATCH the organisation's reusable logo_url (so it is
// uploaded ONCE and reused for every future event). Authorised members only
// (the PATCH is enforced by the engine).
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { badOrigin, errorMessage } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { putObject, STORAGE_PREFIX } from '@/lib/server/object-storage';
import { institutionalActor, institutionalFetch } from '@/lib/server/institutional';
import { IMAGE_EXT, declaredImageType, verifiedImageType } from '@/lib/server/image-upload';

export const runtime = 'nodejs';

// TVR-15 — the logo's bytes must really be the declared image type before it is stored.
const TYPE_ERROR = 'Please use a PNG, JPG or WebP image.';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const raw = typeof body?.base64 === 'string' ? body.base64 : '';
  if (!raw) return NextResponse.json({ error: 'No image supplied.' }, { status: 400 });

  let contentType = typeof body?.contentType === 'string' ? body.contentType : 'image/png';
  let b64 = raw;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(raw);
  if (m) { contentType = m[1]; b64 = m[2]; }
  const declared = declaredImageType(contentType);
  if (!declared) return NextResponse.json({ error: TYPE_ERROR }, { status: 400 });

  let buf: Buffer;
  try { buf = Buffer.from(b64, 'base64'); } catch { return NextResponse.json({ error: 'Could not read that image.' }, { status: 400 }); }
  if (buf.length < 50) return NextResponse.json({ error: 'Could not read that image.' }, { status: 400 });
  if (buf.length > 2_500_000) return NextResponse.json({ error: 'Logo is too large (max ~2MB).' }, { status: 400 });
  const type = verifiedImageType(buf, declared);
  if (!type) return NextResponse.json({ error: TYPE_ERROR }, { status: 400 });

  const safeOrg = String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'org';
  const path = `${STORAGE_PREFIX}/orgs/${safeOrg}/${randomUUID()}.${IMAGE_EXT[type]}`;
  try {
    await putObject(path, buf, type);
  } catch {
    return NextResponse.json({ error: 'Could not save your logo. Please try again.' }, { status: 502 });
  }
  const url = `/bff/media/${path.replace(/^nostops\//, '')}`;

  // Persist the logo on the reusable Organisation Profile.
  try {
    const r = await institutionalFetch(`/organisations/${encodeURIComponent(id)}`, {
      method: 'PATCH', actor: institutionalActor(user), body: { logo_url: url },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: errorMessage(d, 'Uploaded, but could not save to your profile.') }, { status: r.status });
    return NextResponse.json({ ok: true, url, organisation: d.organisation });
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
