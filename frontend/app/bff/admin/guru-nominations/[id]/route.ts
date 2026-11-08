import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';
import { backendFetch } from '@/lib/server/session';
import { COUNCIL_GATE_TAG } from '@/lib/server/council-gate';
import { adminGetGuruNomination, nominationsFetch, relayNomination } from '@/lib/server/guru-nominations';

// Admin step on a website Guru nomination (CSRF-guarded + admin-only). The backend enforces the
// allowed order of steps. Before "publish" we confirm the linked Council profile really exists
// on the main backend, so publishing never points the public page at a missing profile.
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const action = str(raw?.action, 40);

  if (action === 'publish') {
    const n = await adminGetGuruNomination(guard.user, id);
    if (n?.council_handle) {
      const r = await backendFetch(`/council/members/${encodeURIComponent(n.council_handle)}`).catch(() => null);
      if (!r || !r.ok) {
        return NextResponse.json(
          { ok: false, error: `There is no active Council profile at /council/${n.council_handle} yet. Create it (and make it active) in Council Roster, then publish.` },
          { status: 409 },
        );
      }
    }
  }

  const c = raw?.consent && typeof raw.consent === 'object' ? raw.consent : null;
  const body = {
    action,
    note: str(raw?.note, 1200),
    question: str(raw?.question, 2400),
    handle: str(raw?.handle, 120),
    consent: c ? { accepted_on: str(c.accepted_on, 10), channel: str(c.channel, 20), photo_ok: c.photo_ok === true, note: str(c.note, 1200) } : null,
  };

  let up: Response;
  try {
    up = await nominationsFetch(`/admin/item/${encodeURIComponent(id)}`, guard.user, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Nominations are unavailable right now.' }, { status: 502 });
  }
  if (up.ok) {
    // Linking, publishing, unpublishing or archiving can change who is visible on /council.
    revalidateTag(COUNCIL_GATE_TAG, { expire: 0 });
    revalidatePath('/app/admin/nominations');
  }
  return relayNomination(up, 'Could not update the nomination.');
}
