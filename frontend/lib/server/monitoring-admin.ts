import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole } from '@/lib/roles';
import { localAdminFetch } from '@/lib/server/local-admin';

// Admin reads for the Error Monitor page + sidebar badge.
export type MonitorSample = { at: string; status?: number | null; [k: string]: unknown };
export type MonitorEvent = {
  id: string;
  kind: 'page' | 'server' | 'payment' | 'email';
  source: string;
  message: string;
  path: string;
  count: number;
  status: 'open' | 'resolved';
  first_at: string;
  last_at: string;
  last_status?: number | null;
  alert_status?: 'sent' | 'failed' | 'capped' | 'cooldown' | 'preview_test_log';
  last_alert_at?: string;
  resolved_by?: string;
  samples: MonitorSample[];
};
export type MonitorList = {
  items: MonitorEvent[];
  open_by_kind: Record<string, number>;
  open_total: number;
  last_24h: number;
  alert_to: string;
};

async function get<T>(path: string, fallback: T): Promise<T> {
  const user = await getSessionUser();
  if (!user || normalizeRole(user.role) !== 'admin') return fallback;
  try {
    const r = await localAdminFetch(`/api/monitoring${path}`, user);
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getMonitorEvents(qs = 'status=open'): Promise<MonitorList> {
  return get<MonitorList>(`/events?${qs}`, { items: [], open_by_kind: {}, open_total: 0, last_24h: 0, alert_to: '' });
}

export async function getOpenErrorCount(): Promise<number> {
  const d = await get<{ open?: number }>('/summary', {});
  return Number(d.open) || 0;
}
