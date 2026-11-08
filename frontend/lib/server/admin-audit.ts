import { backendFetch } from '@/lib/server/session';

// Admin Audit Trail data layer (read-only). Reads GET /api/admin/audit-log
// (paginated events) and /api/admin/audit-log/distinct-actions (filter values).
// Records every admin action with who/when — surfaced verbatim from the backend
// audit store (no new logging on the web).

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export type AuditEvent = {
  at: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
};

export type AuditPage = {
  events: AuditEvent[];
  total: number;
  skip: number;
  limit: number;
  actions: string[];
};

function project(e: any): AuditEvent {
  const target = e.target || {};
  return {
    at: str(e.at) || str(e.created_at) || str(e.timestamp),
    actorEmail: str(e.actor_email) || str(e.actor_id),
    actorRole: str(e.actor_role),
    action: str(e.action) || 'action',
    targetType: str(target.type) || str(e.target_type),
    targetId: str(target.id) || str(e.target_id),
    ip: str(e.ip),
  };
}

export async function getAuditLog(opts: { action?: string; skip?: number; limit?: number } = {}): Promise<AuditPage> {
  const limit = opts.limit ?? 50;
  const skip = Math.max(0, opts.skip ?? 0);
  const qs = new URLSearchParams({ limit: String(limit), skip: String(skip) });
  if (opts.action) qs.set('action', opts.action);

  const [logRes, actionsRes] = await Promise.all([
    backendFetch(`/admin/audit-log?${qs.toString()}`),
    backendFetch('/admin/audit-log/distinct-actions'),
  ]);
  const log = logRes.ok ? await logRes.json().catch(() => ({})) : {};
  const act = actionsRes.ok ? await actionsRes.json().catch(() => ({})) : {};

  const rawActions = Array.isArray(act) ? act : Array.isArray(act.actions) ? act.actions : [];
  return {
    events: (Array.isArray(log.events) ? log.events : []).map(project),
    total: num(log.total),
    skip: num(log.skip) || skip,
    limit: num(log.limit) || limit,
    actions: rawActions.filter((a: unknown) => typeof a === 'string').sort(),
  };
}
