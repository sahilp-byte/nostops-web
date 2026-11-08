import { backendFetch } from '@/lib/server/session';

// Admin Venue Monitor data layer (PHASE 15). Reads GET /api/venue-enrichment/admin/monitor —
// the health of Google Places venue enrichment across connected retreats.
// Re-sync + run-worker write through the admin-guarded BFF.

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type VenueMonitorRow = {
  retreatId: string;
  placeId: string | null;
  displayName: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  aiGeneratedAt: string | null;
};

export type VenueMonitorData = {
  totals: { connected: number; disconnected: number; successfulSyncs30d: number; failedSyncs30d: number };
  rows: VenueMonitorRow[];
};

export async function getVenueMonitor(): Promise<VenueMonitorData> {
  const res = await backendFetch('/venue-enrichment/admin/monitor');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const t = d.totals || {};
  return {
    totals: {
      connected: num(t.connected),
      disconnected: num(t.disconnected),
      successfulSyncs30d: num(t.successful_syncs_30d),
      failedSyncs30d: num(t.failed_syncs_30d),
    },
    rows: (Array.isArray(d.retreats) ? d.retreats : []).map((r: any) => ({
      retreatId: str(r.retreat_id) || '',
      placeId: str(r.place_id),
      displayName: str(r.google_display_name) || 'Venue',
      connectedAt: str(r.connected_at),
      lastSyncAt: str(r.last_sync_at),
      nextSyncAt: str(r.next_sync_at),
      aiGeneratedAt: str(r.ai_generated_at),
    })).filter((r: VenueMonitorRow) => r.retreatId),
  };
}
