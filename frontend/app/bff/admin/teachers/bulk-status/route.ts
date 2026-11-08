import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';
import { setVerification, setEmpanelment, setLevel, type FieldResult } from '@/lib/server/admin-teacher-write';
import { recordTeacherStatusChange } from '@/lib/server/audit';
import { getAdminTeacherDirectory } from '@/lib/server/admin-teachers';

// Bulk admin status change — set Verification / Empanelment / Level on many
// teachers at once, straight from the directory. CSRF-guarded + STRICTLY
// admin-only (shared guard). Reuses the SAME setters as the single-row route so
// behaviour is identical; each PERSISTED, real change is written to the local
// status-change log (who + when).
//
// Body: { teacherIds: string[], field: 'verification'|'empanelment'|'level', value }
//   verification → value ∈ 'verified' | 'not_verified'
//   empanelment  → value ∈ 'empanelled' | 'not_empanelled'
//   level        → value ∈ 0 | 1 | 2 | 3

type Field = 'verification' | 'empanelment' | 'level';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;
  const user = guard.user;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 });

  // Field: explicit `field`, else infer from a legacy `verification` key.
  const field: Field = ['verification', 'empanelment', 'level'].includes(body.field)
    ? body.field
    : typeof body.verification === 'string'
      ? 'verification'
      : (null as unknown as Field);
  const rawValue = field === 'verification' && body.value === undefined ? body.verification : body.value;

  // Validate the value per field.
  let valueStr = '';
  let levelNum = -1;
  if (field === 'verification') {
    if (rawValue !== 'verified' && rawValue !== 'not_verified') {
      return NextResponse.json({ error: 'verification must be "verified" or "not_verified".' }, { status: 400 });
    }
    valueStr = rawValue;
  } else if (field === 'empanelment') {
    if (rawValue !== 'empanelled' && rawValue !== 'not_empanelled') {
      return NextResponse.json({ error: 'empanelment must be "empanelled" or "not_empanelled".' }, { status: 400 });
    }
    valueStr = rawValue;
  } else if (field === 'level') {
    levelNum = Number(rawValue);
    if (![0, 1, 2, 3].includes(levelNum)) {
      return NextResponse.json({ error: 'level must be 0, 1, 2 or 3.' }, { status: 400 });
    }
    valueStr = String(levelNum);
  } else {
    return NextResponse.json({ error: 'field must be "verification", "empanelment" or "level".' }, { status: 400 });
  }

  const rawIds: unknown[] = Array.isArray(body.teacherIds) ? body.teacherIds : [];
  const ids: string[] = Array.from(
    new Set(rawIds.filter((x): x is string => typeof x === 'string' && !!x)),
  ).slice(0, 200);
  if (ids.length === 0) return NextResponse.json({ error: 'Select at least one teacher.' }, { status: 400 });

  const reason =
    typeof body.verificationReason === 'string' && body.verificationReason.trim()
      ? body.verificationReason.slice(0, 500)
      : field === 'verification' && valueStr === 'not_verified'
        ? 'Verification revoked by NOSTOPS admin (bulk action).'
        : undefined;

  // One directory read → accurate "from" values + a no-op skip for the audit trail.
  const prev: Record<string, string> = {};
  try {
    const dir = await getAdminTeacherDirectory();
    for (const r of dir.rows) {
      prev[r.teacherId] =
        field === 'verification' ? r.verification
        : field === 'empanelment' ? r.empanelment
        : String(r.level === 'none' ? 0 : r.level);
    }
  } catch {
    /* from = null fallback */
  }

  const results: Record<string, FieldResult> = {};
  await Promise.all(
    ids.map(async (id) => {
      const r =
        field === 'verification' ? await setVerification(id, valueStr, reason)
        : field === 'empanelment' ? await setEmpanelment(id, valueStr)
        : await setLevel(id, levelNum);
      results[id] = r;
      const from = prev[id] ?? null;
      if (r.persisted && from !== valueStr) {
        await recordTeacherStatusChange(user, { teacherId: id, field, from, to: valueStr, reason });
      }
    }),
  );

  const okCount = Object.values(results).filter((r) => r.persisted).length;
  revalidatePath('/app/admin/teachers');
  return NextResponse.json({ ok: true, field, okCount, failCount: ids.length - okCount, results });
}
