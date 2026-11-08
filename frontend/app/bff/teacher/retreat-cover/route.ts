import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { getHostEligibility } from '@/lib/server/retreat-host';
import { putObject, STORAGE_PREFIX } from '@/lib/server/object-storage';
import { IMAGE_EXT, declaredImageType, verifiedImageType } from '@/lib/server/image-upload';

export const runtime = 'nodejs';

// Upload a retreat cover/hero photo (host-only). The client compresses to a JPEG
// data-URI first; we decode, check the bytes really are that image type (TVR-15), store it
// in Emergent Object Storage under the host's namespace, and return the same-origin public
// read URL to persist as cover_image.
const TYPE_ERROR = 'Please use a JPG, PNG or WebP image.';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  // Only eligible retreat hosts may upload a cover.
  const elig = await getHostEligibility();
  if (!elig.eligible) return NextResponse.json({ error: 'Only retreat hosts can upload a cover.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const raw = typeof body?.base64 === 'string' ? body.base64 : '';
  if (!raw) return NextResponse.json({ error: 'No image supplied.' }, { status: 400 });

  // Accept a data-URI (data:image/jpeg;base64,....) or bare base64 (+ contentType).
  let contentType = typeof body?.contentType === 'string' ? body.contentType : 'image/jpeg';
  let b64 = raw;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(raw);
  if (m) { contentType = m[1]; b64 = m[2]; }
  const declared = declaredImageType(contentType);
  if (!declared) return NextResponse.json({ error: TYPE_ERROR }, { status: 400 });

  let buf: Buffer;
  try { buf = Buffer.from(b64, 'base64'); } catch { return NextResponse.json({ error: 'Could not read that image.' }, { status: 400 }); }
  if (buf.length < 100) return NextResponse.json({ error: 'Could not read that image.' }, { status: 400 });
  if (buf.length > 5_000_000) return NextResponse.json({ error: 'Image is too large. Please pick a smaller photo.' }, { status: 400 });
  const type = verifiedImageType(buf, declared);
  if (!type) return NextResponse.json({ error: TYPE_ERROR }, { status: 400 });

  const uid = String((user as any).user_id || (user as any).id || 'host');
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'host';
  const path = `${STORAGE_PREFIX}/${safeUid}/${randomUUID()}.${IMAGE_EXT[type]}`;
  try {
    await putObject(path, buf, type);
  } catch {
    return NextResponse.json({ error: 'Could not save your photo. Please try again.' }, { status: 502 });
  }
  // The media proxy re-attaches the `nostops/` app namespace, so the public URL
  // is the path WITHOUT it (…/retreats/{uid}/{uuid}.ext).
  return NextResponse.json({ ok: true, url: `/bff/media/${path.replace(/^nostops\//, '')}` });
}
