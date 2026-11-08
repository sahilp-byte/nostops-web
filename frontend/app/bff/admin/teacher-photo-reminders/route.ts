import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { growthOrigin } from '@/lib/server/venue-growth';
import { getPhotoReminderData, photoReminderFetch } from '@/lib/server/photo-reminders';

// Admin-only: the one-time "add your profile photo" email for listed teachers without a photo.
//   GET                          → listed teachers without a photo + who was already emailed + last runs
//   GET  ?view=preview&name=     → the exact email
//   POST {action:'test', name}   → sends it to the signed-in ADMIN only
//   POST {action:'run'}          → emails every teacher still due (list rebuilt here, never from the client)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function relay(up: Response, fallback: string) {
  const d = await up.json().catch(() => null);
  if (!up.ok) return NextResponse.json({ error: toErrorText(d?.detail, fallback) }, { status: up.status || 502 });
  return NextResponse.json(d);
}

const UNAVAILABLE = () => NextResponse.json({ error: 'Teacher records are unavailable right now. Please try again.' }, { status: 502 });

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const sp = new URL(req.url).searchParams;
  if (sp.get('view') === 'preview') {
    const name = encodeURIComponent((sp.get('name') || '').slice(0, 120));
    const base = encodeURIComponent(growthOrigin(req.headers));
    return relay(await photoReminderFetch(`/admin/preview?name=${name}&base=${base}`), 'Could not build the preview.');
  }
  const data = await getPhotoReminderData();
  return data ? NextResponse.json(data) : UNAVAILABLE();
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const raw = await req.json().catch(() => ({}));
  const base = growthOrigin(req.headers);
  if (raw?.action === 'test') {
    const to = String(guard.user?.email || '');
    if (!to) return NextResponse.json({ error: 'Your admin account has no email address.' }, { status: 400 });
    const body = { to, name: String(raw.name || '').slice(0, 120), base };
    return relay(await photoReminderFetch('/admin/test', { method: 'POST', body: JSON.stringify(body) }), 'Could not send the test email.');
  }
  if (raw?.action === 'run') {
    const data = await getPhotoReminderData();
    if (!data) return UNAVAILABLE();
    const recipients = data.rows
      .filter((r) => r.email && r.status !== 'sent')
      .map((r) => ({ teacher_id: r.teacherId, name: r.name, email: r.email }));
    const up = await photoReminderFetch('/admin/run', { method: 'POST', body: JSON.stringify({ recipients, base }) }, 110000);
    return relay(up, 'Could not send the emails.');
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
