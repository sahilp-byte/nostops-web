import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { searchTeachers } from '@/lib/server/guru';

// Read-only teacher search for the editorial picker. Council-only. GET, so no
// CSRF is required, but the session must belong to a council member.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || normalizeRole(user.role) !== 'council') {
    return NextResponse.json({ teachers: [] }, { status: 403 });
  }
  const q = req.nextUrl.searchParams.get('q') || '';
  const teachers = await searchTeachers(q);
  return NextResponse.json({ teachers });
}
