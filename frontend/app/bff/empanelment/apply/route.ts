import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getTeacherSelfProfile } from '@/lib/server/teacher';
import { getMyStanding } from '@/lib/server/empanelment-policy';
import { localAdminFetch } from '@/lib/server/local-admin';

// Policy V2 — the teacher asks for the Council interaction. Evidence is re-read
// from the main backend on the server first; the policy engine opens a case only
// when every merit item is met. Nothing is granted here.
const ERRORS: Record<string, string> = {
  merit_requirements_not_met: 'You can ask for the Council interaction once all four free-path items are met.',
  evidence_missing: 'We could not read your sessions and reviews right now. Please try again.',
  already_approved: 'Your empanelment has already been approved.',
  teachers_only: 'Only teachers can apply.',
};

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (normalizeRole(user.role) !== 'teacher') return NextResponse.json({ error: ERRORS.teachers_only }, { status: 403 });

  const { self } = await getTeacherSelfProfile();
  if (!self) return NextResponse.json({ error: ERRORS.evidence_missing }, { status: 409 });
  const standing = await getMyStanding(user, { teacherId: self.teacherId, handle: self.handle, name: self.name });
  if (!standing) return NextResponse.json({ error: ERRORS.evidence_missing }, { status: 502 });

  const up = await localAdminFetch('/api/empanelment-policy/me/apply', user, { method: 'POST', body: '{}' });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) return NextResponse.json({ error: ERRORS[String(data?.detail || '')] || 'Could not send your request.' }, { status: up.status || 502 });
  revalidatePath('/app/teacher/empanelment');
  return NextResponse.json({ ok: true, case: data.case ?? null });
}
