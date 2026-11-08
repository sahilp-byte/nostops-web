import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { growthOrigin } from '@/lib/server/venue-growth';
import { claimReminderFetch } from '@/lib/server/claim-reminders';

// Admin-only: finish-your-profile reminders for claimed listings.
//   GET                                → every claimed listing in progress + its reminder state + last runs
//   GET  ?view=preview&step=1-3&id=    → the exact email (a real claim, or a sample)
//   POST {action:'test', step, id}     → sends it to the signed-in ADMIN only
//   POST {action:'run'}                → sends every reminder that is due now
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function relay(up: Response, fallback: string) {
  const d = await up.json().catch(() => null);
  if (!up.ok) return NextResponse.json({ error: toErrorText(d?.detail, fallback) }, { status: up.status || 502 });
  return NextResponse.json(d);
}

const stepOf = (v: unknown) => Math.min(3, Math.max(1, parseInt(String(v || '1'), 10) || 1));
const idOf = (v: unknown) => String(v || '').slice(0, 80);

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const sp = new URL(req.url).searchParams;
  if (sp.get('view') === 'preview') {
    const qs = new URLSearchParams({ step: String(stepOf(sp.get('step'))), candidate_id: idOf(sp.get('id')), base: growthOrigin(req.headers) });
    return relay(await claimReminderFetch(`/admin/preview?${qs}`), 'Could not build the preview.');
  }
  return relay(await claimReminderFetch('/admin/overview'), 'Claimed listings are unavailable right now.');
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const raw = await req.json().catch(() => ({}));
  const base = growthOrigin(req.headers);
  if (raw?.action === 'test') {
    const to = String(guard.user?.email || '');
    if (!to) return NextResponse.json({ error: 'Your admin account has no email address.' }, { status: 400 });
    const body = { to, step: stepOf(raw.step), candidate_id: idOf(raw.id), base };
    return relay(await claimReminderFetch('/admin/test', { method: 'POST', body: JSON.stringify(body) }), 'Could not send the test email.');
  }
  if (raw?.action === 'run') {
    return relay(await claimReminderFetch('/admin/run', { method: 'POST', body: JSON.stringify({ base }) }, 110000), 'Could not send the reminders.');
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
