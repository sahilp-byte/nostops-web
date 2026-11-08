import { NextResponse } from 'next/server';
import { lookupPin, PIN_RE } from '@/lib/server/spaces-localities';

// Public, read-only India PIN → localities lookup for NOSTOPS Spaces (Phase 2).
// Answers: 200 { pin, district, state, localities[] } · 422 invalid_pin · 404 unknown_pin · 503 dataset_loading · 502 backend_error.
export async function GET(_req: Request, ctx: { params: Promise<{ pin: string }> }) {
  const { pin: raw } = await ctx.params;
  const pin = String(raw || '').replace(/\s+/g, '');
  if (!PIN_RE.test(pin)) {
    return NextResponse.json(
      { error: 'invalid_pin', message: 'Enter a valid 6-digit Indian PIN code. NOSTOPS Spaces is available in India only.' },
      { status: 422 },
    );
  }
  const r = await lookupPin(pin);
  if (r.status === 200) {
    return NextResponse.json(r.data, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
  }
  const d = r.data?.detail || {};
  return NextResponse.json(
    { error: d.error || 'backend_error', message: d.message || 'Locality lookup is unavailable right now.' },
    { status: r.status || 502 },
  );
}
