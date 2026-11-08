import { backendFetch } from '@/lib/server/session';
import { getTeacherStatusLog } from '@/lib/server/audit';
import { getStatusOverrides, applyOverrideToRaw, type StatusOverride } from '@/lib/server/teacher-status-override';
import { deriveTeacherStatus } from '@/lib/teacher-status';
import { VERIFICATION_META, EMPANELMENT_META, levelLabelFull, type AdminTeacherRow } from '@/lib/admin-teacher-shared';
import { titleCase } from '@/lib/format';

// Admin Teacher Directory data layer (Prompts 5–8). Joins the AUTHORITATIVE
// existing records — NO second store:
//   • /admin/empanelment/teachers  → the full roster (all registered teachers) + empanelment
//   • /teachers/directory (admin)  → rich per-teacher fields (kyc_verified, pan_verified,
//                                     is_verified, tier, avatar, dates, all onboarding fields)
// Verification is derived via the authoritative lib/teacher-status model from the fields the
// backend exposes in bulk (kyc_paid is NOT exposed → owner decision: kyc_verified implies paid,
// PAN-started-but-not-verified ⇒ Pending). See ACCESS_CONTROL_GAPS.md / TEACHER_STATUS_MODEL.md.

const truthy = (v: any) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

// Lightweight, honest profile-completion heuristic over the fields the directory exposes.
const COMPLETION_FIELDS: ((t: any) => boolean)[] = [
  (t) => truthy(t.city),
  (t) => Number(t.experience_years) > 0,
  (t) => truthy(t.avatar_url),
  (t) => Array.isArray(t.styles) && t.styles.length > 0,
  (t) => Array.isArray(t.specializations) && t.specializations.length > 0,
  (t) => Array.isArray(t.languages_spoken) && t.languages_spoken.length > 0,
  (t) => truthy(t.parampara) || (Array.isArray(t.paramparas) && t.paramparas.length > 0),
  (t) => truthy(t.root_guru_name),
  (t) => truthy(t.lineage_declaration),
  (t) => truthy(t?.video_intro?.secure_url) || (truthy(t?.video_intro?.status) && t.video_intro.status !== 'upload_pending'),
  (t) => t?.social_media && Object.values(t.social_media).some((v) => truthy(v)),
];
function computeCompletion(t: any): number {
  const done = COMPLETION_FIELDS.reduce((n, f) => n + (f(t) ? 1 : 0), 0);
  return Math.round((done / COMPLETION_FIELDS.length) * 100);
}

function projectRow(e: any, d: any, ov?: StatusOverride | null): AdminTeacherRow {
  const inDirectory = !!d;
  const src = applyOverrideToRaw(d || {}, ov);
  const status = deriveTeacherStatus({
    kycVerified: !!src.kyc_verified,
    kycPaid: !!src.kyc_verified, // kyc_paid not exposed in bulk; verification implies payment (owner 1a)
    panVerified: !!src.pan_verified,
    bankVerified: false,
    isEmpanelled: !!(e?.is_empanelled ?? src.is_empanelled),
    tier: src.tier || undefined,
    badgePrimary: src.badge_primary || undefined,
  });
  // AUTHORITATIVE verification (admin-set is_verified / verification_status) is the
  // source of truth for the admin views. Fall back to the KYC-derived status only
  // when the backend has no explicit value yet (legacy records). This does NOT touch
  // the teacher operational gate (isTeacherVerified/canOperate), which stays strict.
  const rawVs = typeof src.verification_status === 'string' ? src.verification_status : '';
  const verification =
    rawVs === 'verified' || rawVs === 'pending' || rawVs === 'not_verified'
      ? (rawVs as typeof status.verification)
      : src.is_verified === true
        ? 'verified'
        : status.verification;
  return {
    teacherId: e?.teacher_id || src.teacher_id,
    handle: src.handle || e?.handle || null,
    name: e?.name || src.name || 'Unnamed teacher',
    city: e?.city || src.city || '',
    avatarUrl: src.avatar_url || null,
    verification,
    empanelment: status.empanelment,
    level: status.level,
    completion: inDirectory ? computeCompletion(src) : 0,
    createdAt: src.created_at || e?.created_at || null,
    updatedAt: src.updated_at || e?.updated_at || e?.created_at || null,
    profileVisible: !!src.public_profile_visible,
    inDirectory,
  };
}

export type AdminTeacherDirectory = {
  rows: AdminTeacherRow[];
  counts: {
    total: number;
    verified: number;
    awaitingVerification: number;
    empanelled: number;
    awaitingEmpanelment: number;
    incomplete: number;
  };
};

async function fetchSources(): Promise<{ emp: any[]; dirById: Map<string, any>; peopleById: Map<string, any>; peopleTotal: number; ovById: Record<string, StatusOverride> }> {
  const [empRes, dirRes, peopleRes] = await Promise.all([
    backendFetch('/admin/empanelment/teachers'),
    backendFetch('/teachers/directory?limit=1000'),
    // The COMPLETE registered-teacher roster (same source as Recent Joins) — so
    // teachers who registered but haven't built a public profile yet (missing
    // from the directory/empanelment lists) still appear and are openable.
    // limit=200 (the endpoint's max) so the roster isn't capped at the default 50.
    backendFetch('/admin/people/teachers?limit=200'),
  ]);
  const emp = empRes.ok ? await empRes.json().catch(() => ({})) : {};
  const dir = dirRes.ok ? await dirRes.json().catch(() => ({})) : {};
  const people = peopleRes.ok ? await peopleRes.json().catch(() => ({})) : {};
  // Authoritative registered-teacher total from the roster (independent of page size).
  const peopleTotal = Number(people.total) || 0;
  const dirById = new Map<string, any>();
  for (const t of Array.isArray(dir.teachers) ? dir.teachers : []) dirById.set(t.teacher_id, t);
  const empList = Array.isArray(emp.teachers) ? emp.teachers : [];
  const peopleById = new Map<string, any>();
  for (const p of Array.isArray(people.items) ? people.items : []) {
    if (!p?.teacher_id) continue;
    peopleById.set(String(p.teacher_id), {
      teacher_id: String(p.teacher_id),
      name: p.name,
      handle: p.handle || null,
      city: p.city || '',
      created_at: p.created_at || null,
      is_empanelled: !!p.empanelled,
    });
  }
  const ids = new Set<string>([...dirById.keys(), ...empList.map((e: any) => e?.teacher_id).filter(Boolean), ...peopleById.keys()]);
  const ovById = await getStatusOverrides([...ids]);
  return { emp: empList, dirById, peopleById, peopleTotal, ovById };
}

/** Teacher ids the existing admin teacher page (/app/admin/teachers/[id]) can open — the same sources
 *  getAdminTeacherDetail resolves from. `available` is false when none of the main-backend lists answered. */
export async function getMainDirectoryTeacherIds(): Promise<{ available: boolean; ids: Set<string> }> {
  const { emp, dirById, peopleById } = await fetchSources();
  const ids = new Set<string>([...dirById.keys(), ...emp.map((e: any) => e?.teacher_id).filter(Boolean), ...peopleById.keys()]);
  return { available: ids.size > 0, ids };
}


export async function getAdminTeacherDirectory(): Promise<AdminTeacherDirectory> {
  const { emp, dirById, peopleById, peopleTotal, ovById } = await fetchSources();
  const seen = new Set<string>();
  const rows: AdminTeacherRow[] = [];
  for (const e of emp) {
    if (!e?.teacher_id || seen.has(e.teacher_id)) continue;
    seen.add(e.teacher_id);
    rows.push(projectRow(e, dirById.get(e.teacher_id), ovById[e.teacher_id]));
  }
  // Union in any visible directory teacher missing from the empanelment roster.
  for (const [id, d] of dirById) {
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push(projectRow({ teacher_id: id, name: d.name, city: d.city, is_empanelled: d.is_empanelled }, d, ovById[id]));
  }
  // Union in any registered teacher present only in the people roster (registered
  // but no public profile / not empanelled yet) — so every teacher in Recent
  // Joins is also findable and openable here.
  for (const [id, p] of peopleById) {
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push(projectRow(p, undefined, ovById[id]));
  }
  rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.name.localeCompare(b.name));

  const counts = {
    total: peopleTotal > 0 ? Math.max(peopleTotal, rows.length) : rows.length,
    verified: rows.filter((r) => r.verification === 'verified').length,
    awaitingVerification: rows.filter((r) => r.verification !== 'verified').length,
    empanelled: rows.filter((r) => r.empanelment === 'empanelled').length,
    awaitingEmpanelment: rows.filter((r) => r.empanelment !== 'empanelled').length,
    incomplete: rows.filter((r) => !r.inDirectory || r.completion < 100).length,
  };
  return { rows, counts };
}

// ── Prompt 8: per-teacher review detail (reuses the SAME authoritative records) ──
const arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const str = (v: any): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type AdminTeacherDetail = {
  row: AdminTeacherRow;
  submitted: {
    name: string;
    handle: string | null;
    title: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    experienceYears: number | null;
    languages: string[];
    styles: string[];
    specializations: string[];
    yogaDimensions: string[];
    parampara: string | null;
    paramparas: string[];
    rootGuruName: string | null;
    rootGuruLocation: string | null;
    lineageDeclaration: string | null;
    lineagePath: string[];
    offers: { corporate: boolean; group: boolean; online: boolean; privateSessions: boolean };
    premiumSession: { enabled: boolean; rateInr: number | null; durationMin: number | null } | null;
    avatarUrl: string | null;
    sampleVideoUrl: string | null;
    videoIntro: { status: string | null; secureUrl: string | null } | null;
    social: { instagram: string | null; youtube: string | null; linkedin: string | null; website: string | null };
  };
  admin: {
    kycVerified: boolean;
    panVerified: boolean;
    phoneVerified: boolean;
    isVerifiedFlag: boolean; // backend's own is_verified (may diverge from the derived status)
    isEmpanelled: boolean;
    empanelmentPath: string | null;
    empanelmentCertId: string | null;
    tier: string | null;
    badgePrimary: string | null;
    publicProfileVisible: boolean;
    isActive: boolean;
    cityCoordinatorId: string | null;
  };
};

export async function getAdminTeacherDetail(teacherId: string): Promise<AdminTeacherDetail | null> {
  const { emp, dirById, peopleById, ovById } = await fetchSources();
  const d = dirById.get(teacherId);
  const e =
    emp.find((x: any) => x?.teacher_id === teacherId) ||
    (d ? { teacher_id: teacherId, name: d.name, city: d.city, is_empanelled: d.is_empanelled } : null) ||
    peopleById.get(teacherId) ||
    null;
  if (!d && !e) return null;

  const ov = ovById[teacherId];
  const row = projectRow(e || { teacher_id: teacherId }, d, ov);
  // Merge the NOSTOPS override onto the raw record so the KYC/admin block also
  // reflects the admin's Verification & Level decision (is_verified / tier / badge).
  const s = applyOverrideToRaw(d || {}, ov);
  const social = s.social_media || {};
  return {
    row,
    submitted: {
      name: row.name,
      handle: str(s.handle),
      title: str(s.title),
      city: str(s.city),
      state: str(s.state),
      country: str(s.country),
      experienceYears: Number.isFinite(Number(s.experience_years)) ? Number(s.experience_years) : null,
      languages: arr(s.languages_spoken),
      styles: arr(s.styles),
      specializations: arr(s.specializations),
      yogaDimensions: arr(s.yoga_dimensions),
      parampara: str(s.parampara),
      paramparas: arr(s.paramparas),
      rootGuruName: str(s.root_guru_name),
      rootGuruLocation: str(s.root_guru_location),
      lineageDeclaration: str(s.lineage_declaration),
      lineagePath: arr(s.lineage_path),
      offers: {
        corporate: !!s.offers_corporate,
        group: !!s.offers_group_classes,
        online: !!s.offers_online,
        privateSessions: !!s.offers_private_sessions,
      },
      premiumSession: s.premium_session
        ? {
            enabled: !!s.premium_session.enabled,
            rateInr: Number.isFinite(Number(s.premium_session.rate_inr)) ? Number(s.premium_session.rate_inr) : null,
            durationMin: Number.isFinite(Number(s.premium_session.duration_minutes)) ? Number(s.premium_session.duration_minutes) : null,
          }
        : null,
      avatarUrl: str(s.avatar_url),
      sampleVideoUrl: str(s.sample_video_url),
      videoIntro: s.video_intro ? { status: str(s.video_intro.status), secureUrl: str(s.video_intro.secure_url) } : null,
      social: {
        instagram: str(social.instagram),
        youtube: str(social.youtube),
        linkedin: str(social.linkedin),
        website: str(social.website),
      },
    },
    admin: {
      kycVerified: !!s.kyc_verified,
      panVerified: !!s.pan_verified,
      phoneVerified: !!s.phone_verified,
      isVerifiedFlag: !!s.is_verified,
      isEmpanelled: !!(e?.is_empanelled ?? s.is_empanelled),
      empanelmentPath: str(s.empanelment_path),
      empanelmentCertId: str(s?.empanelment_cert?.cert_id),
      tier: str(s.tier),
      badgePrimary: str(s.badge_primary),
      publicProfileVisible: !!s.public_profile_visible,
      isActive: !!s.is_active,
      cityCoordinatorId: str(s.city_coordinator_id),
    },
  };
}

// ── Prompt 29: Admin status audit trail (verification / empanelment / level) ──
// The web app is a proxy over a read-only live backend with NO audit store of its
// own (option C — display-only). We READ history from the backend's audit endpoint
// and render it; until that endpoint ships this returns { available:false } so the
// UI shows an honest "activates when live" state. Writes are forwarded best-effort
// from the change choke-point (/bff/admin/teachers/[id]/status). Contract:
// /app/BACKEND_REQUEST_status_audit.md
export type TeacherStatusAuditEntry = {
  field: string; // 'verification' | 'empanelment' | 'level' | other
  fieldLabel: string;
  fromLabel: string;
  toLabel: string;
  adminName: string;
  at: string | null; // ISO timestamp
};
export type TeacherStatusHistory = { available: boolean; entries: TeacherStatusAuditEntry[] };

const AUDIT_FIELD_LABEL: Record<string, string> = {
  verification: 'Verification',
  empanelment: 'Empanelment',
  level: 'Teacher Level',
};

function auditValueLabel(field: string, v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  if (field === 'verification' && (VERIFICATION_META as Record<string, { label: string }>)[s]) {
    return (VERIFICATION_META as Record<string, { label: string }>)[s].label;
  }
  if (field === 'empanelment' && (EMPANELMENT_META as Record<string, { label: string }>)[s]) {
    return (EMPANELMENT_META as Record<string, { label: string }>)[s].label;
  }
  if (field === 'level') {
    const n = Number(v);
    if (s === 'none' || n === 0) return levelLabelFull('none');
    if (n === 1 || n === 2 || n === 3) return levelLabelFull(n);
    return s; // already a label
  }
  return titleCase(s);
}

function normalizeAuditEntry(e: any): TeacherStatusAuditEntry | null {
  if (!e || typeof e !== 'object') return null;
  const field = (String(e.field ?? e.attribute ?? e.type ?? '').toLowerCase() || 'status').replace(/\s+/g, '_');
  const from = e.from ?? e.previous ?? e.previous_value ?? e.old ?? e.old_value ?? null;
  const to = e.to ?? e.new ?? e.new_value ?? e.value ?? null;
  const adminName = String(e.admin_name ?? e.changed_by_name ?? e.changed_by ?? e.actor_name ?? e.actor ?? 'NOSTOPS Admin').trim() || 'NOSTOPS Admin';
  const at = e.at ?? e.timestamp ?? e.created_at ?? e.changed_at ?? null;
  return {
    field,
    fieldLabel: AUDIT_FIELD_LABEL[field] ?? titleCase(field),
    fromLabel: auditValueLabel(field, from),
    toLabel: auditValueLabel(field, to),
    adminName,
    at: typeof at === 'string' ? at : null,
  };
}

export async function getTeacherStatusHistory(teacherId: string): Promise<TeacherStatusHistory> {
  // Source of truth = the LOCAL status-change log (the frozen remote backend
  // keeps no audit trail). Every admin Verify/Disable/Empanel/Level change is
  // written there by the change choke-points and read back here.
  const { available, entries: raw } = await getTeacherStatusLog(teacherId);
  const entries = raw.map(normalizeAuditEntry).filter(Boolean) as TeacherStatusAuditEntry[];
  // Newest first (defensive — order not guaranteed).
  entries.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return { available, entries };
}

// ── Teacher Record Reconciliation (read-only) ─────────────────────────────────────────────────
export type RosterTeacher = {
  teacher_id: string;
  user_id: string | null;
  name: string;
  handle: string | null;
  city: string;
  email: string | null;
  empanelled: boolean;
  is_active: boolean | null;
  suspended_until: string | null;
  deleted_at: string | null;
  created_at: string | null;
  status: string | null;
};

/** The full registered-teacher roster exactly as the backend returns it (read-only, max 200). */
export async function getTeacherRoster(): Promise<{ ok: boolean; total: number; items: RosterTeacher[] }> {
  const res = await backendFetch('/admin/people/teachers?limit=200&status=all').catch(() => null);
  const d = res?.ok ? await res.json().catch(() => ({})) : {};
  const items: RosterTeacher[] = (Array.isArray(d.items) ? d.items : []).map((p: any) => ({
    teacher_id: String(p?.teacher_id || ''),
    user_id: p?.user_id ? String(p.user_id) : null,
    name: String(p?.name || ''),
    handle: p?.handle ? String(p.handle) : null,
    city: String(p?.city || ''),
    email: p?.email ? String(p.email) : null,
    empanelled: !!p?.empanelled,
    is_active: typeof p?.is_active === 'boolean' ? p.is_active : null,
    suspended_until: p?.suspended_until || null,
    deleted_at: p?.deleted_at || null,
    created_at: p?.created_at || null,
    status: p?.status ? String(p.status) : null,
  }));
  return { ok: !!res?.ok, total: Number(d.total) || items.length, items };
}
