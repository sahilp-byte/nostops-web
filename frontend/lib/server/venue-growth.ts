import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { bareHost, isPreviewSuffix } from '@/lib/payment-mode';
import { SITE_URL } from '@/lib/site';

// Server-only client for the LOCAL Venue Partner Growth Engine (/api/venue-growth/*).
// The shared secret never reaches the browser. Venue owners are identified only by a
// read-only kit token; the public only ever sees a venue's opaque growth code.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export const VREF_COOKIE = 'nostops_vref';
export const VID_COOKIE = 'nostops_vid';
export const CODE_RE = /^v[a-z2-9]{9}$/;

export type GrowthCounts = Record<
  'invite_visit' | 'profile_view' | 'register_start' | 'register_complete' | 'existing_signin' | 'profile_complete',
  number
>;
export type NoteLine = { style: 'h1' | 'h2' | 'p' | 'link' | 'strong'; text: string; url: string | null };
export type VenueKit = {
  code: string;
  venue: { name: string; city?: string | null; state?: string | null; country?: string | null; website?: string | null; status: string; status_label: string; venue_id?: string | null };
  links: { listing: string; join: string; script: string };
  note: NoteLine[];
  note_hi?: NoteLine[];
  counts: GrowthCounts;
  badge: boolean;
  widget: { host: string | null; seen_at: number | null };
  monthly: { enabled: boolean; widget_on_own_site: boolean };
};
export type WidgetConfig = Record<string, unknown>;

export function growthFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}/api/venue-growth${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Pulse-Secret': SECRET,
      ...testTagHeaders(),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
}

/** Public origin for links we hand out: the NOSTOPS site, or this preview (so preview links work). */
export function growthOrigin(h: Headers): string {
  const host = bareHost(h.get('x-forwarded-host') || h.get('host'));
  if (host === 'www.nostops.org' || host === 'nostops.org' || isPreviewSuffix(host)) return `https://${host}`;
  return SITE_URL.replace(/\/$/, '');
}

export async function getKit(token: string, origin: string): Promise<{ kit: VenueKit | null; error?: string }> {
  if (!SECRET || !token) return { kit: null, error: 'This toolkit link is invalid or has expired.' };
  try {
    const r = await growthFetch(`/kit?token=${encodeURIComponent(token)}&base=${encodeURIComponent(origin)}`);
    const d = await r.json().catch(() => null);
    if (!r.ok) return { kit: null, error: typeof d?.detail === 'string' ? d.detail : 'This toolkit link is invalid or has expired.' };
    return { kit: d as VenueKit };
  } catch {
    return { kit: null, error: 'The toolkit is unavailable right now. Please try again shortly.' };
  }
}

export async function kitTokenFromEdit(editToken: string): Promise<string | null> {
  if (!SECRET || !editToken) return null;
  try {
    const r = await growthFetch('/kit-token', { method: 'POST', body: JSON.stringify({ edit_token: editToken }) });
    const d = await r.json().catch(() => null);
    return r.ok && typeof d?.kit_token === 'string' ? d.kit_token : null;
  } catch {
    return null;
  }
}

export async function resolveCode(code: string): Promise<{ state: string; venue_id: string | null }> {
  if (!SECRET || !CODE_RE.test(code)) return { state: 'unknown', venue_id: null };
  try {
    const r = await growthFetch(`/resolve/${code}`);
    const d = await r.json().catch(() => null);
    return r.ok && d ? { state: String(d.state || 'unknown'), venue_id: d.venue_id || null } : { state: 'unknown', venue_id: null };
  } catch {
    return { state: 'unknown', venue_id: null };
  }
}

export async function currentWidgetConfig(): Promise<{ version: number; config: WidgetConfig; defaults?: WidgetConfig; updated_at?: string | null } | null> {
  try {
    const r = await growthFetch('/config');
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Best-effort attribution event; never throws. */
export async function recordGrowthEvent(body: { code: string; kind: string; visitor?: string; user_id?: string; venue_id?: string }): Promise<boolean> {
  if (!SECRET || !CODE_RE.test(body.code)) return false;
  try {
    const r = await growthFetch('/events', { method: 'POST', body: JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    return !!d?.counted;
  } catch {
    return false;
  }
}

/** Stream a PDF from the growth backend (invitation note / posters) with its filename. */
export async function proxyGrowthPdf(path: string): Promise<Response> {
  try {
    const up = await growthFetch(path);
    if (!up.ok) {
      const d = await up.json().catch(() => null);
      return Response.json({ error: typeof d?.detail === 'string' ? d.detail : 'This link is invalid or has expired.' }, { status: up.status });
    }
    return new Response(await up.arrayBuffer(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': up.headers.get('content-disposition') || 'attachment; filename="nostops.pdf"',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return Response.json({ error: 'The PDF is unavailable right now. Please try again shortly.' }, { status: 502 });
  }
}

/** Referral cookies: the venue's public code (last touch, 30 days) + an anonymous visitor id. */
export const growthCookieOptions = (maxAge: number) => ({
  httpOnly: false, secure: true, sameSite: 'none' as const, partitioned: true, path: '/', maxAge,
});
