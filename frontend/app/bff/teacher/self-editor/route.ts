import { NextResponse } from 'next/server';
import { getTeacherSelfProfile, getCodex, getTeacherVideoIntro } from '@/lib/server/teacher';

// Owner-only editor payload for the PUBLIC teacher profile page. Reads the
// signed-in teacher's OWN record (bearer from the httpOnly cookie) and returns
// everything the inline editor needs in a single round-trip. The `handle` lets
// the client confirm the viewer actually owns the profile being viewed before
// exposing any edit affordances. Returns { handle: null } for anyone who is not
// an onboarded teacher (anonymous visitors, learners, etc.). GET = idempotent,
// no CSRF token required; force-dynamic + no-store so it always reflects the
// caller's own cookie and is never cached across users.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { onboarded, self, social } = await getTeacherSelfProfile();
  if (!onboarded || !self) {
    return NextResponse.json({ handle: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const [codex, video] = await Promise.all([getCodex(), getTeacherVideoIntro()]);
  return NextResponse.json(
    { handle: self.handle, self, social, codex, video },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
