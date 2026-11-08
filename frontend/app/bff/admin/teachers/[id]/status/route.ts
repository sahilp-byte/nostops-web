import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';
import { getAdminTeacherDetail } from '@/lib/server/admin-teachers';
import { setVerification, setEmpanelment, setLevel, type FieldResult } from '@/lib/server/admin-teacher-write';
import { recordTeacherStatusChange } from '@/lib/server/audit';

// Admin write controls for the authoritative teacher record (Prompts 9–12).
// CSRF-guarded + STRICTLY admin-only (teachers can never reach this). One POST
// saves any subset of { verification, empanelment, level } and reports a
// per-field result so the UI can show an honest confirmation. The three setters
// live in lib/server/admin-teacher-write.ts so the bulk route behaves identically.
//   • Empanelment  → REAL setter: POST /admin/empanelment/{id} {is_empanelled}.  PERSISTS today.
//   • Verification → dedicated POST /admin/teachers/{id}/verification (+ KYC approve/reject fallback).
//   • Level        → dedicated POST /admin/teachers/{id}/level (honest "activates when live" until it ships).

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const user = guard.user;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Unknown teacher.' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 });

  // Snapshot the authoritative BEFORE values so the audit trail can record prev → new.
  const before = await getAdminTeacherDetail(id).catch(() => null);

  const results: Record<string, FieldResult> = {};

  if (typeof body.empanelment === 'string' && ['empanelled', 'pending', 'not_empanelled'].includes(body.empanelment)) {
    results.empanelment = await setEmpanelment(id, body.empanelment);
  }
  if (typeof body.verification === 'string' && ['verified', 'pending', 'not_verified'].includes(body.verification)) {
    const reason = typeof body.verificationReason === 'string' ? body.verificationReason.slice(0, 500) : undefined;
    results.verification = await setVerification(id, body.verification, reason);
  }
  if (body.level !== undefined) {
    const lvl = Number(body.level);
    if ([0, 1, 2, 3].includes(lvl)) results.level = await setLevel(id, lvl);
  }

  if (Object.keys(results).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  // AUDIT TRAIL — record WHO changed WHAT and WHEN into the local status-change
  // log (the frozen remote backend keeps no such trail). Only for fields that
  // ACTUALLY persisted AND changed. Best-effort: a failure must never block the save.
  try {
    const writes: Promise<void>[] = [];
    const log = (field: string, from: unknown, to: unknown) => {
      if (from === to) return; // no-op change
      writes.push(recordTeacherStatusChange(user, { teacherId: id, field, from, to }));
    };
    if (results.empanelment?.persisted) log('empanelment', before?.row.empanelment, body.empanelment);
    if (results.verification?.persisted) log('verification', before?.row.verification, body.verification);
    if (results.level?.persisted) log('level', before?.row.level, Number(body.level));
    if (writes.length) await Promise.allSettled(writes);
  } catch {
    /* audit is best-effort; it must never block or fail the save */
  }

  // Purge caches so the review page + directory re-read the authoritative record.
  revalidatePath(`/app/admin/teachers/${id}`);
  revalidatePath('/app/admin/teachers');

  const anyPersisted = Object.values(results).some((r) => r.persisted);
  return NextResponse.json({ ok: true, anyPersisted, results });
}
