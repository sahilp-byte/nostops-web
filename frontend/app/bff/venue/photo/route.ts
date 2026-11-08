import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { putObject, STORAGE_PREFIX } from '@/lib/server/object-storage';
import { IMAGE_EXT, declaredImageType, verifiedImageType } from '@/lib/server/image-upload';

export const runtime = 'nodejs';

// Upload a venue photo for a venue owner (max 5 managed by the client). The
// client compresses to a JPEG data-URI first; we decode, check the bytes really are that
// image type (TVR-15), store it in Emergent Object Storage under the owner's namespace, and
// return the same-origin public read URL (served by /bff/media/**) to persist in the venue's
// photos[] via PATCH.
const TYPE_ERROR = 'Please use a JPG, PNG or WebP image.';

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw = typeof body?.base64 === 'string' ? body.base64 : '';
  if (!raw) return NextResponse.json({ error: 'No image supplied.' }, { status: 400 });

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

  const uid = String((user as { user_id?: unknown; id?: unknown }).user_id || (user as { id?: unknown }).id || 'owner');
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'owner';
  const path = `${STORAGE_PREFIX}/${safeUid}/${randomUUID()}.${IMAGE_EXT[type]}`;
  try {
    await putObject(path, buf, type);
  } catch {
    return NextResponse.json({ error: 'Could not save your photo. Please try again.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: `/bff/media/${path.replace(/^nostops\//, '')}` });
}
