import 'server-only';
import { spacesCall, spacesError } from '@/lib/server/spaces';

// Phase 8B.2 — admin reads of the existing Phase 8B.1.7 locality coverage API (/api/spaces/coverage/*).
// The backend is the only source of truth; nothing here computes or stores coverage.
export type RefLocality = { locality_id: string; pin: string; locality: string; office_type: string; taluk: string; district: string; state: string };
export type Actor = { by_id: string; by_name: string };
export type CoverageRecord = {
  locality_id: string; pin: string; status: string; covered: boolean; version: number; dataset_version?: string;
  notes: ({ id: string; text: string; at: string } & Actor)[];
  created_at?: string; created_by?: Actor; updated_at?: string; updated_by?: Actor;
};
export type TeacherCounts = { verified_eligible: number; registered_not_verified: number; ineligible: number; stale: number; eligible_and_recently_refreshed: number; special_needs_qualified: number; total: number };
export type LocalityCounts = { spaces: { approved: number; commercial: number; subsidised: number; community: number }; partners: number; teachers: TeacherCounts };
export type CoverageSummary = {
  total_records: number; by_status: Record<string, number>; covered_localities: number; dataset_version: string;
  platform_totals: LocalityCounts;
};
export type ListItem = Partial<RefLocality> & { locality_id: string; pin: string; reference_status: 'ok' | 'stale'; coverage_status: string; coverage: CoverageRecord };
export type SearchGroup = { pin: string; district: string; state: string; locality_count_in_pin: number; localities: (RefLocality & { coverage_status: string | null })[] };
export type HistoryEntry = { from: string | null; to: string; reason: string; at: string } & Actor;
export type AuditEntry = { locality_id: string; action: string; from?: string; to?: string; reason?: string; note_id?: string; actor_id: string; actor: string; actor_role: string; at: string };

// Non-discriminated so callers work without strictNullChecks narrowing; data is only meaningful when ok.
type Res<T> = { ok: boolean; status: number; data: T; error: string };

async function get<T>(path: string, fallback: string): Promise<Res<T>> {
  const r = await spacesCall(`/coverage${path}`);
  if (r.status === 200) return { ok: true, status: 200, data: r.data as T, error: '' };
  return { ok: false, status: r.status, data: null as unknown as T, error: spacesError(r.data?.detail, fallback) };
}

function qs(p: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}

export function getCoverageSummary() {
  return get<CoverageSummary>('/summary', 'Coverage summary is unavailable right now.');
}

export function listCoverage(p: { pin?: string; q?: string; state?: string; district?: string; status?: string; page?: number; page_size?: number }) {
  return get<{ items: ListItem[]; total: number; page: number; page_size: number }>(`${qs(p)}`, 'Coverage records are unavailable right now.');
}

export function searchLocalities(p: { q: string; state?: string; district?: string; limit?: number }) {
  return get<{ query: string; kind: 'pin' | 'locality_name'; pins: SearchGroup[]; truncated: boolean }>(`/search${qs(p)}`, 'Locality search is unavailable right now.');
}

export function getCoverageLocality(lid: string) {
  return get<{ reference: RefLocality | null; reference_status: 'ok' | 'stale'; coverage: CoverageRecord | null; coverage_label: string; counts: LocalityCounts | null }>(
    `/locality/${encodeURIComponent(lid)}`, 'This locality could not be loaded.');
}

export function getCoverageHistory(lid: string) {
  return get<{ locality_id: string; history: HistoryEntry[]; audit: AuditEntry[] }>(`/locality/${encodeURIComponent(lid)}/history`, 'Coverage history is unavailable right now.');
}

// 8B.3 — PIN view: every locality of the PIN with its own counts, plus PIN-level unique totals (deduplicated by the backend).
export function getCoveragePin(pin: string) {
  return get<{ pin: string; district: string; state: string; localities: { locality_id: string; locality: string }[]; pin_unique_counts: LocalityCounts }>(
    `/pin/${encodeURIComponent(pin)}`, 'PIN totals are unavailable right now.');
}
