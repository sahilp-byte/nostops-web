import type { Metadata } from 'next';
import { getNotifications } from '@/lib/server/learner';
import Link from 'next/link';
import NotificationsList from '@/components/app/NotificationsList';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { getAdminNavBadges } from '@/lib/server/admin-nav-badges';
import { getActivityAlerts } from '@/lib/server/activity-alerts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Notifications', robots: { index: false, follow: false } };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  const role = normalizeRole(user?.role);
  const [items, adminBadges] = await Promise.all([getNotifications(), role === 'admin' ? getAdminNavBadges() : Promise.resolve(undefined)]);
  const activity = await getActivityAlerts(role, adminBadges);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-black tracking-tight text-ink">Notifications</h1>
      {activity.length > 0 && (
        <section className="mt-5" data-testid="activity-alerts" aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="text-xs font-black uppercase tracking-wider text-red-700">Needs your attention</h2>
          <ul className="mt-2 list-none space-y-2 p-0">
            {activity.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="card flex min-h-[56px] items-center gap-3 border-red-200 bg-red-50/50 p-4 transition hover:border-red-300" data-testid={`activity-${a.key}`}>
                  <span className="grid h-7 min-w-[28px] place-items-center rounded-full bg-red-600 px-2 text-xs font-black text-white">{a.count}</span>
                  <span className="flex-1 text-sm font-bold text-ink">{a.label}</span>
                  <span aria-hidden className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <NotificationsList items={items} />
    </div>
  );
}
