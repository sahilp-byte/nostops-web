import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { badOrigin } from '@/lib/server/bff';
import { putObject, STORAGE_PREFIX } from '@/lib/server/object-storage';
import { IMAGE_EXT, declaredImageType, verifiedImageType } from '@/lib/server/image-upload';

export const runtime = 'nodejs';

// PUBLIC (no login) venue-photo upload for the free "List your venue" form.
// The client auto-shrinks each image to a JPEG data-URI under 1 MB; here we
// decode it, enforce a 1 MB hard cap + allowed type (checked from the bytes, TVR-15),
// store it in Emergent Object Storage under a public namespace, and return the same-origin
// read URL (served by /bff/media/**) to persist in the submission's photos[]. CSRF is
// enforced by the origin check; a coarse per-IP throttle blocks abuse.
const TYPE_ERROR = 'Please use a JPG, PNG or WebP image.';
const MAX_BYTES = 1_048_576; // 1 MB hard cap

// In-memory per-IP burst limit (resets on redeploy — fine as a coarse gate).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20; // 2 photos/submission + retries
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return (xff.split(',')[0] || '').trim().slice(0, 64) || 'unknown';
}

function throttled(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  if (throttled(clientIp(req))) {
    return NextResponse.json({ error: "You've uploaded a lot of photos recently — please try again later." }, { status: 429 });
  }

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
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Each photo must be 1 MB or smaller. Please pick a smaller image.' }, { status: 400 });
  const type = verifiedImageType(buf, declared);
  if (!type) return NextResponse.json({ error: TYPE_ERROR }, { status: 400 });

  const path = `${STORAGE_PREFIX}/public-submissions/${randomUUID()}.${IMAGE_EXT[type]}`;
  try {
    await putObject(path, buf, type);
  } catch {
    return NextResponse.json({ error: 'Could not save your photo. Please try again.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: `/bff/media/${path.replace(/^nostops\//, '')}` });
}
