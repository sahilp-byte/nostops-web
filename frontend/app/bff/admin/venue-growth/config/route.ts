import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { toErrorText } from '@/lib/server/bff';
import { growthFetch } from '@/lib/server/venue-growth';

// Admin-only: the shared configuration every installed venue widget reads.
// GET → current version + defaults + history. PUT → publishes a NEW version (history kept).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { csrf: false });
  if (!guard.ok) return guard.res;
  const [cfg, hist] = await Promise.all([growthFetch('/config'), growthFetch('/config/history')]);
  const c = await cfg.json().catch(() => null);
  const h = await hist.json().catch(() => null);
  if (!cfg.ok) return NextResponse.json({ error: 'Widget settings are unavailable right now.' }, { status: 502 });
  return NextResponse.json({ ...c, history: h?.history || [] });
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const raw = await req.json().catch(() => ({}));
  if (!raw?.config || typeof raw.config !== 'object') return NextResponse.json({ error: 'Missing settings.' }, { status: 400 });
  const actor = String(guard.user?.email || guard.user?.name || 'admin').slice(0, 120);
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 300) : '';
  const up = await growthFetch('/config', { method: 'PUT', body: JSON.stringify({ config: raw.config, actor, note }) });
  const d = await up.json().catch(() => null);
  if (!up.ok) return NextResponse.json({ error: toErrorText(d?.detail, 'Could not save the widget settings.') }, { status: up.status || 502 });
  return NextResponse.json({ ok: true, version: d?.version, config: d?.config });
}
