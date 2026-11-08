// Unified Verification + Empanelment — teacher-facing writes. CSRF-guarded;
// forwards to the ISOLATED local engine with the server-only shared secret and
// an identity built from the httpOnly session. The browser never holds the
// secret and cannot set verification/empanelment status directly.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { verificationActor, verificationFetch } from '@/lib/server/verification';
import { getTeacherSelfProfile } from '@/lib/server/teacher';

const TEACHER_ROLES = new Set(['teacher', 'admin', 'council', 'coordinator']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!TEACHER_ROLES.has(normalizeRole(user.role))) {
    return NextResponse.json({ error: 'Teachers only.' }, { status: 403 });
  }
  const { action } = await params;
  const actor = verificationActor(user);
  const body = await req.json().catch(() => ({}));

  // Resolve the teacher's current application server-side (never trust the browser).
  async function myAppId(): Promise<string | null> {
    try {
      const r = await verificationFetch('/application/me', { actor });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.application?.application_id ?? null;
    } catch {
      return null;
    }
  }

  try {
    if (action === 'create') {
      // Begin a verification application (country/level derived from the profile).
      let country = 'India';
      let level: string | undefined;
      try {
        const { self } = await getTeacherSelfProfile();
        country = self?.country || 'India';
        level = self?.badgePrimary;
      } catch { /* defaults */ }
      const r = await verificationFetch('/application', {
        method: 'POST', actor,
        body: { country, teacher_level: level, teacher_handle: (body?.teacher_handle as string) || undefined },
      });
      const d = await r.json().catch(() => ({}));
      return NextResponse.json(d, { status: r.status });
    }

    if (action === 'didit-session') {
      const r = await verificationFetch('/didit/session', { method: 'POST', actor });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return NextResponse.json({ error: d?.detail || 'Could not start identity verification.' }, { status: r.status });
      return NextResponse.json({ url: d?.url, session_id: d?.session_id });
    }

    if (action === 'assess') {
      const id = await myAppId();
      if (!id) return NextResponse.json({ error: 'No application found.' }, { status: 400 });
      let profileComplete = false;
      try { const { self } = await getTeacherSelfProfile(); profileComplete = !!(self && self.handle); } catch { /* ignore */ }
      const r = await verificationFetch(`/application/${id}/empanelment/assess`, {
        method: 'POST', actor, body: { profile_complete: profileComplete },
      });
      const d = await r.json().catch(() => ({}));
      return NextResponse.json(d, { status: r.status });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
