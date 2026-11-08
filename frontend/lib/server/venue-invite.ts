import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getVenue, venuePath } from '@/lib/server/venues';
import {
  CODE_RE, VREF_COOKIE, VID_COOKIE, currentWidgetConfig, growthCookieOptions, recordGrowthEvent, resolveCode,
} from '@/lib/server/venue-growth';

const PATH_RE = /^\/(?!\/)[A-Za-z0-9\-_/]{0,80}$/;
const DEFAULT_DEST = { venues: '/venues', teacher_signup: '/join' };

async function destinations(): Promise<{ venues: string; teacher_signup: string }> {
  const d = ((await currentWidgetConfig())?.config as { destinations?: Record<string, string> } | undefined)?.destinations || {};
  return {
    venues: PATH_RE.test(d.venues || '') ? d.venues : DEFAULT_DEST.venues,
    teacher_signup: PATH_RE.test(d.teacher_signup || '') ? d.teacher_signup : DEFAULT_DEST.teacher_signup,
  };
}

/** Every link a venue hands out (widget, QR, PDF, WhatsApp) goes through /v/{code}[/join].
 *  Published → the venue's public profile; anything else → a general NOSTOPS page, so an
 *  unpublished venue is never exposed. Counts the visit and remembers the referring venue. */
export async function venueInviteRedirect(req: NextRequest, rawCode: string, target: 'listing' | 'join'): Promise<NextResponse> {
  const code = (rawCode || '').toLowerCase();
  const [resolved, dest] = await Promise.all([resolveCode(code), destinations()]);
  const live = resolved.state === 'published' || resolved.state === 'pending';
  const visitor = req.cookies.get(VID_COOKIE)?.value || crypto.randomUUID();

  let path = target === 'join' ? dest.teacher_signup : dest.venues;
  if (live && CODE_RE.test(code)) {
    if (target === 'listing') {
      await recordGrowthEvent({ code, kind: 'invite_visit', visitor });
      if (resolved.state === 'published' && resolved.venue_id) {
        const v = await getVenue(resolved.venue_id).catch(() => null);
        path = v ? venuePath(v) : `/venues/${encodeURIComponent(resolved.venue_id)}`;
      }
    } else {
      const user = req.cookies.get('nostops_session')?.value ? await getSessionUser() : null;
      if (user && normalizeRole(user.role) === 'teacher') {
        // An existing NOSTOPS teacher arriving from this venue's invitation.
        await recordGrowthEvent({ code, kind: 'existing_signin', user_id: String(user.user_id || user.email || '') });
        path = '/app';
      } else {
        await recordGrowthEvent({ code, kind: 'register_start', visitor });
      }
    }
  }

  // Relative Location: behind the ingress req.url carries an internal host.
  const res = new NextResponse(null, { status: 302, headers: { Location: path, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  if (live) res.cookies.set(VREF_COOKIE, code, growthCookieOptions(60 * 60 * 24 * 30));
  if (!req.cookies.get(VID_COOKIE)?.value) res.cookies.set(VID_COOKIE, visitor, growthCookieOptions(60 * 60 * 24 * 365));
  return res;
}
