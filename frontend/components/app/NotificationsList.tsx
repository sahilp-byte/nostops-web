'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { NotificationItem } from '@/lib/server/learner';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Deterministic, locale/timezone-independent date (UTC) used for the server
// render + first client paint so relative "x ago" times (which depend on
// Date.now()) never cause a hydration mismatch. Relative time takes over after
// mount.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function absDate(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// Web routes that exist as pages — only navigate to these to avoid dead ends.
const NAV_PREFIXES = ['/retreats', '/teachers', '/council', '/paramparas', '/about'];

export default function NotificationsList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(items.filter((n) => !(n.read === false || n.is_read === false)).map((n) => n.id || n.notification_id || '')),
  );
  const [allRead, setAllRead] = useState(false);
  // Relative timestamps only after mount (server + first paint use absDate).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isUnread = (n: NotificationItem) => !allRead && !readIds.has(n.id || n.notification_id || '');
  const unreadCount = items.filter(isUnread).length;

  async function markAll() {
    setAllRead(true);
    await postBff('/bff/notifications/read-all');
    router.refresh();
  }

  async function open(n: NotificationItem) {
    const id = n.id || n.notification_id || '';
    if (isUnread(n) && id) {
      setReadIds((prev) => new Set(prev).add(id));
      postBff(`/bff/notifications/${id}`); // fire-and-forget mark read
    }
    const route = n.route || '';
    if (route.startsWith('/') && NAV_PREFIXES.some((p) => route.startsWith(p))) router.push(route);
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 card p-8 text-center">
        <p className="font-semibold text-ink">You&apos;re all caught up</p>
        <p className="mt-1 text-sm text-muted">New updates about your sessions and bookings will appear here.</p>
      </div>
    );
  }

  return (
    <>
      {unreadCount > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-muted">{unreadCount} unread</p>
          <button type="button" onClick={markAll} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50" data-testid="mark-all-read">Mark all read</button>
        </div>
      )}
      <ul className="mt-4 list-none space-y-3 p-0">
        {items.map((n, i) => {
          const unread = isUnread(n);
          const route = n.route || '';
          const clickable = route.startsWith('/') && NAV_PREFIXES.some((p) => route.startsWith(p));
          return (
            <li key={n.id || n.notification_id || i}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`card flex w-full gap-3 p-4 text-left transition ${unread ? 'border-brand/30 bg-brand-50/40' : ''} ${clickable ? 'hover:border-brand/40' : ''}`}
              >
                {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="unread" /> : <span className="mt-1.5 h-2 w-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  {n.title && <p className="font-bold text-ink">{n.title}</p>}
                  <p className="text-sm leading-relaxed text-ink-soft">{n.body || n.message || ''}</p>
                  {n.created_at && <p className="mt-1 text-xs text-muted">{mounted ? timeAgo(n.created_at) : absDate(n.created_at)}</p>}
                </div>
                {clickable && <span className="mt-1 shrink-0 text-muted">›</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
