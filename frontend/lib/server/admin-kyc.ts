import { backendFetch } from '@/lib/server/session';

// Admin KYC review data layer (PHASE 2). Reads the AUTHORITATIVE backend queue —
// GET /api/admin/kyc/pending (applicant records + PII) and /api/admin/kyc/queue
// (counts). Admin-only: this surface is gated by requireAdminUser() at the page
// and requireAdmin() at every write BFF, so applicant PII never reaches a
// non-admin through the web.

export type KycApplicant = {
  teacherId: string;
  name: string;
  title: string | null;
  badge: string | null;
  level: string | null;
  bio: string | null;
  experienceYears: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  languages: string | null;
  certifications: string[];
  specializations: string[];
  yogaDimensions: string[];
  hourlyRate: string | null;
  offersOnline: boolean;
  offersInPerson: boolean;
  offersCorporate: boolean;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);

function projectApplicant(a: any): KycApplicant {
  return {
    teacherId: str(a.teacher_id) || '',
    name: str(a.name) || 'Unnamed teacher',
    title: str(a.title),
    badge: str(a.badge),
    level: str(a.level),
    bio: str(a.bio),
    experienceYears: Number.isFinite(Number(a.experience_years)) ? Number(a.experience_years) : null,
    city: str(a.city),
    state: str(a.state),
    country: str(a.country),
    email: str(a.email),
    phone: str(a.phone),
    whatsapp: str(a.whatsapp),
    languages: str(a.languages),
    certifications: arr(a.certifications),
    specializations: arr(a.specializations),
    yogaDimensions: arr(a.yoga_dimensions),
    hourlyRate: str(a.hourly_rate),
    offersOnline: !!a.offers_online,
    offersInPerson: !!a.offers_in_person,
    offersCorporate: !!a.offers_corporate,
  };
}

export type KycQueue = {
  applicants: KycApplicant[];
  counts: { pending: number };
  approvalRatePct: number;
  avgProcessingHours: number;
};

export async function getKycQueue(): Promise<KycQueue> {
  const [pendRes, statsRes] = await Promise.all([
    backendFetch('/admin/kyc/pending'),
    backendFetch('/dashboards/admin-stats'),
  ]);
  const pend = pendRes.ok ? await pendRes.json().catch(() => ({})) : {};
  const stats = statsRes.ok ? await statsRes.json().catch(() => ({})) : {};
  const ops = stats.operations || {};
  const applicants = (Array.isArray(pend.pending) ? pend.pending : []).map(projectApplicant).filter((a: KycApplicant) => a.teacherId);
  return {
    applicants,
    counts: { pending: applicants.length },
    approvalRatePct: Number(ops.kyc_approval_rate_pct) || 0,
    avgProcessingHours: Number(ops.avg_kyc_processing_hours) || 0,
  };
}
