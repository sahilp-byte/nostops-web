import { backendFetch, getSessionUser } from '@/lib/server/session';
import type { NavSection } from '@/components/app/nav-config';
import { getNewEnquiryCount } from '@/lib/server/org-enquiries';
import { getOpenErrorCount } from '@/lib/server/monitoring-admin';
import { getOpenNominationCount } from '@/lib/server/guru-nominations';

// Live sidebar backlog counts for the admin console. Reads the SAME authoritative
// sources the pages use (admin-stats action queue + video queue) — no new counters.
// FINANCIAL SAFETY AUDIT: there is NO payouts badge. The main backend's payout list
// runs its payout sweep on every read, so a page view must never call it.
export async function getAdminNavBadges(): Promise<Record<string, number>> {
  const user = await getSessionUser();
  const [statsRes, videoRes, newEnquiries, openErrors, openNominations] = await Promise.all([
    backendFetch('/dashboards/admin-stats'),
    backendFetch('/admin/video-intro/queue'),
    getNewEnquiryCount(),
    getOpenErrorCount(),
    user ? getOpenNominationCount(user) : Promise.resolve(0),
  ]);
  const stats = statsRes.ok ? await statsRes.json().catch(() => ({})) : {};
  const video = videoRes.ok ? await videoRes.json().catch(() => ({})) : {};

  const ops = stats.operations || {};
  const queue: any[] = Array.isArray(ops.action_queue) ? ops.action_queue : [];
  const kyc = Number(ops.pending_kyc_count) || 0;
  const empanel = Number((queue.find((q) => q?.id === 'empanel') || {}).count) || 0;
  const videoCount = Number(video.count) || (Array.isArray(video.queue) ? video.queue.length : 0);

  const map: Record<string, number> = {};
  if (kyc > 0) map['/app/admin/kyc'] = kyc;
  if (empanel > 0) map['/app/admin/empanelment'] = empanel;
  if (videoCount > 0) map['/app/admin/video-reviews'] = videoCount;
  if (newEnquiries > 0) map['/app/admin/org-enquiries'] = newEnquiries;
  if (openErrors > 0) map['/app/admin/error-monitor'] = openErrors;
  if (openNominations > 0) map['/app/admin/nominations'] = openNominations;
  return map;
}

/** Return a copy of the nav with badge counts applied to matching items by href. */
export function decorateNavWithBadges(nav: NavSection[], badges: Record<string, number>): NavSection[] {
  return nav.map((section) => ({
    ...section,
    items: section.items.map((item) => (item.href && badges[item.href] ? { ...item, badge: badges[item.href] } : item)),
  }));
}
