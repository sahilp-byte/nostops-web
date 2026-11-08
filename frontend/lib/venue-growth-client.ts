// Client-side venue invitation attribution. Fires only when the visitor arrived through a
// venue's NOSTOPS link (/v/{code} sets the first-party nostops_vref cookie). The BFF reads
// the code and visitor id from cookies and the teacher's id from the session — nothing
// personal is sent from here. Best-effort: never blocks or throws.
import { sendBff } from '@/lib/auth-client';

export type GrowthKind = 'profile_view' | 'register_complete' | 'existing_signin' | 'profile_complete';

export async function trackVenueGrowth(kind: GrowthKind, venueId?: string): Promise<void> {
  if (typeof document === 'undefined' || !/(?:^|;\s*)nostops_vref=/.test(document.cookie)) return;
  await sendBff('/bff/venue-growth/event', 'POST', { kind, ...(venueId ? { venue_id: venueId } : {}) }).catch(() => undefined);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

/** Minimal typing for the embed script's global (public/widgets/venue.js). */
export type VenueWidgetApi = {
  version: number;
  render: (el: HTMLElement, data: { state: string; config: unknown; config_version?: number } | null, kind: 'listed' | 'teacher', code: string | null) => void;
  mount: (el: HTMLElement, code: string, kind: 'listed' | 'teacher') => Promise<void>;
};
export function widgetApi(): VenueWidgetApi | null {
  return typeof window === 'undefined' ? null : ((window as unknown as { NOSTOPSVenueWidget?: VenueWidgetApi }).NOSTOPSVenueWidget ?? null);
}
