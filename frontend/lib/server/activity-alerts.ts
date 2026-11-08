import { cache } from 'react';
import type { AppRole } from '@/lib/roles';
import { getOneOnOneBookings } from '@/lib/server/one-on-one';
import { getMyBookings, getReviewableSessions } from '@/lib/server/bookings';
import { getOrgBookings } from '@/lib/server/org';
import { getMyInterviewQueue, getVouchInbox } from '@/lib/server/guru';

// "Key activity" for the red bell: things that need the signed-in person's
// attention right now, per persona. Each item clears itself once handled (the
// counts come from live backend state), so nothing has to be marked as read.
export type ActivityAlert = { key: string; label: string; count: number; href: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function soon(ts: number | null, now: number): boolean {
  return ts != null && ts >= now && ts - now <= DAY_MS;
}

async function teacherAlerts(): Promise<ActivityAlert[]> {
  const { bookings } = await getOneOnOneBookings();
  const now = Date.now();
  return [
    { key: 'confirm', label: 'Booking requests waiting for your confirmation', count: bookings.filter((b) => b.awaitingTeacher).length, href: '/app/teacher/bookings' },
    { key: 'soon', label: 'Sessions starting in the next 24 hours', count: bookings.filter((b) => !b.isTerminal && soon(b.slotTs, now)).length, href: '/app/teacher/bookings' },
  ];
}

async function learnerAlerts(): Promise<ActivityAlert[]> {
  const [{ upcoming }, reviewable] = await Promise.all([getMyBookings(), getReviewableSessions()]);
  const now = Date.now();
  return [
    { key: 'soon', label: 'Sessions starting in the next 24 hours', count: upcoming.filter((b) => soon(b.slotTs, now)).length, href: '/app/bookings' },
    { key: 'review', label: 'Completed sessions waiting for your review', count: reviewable.length, href: '/app/bookings' },
  ];
}

async function orgAlerts(): Promise<ActivityAlert[]> {
  const bookings = await getOrgBookings();
  return [
    { key: 'invite', label: 'Programmes with no registrations yet — share the invite link', count: bookings.filter((b) => b.status === 'inviting' && b.registered === 0).length, href: '/app' },
  ];
}

async function councilAlerts(): Promise<ActivityAlert[]> {
  const [queue, vouches] = await Promise.all([getMyInterviewQueue(), getVouchInbox()]);
  const c = queue?.counts;
  return [
    { key: 'interviews', label: 'Empanelment interviews to schedule, conduct or decide', count: c ? c.toSchedule + c.toConduct + c.toDecide : 0, href: '/app/council/interviews' },
    { key: 'vouch', label: 'Lineage vouch requests waiting for you', count: vouches.filter((v) => v.status === 'pending').length, href: '/app/council/vouch' },
  ];
}

const ADMIN_LABELS: Record<string, string> = {
  '/app/admin/kyc': 'KYC reviews pending',
  '/app/admin/empanelment': 'Empanelment requests pending',
  '/app/admin/video-reviews': 'Intro videos to review',
  '/app/admin/org-enquiries': 'New organisation enquiries',
  '/app/admin/error-monitor': 'Open site errors',
  '/app/admin/nominations': 'Open Guru nominations',
};

function adminAlerts(badges: Record<string, number>): ActivityAlert[] {
  return Object.entries(badges).map(([href, count]) => ({ key: href, label: ADMIN_LABELS[href] || 'Items pending', count, href }));
}

/** Live attention items for this persona (zero-count items removed). Admin reuses the sidebar badge counts. */
export const getActivityAlerts = cache(async (role: AppRole, adminBadges?: Record<string, number>): Promise<ActivityAlert[]> => {
  let items: ActivityAlert[] = [];
  try {
    if (role === 'teacher') items = await teacherAlerts();
    else if (role === 'learner') items = await learnerAlerts();
    else if (role === 'corporate') items = await orgAlerts();
    else if (role === 'council') items = await councilAlerts();
    else if (role === 'admin') items = adminAlerts(adminBadges || {});
  } catch {
    items = [];
  }
  return items.filter((i) => i.count > 0);
});
