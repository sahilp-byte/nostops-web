import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { nominationsFetch, relayNomination } from '@/lib/server/guru-nominations';

// Submit a Guru nomination (Phase 1). Signed-in members only (owner decision); CSRF-guarded.
// The nominator's identity comes from the httpOnly session, never from the request body.
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ ok: false, error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in to nominate a Guru.' }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const decades = Number(raw?.nominee_decades);
  const body = {
    nominee_name: str(raw?.nominee_name, 200),
    nominee_lineage: str(raw?.nominee_lineage, 400),
    nominee_city: str(raw?.nominee_city, 200),
    nominee_decades: Number.isInteger(decades) && decades >= 1 && decades <= 10 ? decades : null,
    nominee_email: str(raw?.nominee_email, 300),
    nominee_phone: str(raw?.nominee_phone, 60),
    relationship: str(raw?.relationship, 300),
    citation: str(raw?.citation, 2400),
    references: str(raw?.references, 1200),
    nominator_phone: str(raw?.nominator_phone, 60),
    confirm: raw?.confirm === true,
  };

  let up: Response;
  try {
    up = await nominationsFetch('/submit', user, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Nominations are unavailable right now. Please try again shortly.' }, { status: 502 });
  }
  return relayNomination(up, 'Could not send your nomination.');
}
