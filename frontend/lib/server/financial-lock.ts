import 'server-only';
import { NextResponse } from 'next/server';
import { BLOCKED_ROUTE_MESSAGE, FINANCIAL_LOCK_MESSAGE, financialLockRule, canonicalPath, type LockRule } from '@/lib/financial-lock-rules';

// FINANCIAL SAFETY AUDIT (2026-06). The money lock is ON unless the server is
// started with FINANCIAL_ACTIONS_UNLOCKED=true — set only after the founder has
// reviewed the audit evidence and approved the next stage.
export function financialActionsLocked(): boolean {
  return process.env.FINANCIAL_ACTIONS_UNLOCKED !== 'true';
}

const detailFor = (r: LockRule) => (r.kind === 'ALWAYS' ? BLOCKED_ROUTE_MESSAGE : FINANCIAL_LOCK_MESSAGE);

/** Called by backendFetch for EVERY main-backend call: a refused call never leaves this server. */
export function refuseFinancialCall(method: string, path: string, body?: BodyInit | null): Response | null {
  // A body that isn't a string (form data, blob, stream) can't be inspected → treated as
  // unreadable, so the body-dependent rules refuse it (fail closed).
  const text = typeof body === 'string' ? body : body == null ? undefined : '\u0000';
  const rule = financialLockRule(method, path, text, financialActionsLocked());
  if (!rule) return null;
  console.warn(`[financial-lock] refused ${String(method || 'GET').toUpperCase()} /${canonicalPath(path).path} (${rule.id})`);
  return new Response(JSON.stringify({ detail: detailFor(rule), financial_lock: true, rule: rule.id }), {
    status: 423,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Early answer for BFF money routes while the lock is on (before any other check). With `flow`,
 *  the lock is checked for that one checkout only (Prompt 4F, per-checkout unlock). */
export function financialLockedJson(flow?: string): NextResponse | null {
  if (flow ? financialFlowUnlocked(flow) : !financialActionsLocked()) return null;
  return NextResponse.json({ ok: false, error: FINANCIAL_LOCK_MESSAGE, financial_lock: true }, { status: 423 });
}

/** Prompt 4F — per-checkout unlock (audit P1-3), same rule as backend/financial_lock.py.
 *  FINANCIAL_UNLOCKED_FLOWS (comma-separated) opens the money lock for the named checkouts ONLY;
 *  every other money action stays locked. Only checkouts pinned here can be opened this way. */
export const UNLOCKABLE_FLOWS: readonly string[] = ['venue_ai_onboarding'];
export function financialFlowUnlocked(flow: string): boolean {
  if (!financialActionsLocked()) return true;
  const named = String(process.env.FINANCIAL_UNLOCKED_FLOWS || '').split(',').map((s) => s.trim());
  return UNLOCKABLE_FLOWS.includes(flow) && named.includes(flow);
}
