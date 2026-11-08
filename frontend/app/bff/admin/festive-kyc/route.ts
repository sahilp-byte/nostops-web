import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { festiveFetch, relayFestive } from '@/lib/server/festive-kyc';

// Admin: every festive InstaKYC claim + the audit trail (read-only).
export async function GET() {
  const user = await getSessionUser();
  if (!user || normalizeRole(user.role) !== 'admin') return NextResponse.json({ ok: false, error: 'Admins only.' }, { status: 403 });
  try {
    return await relayFestive(await festiveFetch('/admin/claims', user), 'Could not load claims.');
  } catch {
    return NextResponse.json({ ok: false, error: 'Unavailable right now.' }, { status: 502 });
  }
}
