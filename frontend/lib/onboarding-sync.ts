// Browser helpers for the teacher onboarding wizard: server draft load/save/complete and funnel
// events (all through the BFF; nothing here talks to the backend directly). Never throws.
import { sendBff } from '@/lib/auth-client';

export type DraftFields = {
  step?: number;
  name?: string;
  city?: string;
  country?: string;
  phone?: string;
  languages?: string[];
  experience?: string;
  paramparas?: string[];
  styles?: string[];
  yogaDims?: string[];
  specializations?: string[];
  bio?: string;
  sampleVideo?: string;
  handle?: string;
  aiTone?: string;
};

export type ServerDraft = {
  screens: Record<string, any>;
  last_completed_screen: number;
  version: number;
  completed: boolean;
  draft_photo: string | null;
  has_photo: boolean;
};

export type SyncErrorType = 'session_expired' | 'stale' | 'preview_read_only' | 'timeout' | 'backend_error' | 'network';
export type SyncFail = { ok: false; error_type: SyncErrorType; error: string };

/** Wizard fields → the draft's `screens` object (one key per screen). */
export function toScreens(f: DraftFields): Record<string, any> {
  return {
    basics: { name: f.name, city: f.city, country: f.country, phone: f.phone, languages: f.languages, experience: f.experience },
    lineage: { paramparas: f.paramparas, styles: f.styles },
    specs: { yogaDims: f.yogaDims, specializations: f.specializations },
    bio: { bio: f.bio, sampleVideo: f.sampleVideo, handle: f.handle, aiTone: f.aiTone },
  };
}

export function fromScreens(s: Record<string, any> | null | undefined): DraftFields {
  const v = s || {};
  return { ...(v.basics || {}), ...(v.lineage || {}), ...(v.specs || {}), ...(v.bio || {}) };
}

function asFail(status: number, data: any): SyncFail {
  const t = data?.error_type as SyncErrorType | undefined;
  return {
    ok: false,
    error_type: t || (status === 0 ? 'network' : status === 401 ? 'session_expired' : status === 423 ? 'preview_read_only' : 'backend_error'),
    error: data?.error || 'Something went wrong.',
  };
}

export async function loadServerDraft(): Promise<{ ok: true; exists: boolean; draft: ServerDraft | null } | SyncFail> {
  try {
    const r = await fetch('/bff/teacher/onboarding-draft', { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.ok) return { ok: true, exists: !!d.exists, draft: d.draft || null };
    return asFail(r.status, d);
  } catch {
    return asFail(0, null);
  }
}

export async function saveServerDraft(body: {
  screens: Record<string, any>;
  last_completed_screen: number;
  expected_version: number | null;
  draft_photo?: string;
}): Promise<{ ok: true; version: number } | SyncFail> {
  const r = await sendBff('/bff/teacher/onboarding-draft', 'PUT', body);
  if (r.ok && r.data?.ok && Number.isInteger(r.data?.draft?.version)) return { ok: true, version: r.data.draft.version };
  return asFail(r.status, r.data);
}

export async function completeServerDraft(): Promise<boolean> {
  const r = await sendBff('/bff/teacher/onboarding-draft/complete', 'POST', {});
  return !!(r.ok && r.data?.ok);
}

// ── Funnel events ──────────────────────────────────────────────────────────────
// One event_id per logical event (`key`), kept for this browser session so a retry — or a
// page refresh followed by a retry — re-sends the SAME id and the backend de-duplicates it.
const IDS_KEY = 'nostops.onboarding.event_ids.v1';

function eventId(key: string): string {
  let map: Record<string, string> = {};
  try {
    map = JSON.parse(window.sessionStorage.getItem(IDS_KEY) || '{}');
  } catch {
    /* blocked storage → fresh id */
  }
  if (!map[key]) {
    map[key] = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
    try {
      window.sessionStorage.setItem(IDS_KEY, JSON.stringify(map));
    } catch {
      /* non-fatal */
    }
  }
  return map[key];
}

export type OnboardingEvent = 'teacher_registration_completed' | 'onboarding_resumed' | 'profile_creation_succeeded' | 'profile_creation_failed';

/** Fire-and-forget; one retry with the same event_id on a network failure. */
export function trackOnboarding(
  event: OnboardingEvent,
  key: string,
  meta: { screen?: number; error_type?: string; step?: string } = {},
): void {
  if (typeof window === 'undefined') return;
  const body = { event, event_id: eventId(`${event}:${key}`), ...meta };
  void (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await sendBff('/bff/teacher/onboarding-event', 'POST', body);
      if (r.status !== 0 && r.status < 500) return;
    }
  })();
}
