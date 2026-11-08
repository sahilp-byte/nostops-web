import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arrStr = (v: unknown, max = 40) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => (x as string).trim()).slice(0, max) : [];

// Create the signed-in user's native teacher record. CSRF-guarded, whitelisted
// proxy to POST /teachers/native-register. The backend flips the account role to
// teacher and assigns a unique handle.
export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });

  const raw = await req.json().catch(() => ({}));
  const name = str(raw?.name, 120);
  const city = str(raw?.city, 120);
  if (!name) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  if (!city) return NextResponse.json({ error: 'Please enter your city.' }, { status: 400 });

  const paramparas = arrStr(raw?.paramparas);
  const yogaDimensions = arrStr(raw?.yoga_dimensions).filter((d) => ['body', 'mind', 'special_needs'].includes(d));
  const specializations = arrStr(raw?.specializations);
  if (paramparas.length === 0) return NextResponse.json({ error: 'Pick at least one lineage (parampara).' }, { status: 400 });
  if (yogaDimensions.length === 0) return NextResponse.json({ error: 'Pick at least one Yoga Dimension.' }, { status: 400 });
  if (specializations.length === 0) return NextResponse.json({ error: 'Pick at least one specialisation.' }, { status: 400 });

  const experience = Math.max(0, Math.floor(Number(raw?.experience_years) || 0));
  const body: Record<string, unknown> = {
    name,
    city,
    country: str(raw?.country, 80) || 'India',
    phone: str(raw?.phone, 20),
    languages_spoken: arrStr(raw?.languages_spoken),
    experience_years: experience,
    parampara: paramparas[0] || null,
    paramparas,
    styles: arrStr(raw?.styles),
    specializations,
    yoga_dimensions: yogaDimensions,
    bio: str(raw?.bio, 2000),
  };
  const sample = str(raw?.sample_video_url, 500);
  if (sample) body.sample_video_url = sample;
  const handle = str(raw?.preferred_handle, 60);
  if (handle) body.preferred_handle = handle;

  const up = await backendFetch('/teachers/native-register', { method: 'POST', body: JSON.stringify(body) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText(data?.detail, 'Could not create your teacher profile.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, handle: data?.teacher?.handle || handle || null });
}
