// NOSTOPS Verification + Empanelment — server-only data layer for the unified
// teacher journey (Prompt 6). Talks to the ISOLATED local engine
// (/api/verification/*) with the server-only shared secret + an authenticated
// identity built from the httpOnly session. The browser never reaches it
// directly and never holds the secret. Reads are SSR; writes go via
// /bff/teacher/verification/* (CSRF-guarded).
import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { getSessionUser } from '@/lib/server/session';
import { normalizeRole, personaLabel, type User } from '@/lib/roles';
import { getTeacherSelfProfile, getOnboardingState } from '@/lib/server/teacher';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT_MS = 8000;

export type Actor = { user_id: string; name: string; role: string; persona?: string };

export function verificationActor(user: User): Actor {
  return {
    user_id: String(user.user_id || user.email || ''),
    name: (user.name as string) || (user.email as string) || 'Teacher',
    role: normalizeRole(user.role),
    persona: personaLabel(user),
  };
}

function userHeader(actor: Actor): string {
  return Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
}

export async function verificationFetch(
  path: string,
  opts: { method?: string; body?: unknown; actor: Actor; timeoutMs?: number },
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Pulse-Secret': SECRET, ...testTagHeaders(),
    'X-Pulse-User': userHeader(opts.actor),
  };
  const init: RequestInit = {
    method: opts.method || 'GET',
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
  };
  if (opts.body !== undefined && (opts.method || 'GET') !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body ?? {});
  }
  return fetch(`${BASE}/api/verification${path}`, init);
}

// ── Types ────────────────────────────────────────────────────────────────────
export type JourneyStep = {
  step: number;
  key: 'payment' | 'identity' | 'credential' | 'evidence' | 'empanelment' | 'final';
  title: string;
  status: 'LOCKED' | 'PENDING' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'DONE' | 'BLOCKED';
  detail?: string | null;
};

export type UnifiedJourney = {
  flag: 'FALSE' | 'TEST_ONLY' | 'TRUE';
  unified_enabled: boolean;
  migration_policy: string;
  grandfathered: boolean;
  complete: boolean;
  badges: { nostops_verified: boolean; nostops_empanelled: boolean };
  cta: { show: boolean; label: string; route: string; flag: string; unified_enabled: boolean; test_only: boolean };
  route: 'INDIA' | 'INTERNATIONAL';
  price: { amount?: number; currency?: string; tax_note?: string };
  /** B4.8 — false until identity checks open for teachers outside India. */
  international_available?: boolean;
  application: Record<string, unknown> | null;
  entitlements: Record<string, unknown> | null;
  steps: JourneyStep[];
  overall: { verification_status?: string; empanelment_status?: string; provider?: string };
};

const FALLBACK: UnifiedJourney = {
  flag: 'FALSE', unified_enabled: false, migration_policy: 'grandfather', grandfathered: false,
  complete: false, badges: { nostops_verified: false, nostops_empanelled: false },
  cta: { show: false, label: 'GET VERIFIED + EMPANELLED', route: '/app/teacher/get-verified', flag: 'FALSE', unified_enabled: false, test_only: false },
  route: 'INDIA', price: {}, application: null, entitlements: null, steps: [],
  overall: {},
};

/** SSR read: the signed-in teacher's unified journey (6 steps + badges + CTA).
 *  Remote status (kyc/empanelment/country) is derived server-side and passed to
 *  the engine — never trusted from the browser. Returns a safe fallback on any
 *  error (legacy CTAs then remain). */
export async function getUnifiedJourney(user?: User | null): Promise<UnifiedJourney> {
  const u = user ?? (await getSessionUser());
  if (!u) return FALLBACK;
  const actor = verificationActor(u);
  let ctx: Record<string, unknown> = {};
  try {
    const [{ self }, ob] = await Promise.all([getTeacherSelfProfile(), getOnboardingState()]);
    ctx = {
      kyc_verified: !!(self?.kycVerified && self?.kycPaid),
      is_empanelled: !!self?.isEmpanelled,
      profile_complete: !!(ob?.profileComplete ?? false),
      country: self?.country || 'India',
      teacher_handle: self?.handle || undefined,
    };
  } catch {
    ctx = { country: 'India' };
  }
  try {
    const res = await verificationFetch('/me/journey', { method: 'POST', body: ctx, actor });
    if (!res.ok) return FALLBACK;
    return (await res.json()) as UnifiedJourney;
  } catch {
    return FALLBACK;
  }
}
