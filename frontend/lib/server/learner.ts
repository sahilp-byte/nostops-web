// Server-only learner data access. All calls go through the authed BFF
// (backendFetch attaches the bearer from the httpOnly cookie) or the shared SEO
// apiGet for public data. Every fetch is wrapped so one failing endpoint yields
// an honest empty state instead of breaking the page. No fake data.
import { cache } from 'react';
import { backendFetch } from '@/lib/server/session';
import { apiGet } from '@/lib/api';
import { scrubBrand } from '@/lib/sanitize-brand';
import { isPublicHandleBlocked } from '@/lib/public-teacher';

export type SeekerProgramme = {
  current_streak_days?: number;
  sessions_completed?: number;
  has_active_batch?: boolean;
  next_session?: null | {
    booking_id?: string;
    title?: string;
    date?: string;
    time?: string;
    teacher_name?: string;
  };
};

export type SmartTeacher = {
  teacher_id: string;
  handle: string;
  name: string;
  city?: string;
  rating?: number;
  sessions?: number;
};

export type NotificationItem = {
  id?: string;
  notification_id?: string;
  title?: string;
  body?: string;
  message?: string;
  created_at?: string;
  read?: boolean;
  is_read?: boolean;
  type?: string;
  route?: string;
  icon?: string;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// Public directory eligibility (same rule used site-wide) so we never link the
// learner to a suspended/inactive teacher whose public profile 404s.
const getEligibleHandles = cache(async (): Promise<Set<string>> =>
  safe(async () => {
    const d = await apiGet<{ teachers?: any[] }>('/teachers/directory', { revalidate: 600 });
    const raw = Array.isArray(d?.teachers) ? d.teachers : [];
    return new Set(
      raw
        .filter((t) => t?.handle && t.public_profile_visible !== false && t.is_active !== false && !t.suspended_at
          && !isPublicHandleBlocked(t.handle))
        .map((t) => String(t.handle)),
    );
  }, new Set<string>()),
);

// One unread rule for the bell AND the Notifications page: an item is unread only
// when the backend explicitly marks it so (read/is_read === false). Many remote
// items carry no read flag at all; treating those as unread made the page and the
// bell disagree.
export function isNotificationUnread(n: { read?: boolean; is_read?: boolean }): boolean {
  return n.read === false || n.is_read === false;
}

export const getUnreadCount = cache(async (): Promise<number> =>
  (await getNotificationsCached()).filter(isNotificationUnread).length,
);

export async function getSeekerHome(): Promise<{
  programme: SeekerProgramme | null;
  teachers: SmartTeacher[];
}> {
  const [programme, smart, eligible] = await Promise.all([
    safe(async () => {
      const r = await backendFetch('/seeker/programme');
      return r.ok ? ((await r.json()) as SeekerProgramme) : null;
    }, null),
    safe(async () => {
      const r = await backendFetch('/teachers/smart-match');
      const d = r.ok ? await r.json() : {};
      return (Array.isArray(d?.teachers) ? d.teachers : []) as SmartTeacher[];
    }, [] as SmartTeacher[]),
    getEligibleHandles(),
  ]);

  const teachers = smart.filter((t) => t?.handle && eligible.has(t.handle)).slice(0, 6);
  return { programme, teachers };
}

export async function getNotifications(): Promise<NotificationItem[]> {
  return getNotificationsCached();
}

const getNotificationsCached = cache(async (): Promise<NotificationItem[]> => {
  return safe(async () => {
    const r = await backendFetch('/notifications');
    if (!r.ok) return [];
    const d = await r.json();
    const list = (Array.isArray(d) ? d : Array.isArray(d?.notifications) ? d.notifications : []) as NotificationItem[];
    // Scrub legacy brand wording from remote-generated copy on read.
    return list.map((n) => ({
      ...n,
      title: scrubBrand(n.title),
      body: scrubBrand(n.body),
      message: scrubBrand(n.message),
    }));
  }, []);
});


// "Suggested for you" — the SAME personalized recommendation the mobile app shows,
// driven by the backend next-best-action engine (single source of eligibility /
// personalization). Returns null when the backend has no card, so the section is
// CONDITIONAL — we never invent or force it. The CTA launches the existing flow;
// backend app-routes are mapped to their web equivalents (no duplicate group-buy).
export type SuggestedCard = { title: string; subtitle: string; cta: string; href: string; id: string } | null;

const NBA_ROUTE_MAP: Record<string, string> = {
  '/bring-yoga-to-workplace': '/for-organisations/companies',
  '/bring-yoga-to-campus': '/for-organisations/educational-institutions',
  '/bring-yoga-to-startup-network': '/for-organisations/startup-networking-groups',
};

function mapNbaRoute(route?: string): string {
  if (!route) return '/for-organisations';
  if (NBA_ROUTE_MAP[route]) return NBA_ROUTE_MAP[route];
  // Web mirrors the in-app + public retreat/teacher routes 1:1.
  if (route.startsWith('/app/') || route.startsWith('/retreats') || route.startsWith('/teachers')) return route;
  // Unknown destination → the dashboard (always valid, never a dead-end).
  return '/app';
}

export async function getSuggestedCard(): Promise<SuggestedCard> {
  return safe(async () => {
    const r = await backendFetch('/users/me/next-best-action');
    if (!r.ok) return null;
    const d = await r.json();
    const c = d?.card;
    if (!c || !c.title) return null;
    return {
      id: String(c.id ?? 'nba'),
      title: String(c.title),
      subtitle: String(c.subtitle ?? ''),
      cta: String(c.cta ?? 'Open'),
      href: mapNbaRoute(typeof c.route === 'string' ? c.route : undefined),
    };
  }, null);
}
