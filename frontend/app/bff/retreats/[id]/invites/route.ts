import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch, getSessionUser } from '@/lib/server/session';

// PROMPT 18 — Group booking invitation system. The host adds people they want in
// their cohort (name + optional WhatsApp). Backend stores each as an invite that
// can then be marked "invited" and shared. Host-only; CSRF double-submit enforced.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const raw = Array.isArray(b?.invitees) ? b.invitees : [];
  const invitees = raw
    .map((i: any) => {
      const name = String(i?.name || '').trim().slice(0, 120);
      const whatsapp = String(i?.whatsapp || '').replace(/[^\d+]/g, '').slice(0, 20);
      const note = i?.note ? String(i.note).slice(0, 200) : undefined;
      const out: Record<string, unknown> = { name, whatsapp };
      if (note) out.note = note;
      return out;
    })
    .filter((i: any) => typeof i.name === 'string' && i.name.length >= 2)
    .slice(0, 50);

  if (!invitees.length) return NextResponse.json({ error: 'Add at least one name.' }, { status: 400 });
  // The backend requires a WhatsApp number per invitee (that's how the invite is sent).
  const missingWa = invitees.find((i: any) => String(i.whatsapp || '').replace(/\D/g, '').length < 8);
  if (missingWa) return NextResponse.json({ error: 'Add a WhatsApp number (with country code) for each person so they can receive the invite.' }, { status: 400 });

  const up = await backendFetch(`/retreats/${encodeURIComponent(id)}/invites`, {
    method: 'POST',
    body: JSON.stringify({ invitees }),
  });
  const d = await up.json().catch(() => ({}));
  if (!up.ok) {
    return NextResponse.json({ error: toErrorText((d as any)?.detail, 'Could not add invitees.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, added: (d as any)?.added ?? invitees.length, invite_ids: (d as any)?.invite_ids ?? [] });
}
