import 'server-only';
import { cache } from 'react';
import { NextResponse } from 'next/server';
import type { FestiveStatus } from '@/lib/festive-view';
import { normalizeRole, type User } from '@/lib/roles';
import { backendFetch } from '@/lib/server/session';
import { projectTeacher, computeProfileCompleteness } from '@/lib/server/teacher';
import { getTeacherLevel } from '@/lib/teacher-levels';
import { testTagHeaders } from '@/lib/server/test-tag';
import { toErrorText } from '@/lib/server/bff';

// Festive Complimentary InstaKYC (backend/festive_kyc.py). This file only GATHERS the teacher's
// facts from the main NOSTOPS app with the teacher's own session (server-side) and forwards them
// with X-Pulse-Secret; the website backend decides eligibility, claims and fees. Profile
// completeness = the existing computeProfileCompleteness (same score as the dashboard).
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export type FestiveFacts = {
  available: boolean;
  role: string;
  teacher_id: string | null;
  level: 'L1' | 'L2' | 'L3' | null;
  phone_verified: boolean;
  phone_is_indian: boolean;
  profile_percent: number;
  missing_sections: string[];
  kyc_paid: boolean;
  kyc_verified: boolean;
  aadhaar_verified: boolean;
  pan_verified: boolean;
  bank_verified: boolean;
  verification_rejected: boolean;
  standard_fee_inr: number | null;
};

async function json(path: string): Promise<any | null> {
  try {
    const r = await backendFetch(path);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function gatherFestiveFacts(user: User): Promise<FestiveFacts> {
  const role = normalizeRole(user.role);
  const empty: FestiveFacts = {
    available: false, role, teacher_id: null, level: null, phone_verified: false, phone_is_indian: false,
    profile_percent: 0, missing_sections: [], kyc_paid: false, kyc_verified: false, aadhaar_verified: false,
    pan_verified: false, bank_verified: false, verification_rejected: false, standard_fee_inr: null,
  };
  const [prof, kyc, pricing] = await Promise.all([
    role === 'teacher' ? json('/teachers/me/native-profile') : Promise.resolve(null),
    role === 'teacher' ? json('/kyc/sandbox/status') : Promise.resolve(null),
    json('/kyc/pricing'),
  ]);
  const fee = typeof pricing?.amount_inr === 'number' ? pricing.amount_inr : null;
  if (role !== 'teacher') return { ...empty, available: true, standard_fee_inr: fee };
  const t = prof?.teacher;
  const self = t ? projectTeacher(t) : null;
  if (!self || !kyc) return { ...empty, standard_fee_inr: fee };
  const pc = computeProfileCompleteness(self);
  const phone = String(t.phone || t.mobile || '').replace(/[^\d+]/g, '');
  const kycState = String(kyc.kyc_status || kyc.status || kyc.data?.status || '').toLowerCase();
  return {
    available: true,
    role,
    teacher_id: t.teacher_id ? String(t.teacher_id) : null,
    level: `L${getTeacherLevel({ tier: t.tier, badgePrimary: t.badge_primary })}` as FestiveFacts['level'],
    phone_verified: !!t.phone_verified,
    phone_is_indian: /^\+91[6-9]\d{9}$/.test(phone),
    profile_percent: (pc.done / pc.total) * 100,
    missing_sections: pc.items.filter((i) => !i.done).map((i) => i.key),
    kyc_paid: !!kyc.kyc_paid,
    kyc_verified: !!kyc.kyc_verified,
    aadhaar_verified: !!kyc.data?.verified && /aadhaar|okyc/i.test(String(kyc.data?.method || '')),
    pan_verified: !!kyc.pan_verified,
    bank_verified: !!kyc.bank_verified,
    verification_rejected: kycState === 'rejected',
    standard_fee_inr: fee,
  };
}

function actor(user: User): string {
  const a = { user_id: String(user.user_id || ''), name: String(user.name || user.email || ''), email: String(user.email || ''), role: normalizeRole(user.role) };
  return Buffer.from(JSON.stringify(a), 'utf8').toString('base64');
}

export function festiveFetch(path: string, user: User, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json', 'X-Pulse-Secret': SECRET, 'X-Pulse-User': actor(user), ...testTagHeaders(),
  };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  return fetch(`${BASE}/api/festive-kyc${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(10000) });
}

/** POST facts to a festive-kyc route (status | claim | payment-check). */
export async function festivePost(path: string, user: User): Promise<Response> {
  const facts = await gatherFestiveFacts(user);
  return festiveFetch(path, user, { method: 'POST', body: JSON.stringify({ facts }) });
}

export async function relayFestive(up: Response, fallback: string): Promise<NextResponse> {
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const d = data?.detail;
    return NextResponse.json(
      { ok: false, error: toErrorText(typeof d === 'object' ? d?.message : d, fallback), reasons: d?.reasons },
      { status: up.status },
    );
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store, private' } });
}

/** Server-side campaign status for the signed-in teacher (deduped per request), or null. */
export const getFestiveStatus = cache(async (user: User): Promise<FestiveStatus | null> => {
  if (normalizeRole(user.role) !== 'teacher') return null;
  try {
    const r = await festivePost('/status', user);
    return r.ok ? ((await r.json()) as FestiveStatus) : null;
  } catch {
    return null;
  }
});

/** Server-side gate for InstaKYC payment: true = complimentary, NO payment order may be created.
 *  Fails CLOSED for teachers (if the campaign engine can't answer, no order is created). */
export async function instaKycIsComplimentary(user: User): Promise<boolean | 'unknown'> {
  if (normalizeRole(user.role) !== 'teacher') return false;
  try {
    const r = await festivePost('/payment-check', user);
    if (!r.ok) return 'unknown';
    const d = await r.json();
    return !!d?.complimentary;
  } catch {
    return 'unknown';
  }
}
