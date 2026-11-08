import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { nominationsFetch, relayNomination } from '@/lib/server/guru-nominations';

// The nominator's own actions on a nomination: answer the admin's question, or withdraw.
// The backend only finds nominations owned by the signed-in user (404 otherwise).
const ACTIONS = new Set(['reply', 'withdraw']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ ok: false, error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });

  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const action = String(raw?.action || '');
  if (!id || !ACTIONS.has(action)) return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });

  let up: Response;
  try {
    up = await nominationsFetch(`/${encodeURIComponent(id)}/mine`, user, {
      method: 'POST',
      body: JSON.stringify({ action, text: typeof raw?.text === 'string' ? raw.text.slice(0, 2400) : '' }),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Nominations are unavailable right now.' }, { status: 502 });
  }
  if (up.ok) revalidatePath('/app/nominations');
  return relayNomination(up, 'Could not update the nomination.');
}
