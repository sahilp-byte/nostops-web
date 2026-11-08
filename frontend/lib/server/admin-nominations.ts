import { backendFetch } from '@/lib/server/session';
import { APP_PENDING } from '@/lib/nomination-status';

// Mobile-app Guru nominations (main backend). Reads GET /api/admin/council/nominations?status=all
// so the admin sees the full history, not only items waiting for review. All writes go through
// the admin-guarded BFF.

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export type Nomination = {
  nominationId: string;
  nomineeName: string;
  nomineeLineage: string | null;
  nomineeCity: string | null;
  nomineeDecades: number | null;
  nomineeEmail: string | null;
  nomineePhone: string | null;
  nominatedBy: string | null;
  nominatorEmail: string | null;
  nominatorPhone: string | null;
  relationship: string | null;
  citation: string | null;
  references: string | null;
  reviewerNote: string | null;
  status: string;
  createdAt: string | null;
  reviewedAt: string | null;
};

function project(n: any): Nomination {
  return {
    nominationId: str(n.nomination_id) || str(n.id) || str(n._id) || '',
    nomineeName: str(n.nominee_name) || str(n.teacher_name) || str(n.name) || 'Nominee',
    nomineeLineage: str(n.nominee_lineage),
    nomineeCity: str(n.nominee_city),
    nomineeDecades: num(n.nominee_decades) || null,
    nomineeEmail: str(n.nominee_email),
    nomineePhone: str(n.nominee_phone),
    nominatedBy: str(n.nominator_name) || str(n.nominated_by_name) || str(n.nominated_by),
    nominatorEmail: str(n.nominator_email),
    nominatorPhone: str(n.nominator_phone),
    relationship: str(n.relationship),
    citation: str(n.citation) || str(n.reason) || str(n.rationale),
    references: str(n.references),
    reviewerNote: str(n.reviewer_note),
    status: str(n.status) || APP_PENDING,
    createdAt: str(n.created_at),
    reviewedAt: str(n.reviewed_at),
  };
}

export type NominationsData = {
  ok: boolean;
  items: Nomination[];
  counts: { total: number; pending: number };
};

export async function getNominations(): Promise<NominationsData> {
  const res = await backendFetch('/admin/council/nominations?status=all&limit=200').catch(() => null);
  const d = res?.ok ? await res.json().catch(() => ({})) : {};
  const items = (Array.isArray(d.items) ? d.items : []).map(project).filter((n: Nomination) => n.nominationId);
  return {
    ok: !!res?.ok,
    items,
    counts: { total: items.length, pending: items.filter((n: Nomination) => n.status === APP_PENDING).length },
  };
}
