import { backendFetch } from '@/lib/server/session';

// Admin Broadcast data layer (PHASE 10). Reads GET /api/admin/broadcast-history.
// Sending goes through the admin-guarded BFF → POST /api/admin/broadcast.

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export type BroadcastEntry = {
  title: string;
  body: string;
  link: string | null;
  deliveredTo: number;
  createdAt: string | null;
};

export async function getBroadcastHistory(): Promise<BroadcastEntry[]> {
  const res = await backendFetch('/admin/broadcast-history');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  return (Array.isArray(d.history) ? d.history : []).map((h: any) => ({
    title: str(h.title) || 'Announcement',
    body: str(h.body) || '',
    link: str(h.link),
    deliveredTo: num(h.delivered_to),
    createdAt: str(h.created_at),
  }));
}
