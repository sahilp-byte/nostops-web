// AUTHORITATIVE teacher status model (Prompt 4). Three SEPARATE attributes —
// Verification, Empanelment and Level — never combined into one status, never
// self-assignable (all derived from read-only backend fields). This is the ONE
// place these are defined; wrappers (isTeacherVerified, getTeacherGate) delegate
// here so the whole app agrees. See TEACHER_STATUS_MODEL.md.
//
// ┌─ FOUNDATIONAL RULE (source of truth) ──────────────────────────────────────┐
// │ A teacher must be VERIFIED *before* they can be EMPANELLED.                 │
// │ Therefore  Empanelled ⇒ Verified.  The combination                         │
// │   (Verification = Not/Pending) AND (Empanelment = Empanelled)  is INVALID   │
// │ and must never be presented. This model resolves any such record by         │
// │ treating an empanelled teacher as Verified. (Verified-without-Empanelled is │
// │ the normal in-progress state and remains valid.)                            │
// └────────────────────────────────────────────────────────────────────────────┘
import { getTeacherLevel, type TeacherLevel } from '@/lib/teacher-levels';

export type VerificationStatus = 'verified' | 'pending' | 'not_verified';
export type EmpanelmentStatus = 'empanelled' | 'pending' | 'not_empanelled';
export type LevelStatus = 'none' | TeacherLevel; // 'none' (No Level Assigned) | 1 | 2 | 3

// Minimal read-only inputs (a `TeacherSelf` satisfies this structurally).
export type TeacherStatusInput = {
  kycVerified: boolean;
  kycPaid: boolean;
  panVerified?: boolean;
  bankVerified?: boolean;
  kycMethod?: string;
  isEmpanelled: boolean;
  tier?: string;
  badgePrimary?: string;
  // AUTHORITATIVE admin-set verification (Prompts 9-12). `isVerified` = pure backend
  // `is_verified`; `verificationStatusRaw` = backend `verification_status` enum. Optional
  // so legacy callers (admin projection) still work — they fall back to the KYC derivation.
  isVerified?: boolean;
  verificationStatusRaw?: string;
};

// Optional LIVE signals for the *pending* states, which cannot be derived from
// the teacher record alone (fast-track request + merit progress live under
// separate endpoints). Access GATES never need these — only display does.
export type TeacherStatusSignals = {
  fastTrackActive?: boolean; // a fast-track empanelment request awaiting a Council decision
  freeTrackInProgress?: boolean; // free-track merit building (paid sessions / ratings)
};

export type TeacherStatus = {
  verification: VerificationStatus;
  empanelment: EmpanelmentStatus;
  level: LevelStatus;
  // Convenience only (NOT a 4th status). Product rule (owner-approved): a teacher
  // may operate earning features when the STRICT composite holds —
  // KYC identity + InstaKYC fee payment + empanelled.
  canOperate: boolean;
};

const VALID_VERIFICATION = new Set<VerificationStatus>(['verified', 'pending', 'not_verified']);

// 'verified' = KYC identity done AND the InstaKYC fee payment made.
// 'pending'  = any KYC step started but not finished (payment/PAN/bank/method present).
// 'not_verified' = nothing started.
function kycDerivedVerification(i: TeacherStatusInput): VerificationStatus {
  if (i.kycVerified && i.kycPaid) return 'verified';
  const started = i.kycPaid || !!i.panVerified || !!i.bankVerified || !!i.kycMethod;
  return started ? 'pending' : 'not_verified';
}

// The DISPLAY verification attribute prefers the AUTHORITATIVE admin-set value
// (verification_status, else is_verified), falling back to the KYC derivation for
// legacy records with no authoritative value yet.
function displayVerification(i: TeacherStatusInput): { value: VerificationStatus; authoritative: boolean } {
  const raw = i.verificationStatusRaw;
  if (raw && VALID_VERIFICATION.has(raw as VerificationStatus)) return { value: raw as VerificationStatus, authoritative: true };
  if (i.isVerified === true) return { value: 'verified', authoritative: true };
  return { value: kycDerivedVerification(i), authoritative: false };
}

// 'empanelled' when the record says so; 'pending' when a fast-track request is
// awaiting a decision OR free-track merit is in progress; else 'not_empanelled'.
function empanelmentStatus(i: TeacherStatusInput, s?: TeacherStatusSignals): EmpanelmentStatus {
  if (i.isEmpanelled) return 'empanelled';
  if (s?.fastTrackActive || s?.freeTrackInProgress) return 'pending';
  return 'not_empanelled';
}

export function deriveTeacherStatus(i: TeacherStatusInput, s?: TeacherStatusSignals): TeacherStatus {
  const disp = displayVerification(i);
  let verification = disp.value;
  const empanelment = empanelmentStatus(i, s);
  // FOUNDATIONAL RULE (display only): verification precedes empanelment ⇒ Empanelled ⇒ Verified.
  // Resolve the invalid (Not/Pending Verified + Empanelled) DISPLAY state only when we had to
  // DERIVE verification from stale KYC data — never override an explicit authoritative admin value.
  if (!disp.authoritative && empanelment === 'empanelled' && verification !== 'verified') verification = 'verified';
  // Owner decision: a no-`tier` onboarded teacher defaults to Level 1 (Shikshak).
  const level: LevelStatus = getTeacherLevel({ tier: i.tier, badgePrimary: i.badgePrimary });
  // OPERATE gate — PRODUCT DECISION D2-bis = (C) BOTH: the strict KYC composite
  // (identity + InstaKYC fee payment + empanelled) AND the authoritative admin verification
  // (is_verified / verification_status === 'verified'). Most restrictive; computed from RAW
  // fields, deliberately independent of the display `verification` override above.
  const kycComposite = i.kycVerified && i.kycPaid && i.isEmpanelled;
  const adminVerified = i.isVerified === true || i.verificationStatusRaw === 'verified';
  const canOperate = kycComposite && adminVerified;
  return { verification, empanelment, level, canOperate };
}

// True when the raw backend record VIOLATES the foundational rule (empanelled but
// the KYC record does not (yet) show verification). Used to surface stale backend
// data to admins — the derived status already treats such teachers as Verified.
export function hasVerificationConflict(i: TeacherStatusInput): boolean {
  return !!i.isEmpanelled && !(i.kycVerified && i.kycPaid);
}
