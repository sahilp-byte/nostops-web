// Teacher self-declaration of a Yogic Paramparā affiliation (CSRF-guarded).
// The teacher_id is ALWAYS derived server-side from the authenticated session's
// teacher handle — never from the client — and the affiliation is recorded as
// UNVERIFIED / pending review. Teachers can never self-verify a lineage.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePulseUser } from '@/lib/server/pulse';
import { kgAdminFetch } from '@/lib/server/knowledge';

export async function POST(req: NextRequest) {
  const guard = await requirePulseUser(req);
  if (!guard.ok) return guard.res;
  if (guard.actor.role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can declare a tradition.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Identity is never trusted from the client: requirePulseUser has already
  // resolved the teacher's own LIVE public handle. Fall back to the user id.
  const handle = String(guard.actor.handle || guard.actor.user_id || '').trim();
  if (!handle) return NextResponse.json({ error: 'No teacher handle on this account.' }, { status: 400 });

  const payload = {
    teacher_id: handle,
    parampara_id: String(body.parampara_id || ''),
    relationship_type: String(body.relationship_type || 'Teacher-declared'),
    guru_name: body.guru_name ? String(body.guru_name) : null,
    guru_guru_name: body.guru_guru_name ? String(body.guru_guru_name) : null,
    city_id: body.city_id ? String(body.city_id) : null,
    training_institution: body.training_institution ? String(body.training_institution) : null,
    years_of_training: typeof body.years_of_training === 'number' ? body.years_of_training : undefined,
    certification: body.certification ? String(body.certification) : null,
    practices_learned: Array.isArray(body.practices_learned) ? body.practices_learned.map(String) : [],
    practices_taught: Array.isArray(body.practices_taught) ? body.practices_taught.map(String) : [],
    scriptures_studied: Array.isArray(body.scriptures_studied) ? body.scriptures_studied.map(String) : [],
    evidence_document: body.evidence_document ? String(body.evidence_document) : null,
    notes: body.notes ? String(body.notes) : null,
  };
  if (!payload.parampara_id) return NextResponse.json({ error: 'parampara_id is required.' }, { status: 400 });

  const upstream = await kgAdminFetch('/teacher-parampara', {
    method: 'POST', body: payload,
    actor: { user_id: guard.actor.user_id, role: guard.actor.role, name: guard.actor.name },
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
