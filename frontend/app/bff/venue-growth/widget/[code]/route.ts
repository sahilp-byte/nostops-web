import type { NextRequest } from 'next/server';
import { growthFetch } from '@/lib/server/venue-growth';
import { bareHost } from '@/lib/payment-mode';

// What an installed website widget loads: the venue's public state + the CURRENT shared
// configuration (so a central admin change reaches every installed widget instantly,
// with no change to the venue's embed code). Never returns venue details or contact data.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache, max-age=0', 'X-Robots-Tag': 'noindex' };

function hostFrom(value: string | null): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sp = new URL(req.url).searchParams;
  // The page the widget runs on: the browser's Origin/Referer, else the script's own report.
  const host = hostFrom(req.headers.get('origin')) || hostFrom(req.headers.get('referer')) || bareHost(sp.get('host')).slice(0, 253);
  const visitor = (sp.get('v') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const safeCode = /^[a-z0-9]{1,12}$/.test(code || '') ? code : 'unknown';
  try {
    const up = await growthFetch(`/widget/${safeCode}?host=${encodeURIComponent(host)}&visitor=${encodeURIComponent(visitor)}`);
    const d = await up.json().catch(() => null);
    if (!up.ok || !d) return Response.json({ state: 'unknown', config: null }, { status: 200, headers: CORS });
    return Response.json({ state: d.state, config_version: d.config_version, config: d.config }, { headers: CORS });
  } catch {
    return Response.json({ state: 'unknown', config: null }, { status: 200, headers: CORS });
  }
}
