// NOSTOPS Institutional Program Engine — server-only data layer (Prompt 2).
// Talks to the ISOLATED local engine (/api/institutional/*) with the server-only
// shared secret + a server-built identity (X-Pulse-User). The browser never
// reaches it directly and never holds the secret. Reads are SSR; writes go via
// /bff/institutional/* (CSRF-guarded). Mirrors lib/server/verification.ts.
import { testTagHeaders } from '@/lib/server/test-tag';
import 'server-only';
import { normalizeRole, personaLabel, type User } from '@/lib/roles';

const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const TIMEOUT_MS = 8000;

export type Actor = { user_id: string; name: string; role: string; persona?: string };

export function institutionalActor(user: User): Actor {
  return {
    user_id: String(user.user_id || ''), // a genuine user ID only — never an email fallback (Phase 5B)
    name: (user.name as string) || (user.email as string) || 'Member',
    role: normalizeRole(user.role),
    persona: personaLabel(user),
  };
}

function userHeader(actor: Actor): string {
  return Buffer.from(JSON.stringify(actor), 'utf8').toString('base64');
}

export async function institutionalFetch(
  path: string,
  opts: { method?: string; body?: unknown; actor?: Actor | null; participantSession?: string | null; timeoutMs?: number } = {},
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() };
  // Fail closed: an identity without a genuine user ID is never sent to the engine.
  if (opts.actor && !opts.actor.user_id) return new Response(JSON.stringify({ detail: 'A signed-in NOSTOPS account is required.' }), { status: 401 });
  if (opts.actor) headers['X-Pulse-User'] = userHeader(opts.actor);
  if (opts.participantSession) headers['X-Participant-Session'] = opts.participantSession;
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
  return fetch(`${BASE}/api/institutional${path}`, init);
}

async function safeJson<T>(p: Promise<Response>, fallback: T): Promise<T> {
  try {
    const r = await p;
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`[institutional] ${r.status} ${r.url} ${body.slice(0, 500)}`);
      return fallback;
    }
    return (await r.json()) as T;
  } catch (err) {
    console.error('[institutional] request failed', err);
    return fallback;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type Taxonomy = 'MIND' | 'BODY' | 'SPECIAL_NEEDS';

export type Programme = {
  programme_id: string;
  slug: string;
  name: string;
  taxonomy: Taxonomy;
  taxonomy_label: string;
  taxonomy_slug: string;
  essence: string;
  objectives: string[];
  default_duration_minutes: number;
  level: string;
  recommended_audience?: string[];
  recommended_group_size?: string | null;
  recommended_frequency?: string | null;
  recommended_duration_label?: string | null;
  languages?: string[];
  teacher_competency_requirements?: string[];
  council_attribution?: string | null;
  guru_attribution?: string | null;
  provenance?: string;
  version?: string;
  content_status?: string;
  is_seed?: boolean;
  disclaimer?: string;
  council_curated: boolean;
};

export type ProgrammeCatalogue = {
  programmes: Programme[];
  count: number;
  by_taxonomy: Record<Taxonomy, Programme[]>;
  taxonomy: { key: Taxonomy; label: string; slug: string }[];
};

export type Organisation = {
  organisation_id: string;
  name: string;
  slug: string;
  cohort_type: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  primary_city?: string | null;
  city_slug?: string | null;
  is_launch_city?: boolean;
  contact_email?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  trust_state: string;
  my_role?: string;
};

export type OrgMember = {
  member_id: string;
  organisation_id: string;
  user_id: string;
  name: string;
  email?: string | null;
  member_role: string;
  event_creator: boolean;
  event_creator_role?: string | null;
  programme_champion?: boolean;
  status: string;
};

export type InstEvent = {
  event_id: string;
  slug: string | null;
  organisation_id: string;
  cohort_type: string;
  programme_id: string;
  programme_snapshot: Record<string, any>;
  title: string;
  subtitle?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  timezone?: string | null;
  city?: string | null;
  city_slug?: string | null;
  venue?: string | null;
  venue_type?: string | null;
  external_venue_cost?: number | null;
  community_space_contribution?: boolean;
  capacity?: number | null;
  language?: string | null;
  registration_closing_date?: string | null;
  visibility: string;
  programme_champion?: { member_id: string; name?: string; email?: string } | null;
  preferred_teacher_id?: string | null;
  source_event_id?: string | null;
  lifecycle: string;
  lifecycle_effective?: string;
  completed_retention_until?: string | null;
  published_at?: string | null;
  // §1 — explicit teacher confirmation state (confirm-first). assigned_teacher is
  // only populated by the backend once teacher_confirmed is true.
  teacher_state?: string | null;
  teacher_state_label?: string | null;
  teacher_confirmed?: boolean;
  assigned_teacher?: { name?: string; handle?: string; status?: string } | null;
  // B2.2 — repeating programme (null/absent = a single session).
  schedule?: EventSchedule | null;
  schedule_label?: string | null;
  last_session_date?: string | null;
};

export type EventSchedule = {
  type: 'SINGLE' | 'RECURRING';
  sessions_per_week: number;
  weekdays: number[]; // 0 = Monday … 6 = Sunday
  end_date?: string | null;
  session_count: number;
};

// One session of a repeating programme; capacity applies to each session.
export type PublicSession = {
  session_id: string;
  seq: number;
  date: string;
  confirmed: number;
  seats_remaining: number | null;
  is_full: boolean;
  is_past: boolean;
};

export type PublicEvent = {
  // Phase 5B — set on NOSTOPS Spaces programmes (no organisation; hosted at an approved Space).
  host_kind?: 'SPACE';
  space?: { id: string; name?: string; model?: string; locality?: string; district?: string; state?: string; pin?: string } | null;
  event_id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  cohort_type: string;
  programme: {
    name: string;
    taxonomy: Taxonomy;
    taxonomy_label: string;
    essence: string;
    objectives: string[];
    level: string;
    recommended_audience?: string[];
    recommended_group_size?: string | null;
    recommended_frequency?: string | null;
    recommended_duration_label?: string | null;
    languages?: string[];
    council_attribution?: string | null;
    provenance?: string | null;
    version?: string | null;
    council_curated: boolean;
    content_status?: string;
  };
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  timezone?: string | null;
  city?: string | null;
  city_slug?: string | null;
  venue?: string | null;
  venue_type?: string | null;
  community_space_contribution?: boolean;
  capacity?: number | null;
  language?: string | null;
  registration_closing_date?: string | null;
  schedule?: EventSchedule | null;
  schedule_label?: string | null;
  last_session_date?: string | null;
  sessions?: PublicSession[] | null;
  visibility: string;
  lifecycle: string;
  /** Server-derived lifecycle (PUBLISHED → LIVE on the day → COMPLETED after it ends). */
  lifecycle_effective?: string;
  published_at?: string | null;
  organisation: {
    name: string;
    logo_url?: string | null;
    description?: string | null;
    verified: boolean;
    trust_state: string;
  } | null;
  teacher_status: string;
  teacher?: { name?: string; handle?: string; verified?: boolean } | null;
  teacher_confirmed?: boolean;
  teacher_verified?: boolean;
  registration_status: string;
  // §8 — live registration window + capacity (drives the public Register CTA).
  registration_access?: string;
  pricing_type?: string;
  is_free?: boolean;
  participant_fee?: number | null;
  registration_open?: boolean;
  registration_closed_reason?: string | null;
  seats_remaining?: number | null;
  is_full?: boolean;
  confirmed_count?: number;
  canonical_path?: string | null;
  og_image?: string | null;
  discovery_eligible?: boolean;
  indexable: boolean;
  demo?: boolean;
  demo_label?: string | null;
};

export type EngineMeta = {
  version: string;
  taxonomy: { key: string; label: string; slug: string }[];
  event_lifecycle: string[];
  event_visibility: string[];
  venue_types?: { key: string; label: string }[];
  default_timezone?: string;
  timezones?: string[];
  launch_cities: { name: string; slug: string }[];
  cohorts: { key: string; label: string }[];
  event_creator_roles: string[];
};

// ── Reads ──────────────────────────────────────────────────────────────────
export async function getEngineMeta(): Promise<EngineMeta | null> {
  return safeJson<EngineMeta | null>(institutionalFetch('/meta'), null);
}

export async function listProgrammes(taxonomy?: string): Promise<ProgrammeCatalogue | null> {
  const q = taxonomy ? `?taxonomy=${encodeURIComponent(taxonomy)}` : '';
  return safeJson<ProgrammeCatalogue | null>(institutionalFetch(`/programmes${q}`), null);
}

export async function getProgramme(id: string): Promise<Programme | null> {
  const d = await safeJson<{ programme?: Programme }>(institutionalFetch(`/programmes/${encodeURIComponent(id)}`), {});
  return d.programme ?? null;
}

export async function listMyOrganisations(user: User): Promise<Organisation[]> {
  const d = await safeJson<{ organisations?: Organisation[] }>(
    institutionalFetch('/organisations', { actor: institutionalActor(user) }), {},
  );
  return d.organisations ?? [];
}

export async function getOrganisation(user: User, id: string): Promise<Organisation | null> {
  const d = await safeJson<{ organisation?: Organisation }>(
    institutionalFetch(`/organisations/${encodeURIComponent(id)}`, { actor: institutionalActor(user) }), {},
  );
  return d.organisation ?? null;
}

export async function listOrgMembers(user: User, id: string): Promise<OrgMember[]> {
  const d = await safeJson<{ members?: OrgMember[] }>(
    institutionalFetch(`/organisations/${encodeURIComponent(id)}/members`, { actor: institutionalActor(user) }), {},
  );
  return d.members ?? [];
}

export async function listMyEvents(user: User): Promise<InstEvent[]> {
  const d = await safeJson<{ events?: InstEvent[] }>(
    institutionalFetch('/events', { actor: institutionalActor(user) }), {},
  );
  return d.events ?? [];
}

export async function getEventOwner(user: User, id: string): Promise<{ event: InstEvent; organisation: Organisation | null } | null> {
  try {
    const r = await institutionalFetch(`/events/${encodeURIComponent(id)}`, { actor: institutionalActor(user) });
    if (!r.ok) return null;
    return (await r.json()) as { event: InstEvent; organisation: Organisation | null };
  } catch {
    return null;
  }
}

export async function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  if (isQaEventSlug(slug)) return null;
  const d = await safeJson<{ event?: PublicEvent }>(institutionalFetch(`/public/events/${encodeURIComponent(slug)}`), {});
  const ev = d.event ?? null;
  // QA/test events (and events of QA test organisations) never reach the public.
  if (ev && isQaEvent(slug, ev.title, ev.organisation?.name)) return null;
  return ev;
}

// QA/test institutional records created during preview testing.
const QA_MARK = /\b(web)?qa\b/i;
function isQaEventSlug(slug: string): boolean {
  return /(^|-)(web)?qa(-|$)/i.test(slug);
}
/** One rule for the event page AND the sitemap, so a hidden event is never advertised. */
function isQaEvent(slug: string, title?: string | null, orgName?: string | null): boolean {
  return isQaEventSlug(slug) || QA_MARK.test(title || '') || QA_MARK.test(orgName || '');
}

// Indexable PUBLIC events for the public sitemap (§5). UNLISTED/PRIVATE and
// unverified-org events are excluded by the backend.
export type PublicEventSitemapEntry = {
  slug: string;
  title?: string | null;
  organisation_name?: string | null;
  city?: string | null;
  event_date?: string | null;
  updated_at?: string | null;
};
export async function listPublicIndexableEvents(): Promise<PublicEventSitemapEntry[]> {
  const d = await safeJson<{ events?: PublicEventSitemapEntry[] }>(institutionalFetch('/public/events'), {});
  return (d.events ?? []).filter((e) => !!e.slug && !isQaEvent(e.slug, e.title, e.organisation_name));
}

// ── Permanent public DEMONSTRATION showcase (demo-seeded orgs + events) ───────
export type ShowcaseEvent = {
  /** null for illustrative examples (no public page). */
  slug: string | null;
  title: string;
  subtitle?: string | null;
  programme_name?: string | null;
  taxonomy?: Taxonomy | null;
  taxonomy_label?: string | null;
  city?: string | null;
  event_date?: string | null;
  lifecycle: string;
  /** Clearly labelled illustrative example: not a real session, not bookable, no teacher. */
  illustrative_only?: boolean;
  registration_access?: string | null;
  registration_access_label?: string | null;
  teacher_name?: string | null;
  teacher_verified?: boolean;
};
export type ShowcaseOrg = {
  organisation_id: string;
  name: string;
  short_name?: string | null;
  slug: string;
  cohort_type: string;
  city?: string | null;
  industry?: string | null;
  org_size?: string | null;
  logo_url?: string | null;
  website?: string | null;
  description?: string | null;
  verified: boolean;
  demo_label?: string | null;
  events: ShowcaseEvent[];
};
export type ShowcaseCohort = { key: string; label: string; organisations: ShowcaseOrg[] };
export type Showcase = { cohorts: ShowcaseCohort[]; organisation_count: number } | null;

export async function getShowcase(): Promise<Showcase> {
  return safeJson<Showcase>(institutionalFetch('/public/showcase'), null);
}

export function showcaseCohort(data: Showcase, key: string): ShowcaseCohort | null {
  return data?.cohorts.find((c) => c.key === key) ?? null;
}

// ── §11 Teacher matching · §12 attendance/feedback · organiser roster ─────────
export type TeacherAssignment = {
  assignment_id: string;
  status?: string;
  match_quality?: string;
  event_id: string;
  event_slug?: string | null;
  event_title?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  city?: string | null;
  venue?: string | null;
  timezone?: string | null;
  programme_name?: string | null;
  programme_taxonomy_label?: string | null;
  programme_essence?: string | null;
  organisation_name?: string | null;
  capacity?: number | null;
  duration_minutes?: number | null;
  language?: string | null;
  schedule_label?: string | null;
  session_count?: number | null;
  last_session_date?: string | null;
  venue_type?: string | null;
  community_space_contribution?: boolean | null;
  economics?: Record<string, unknown> | null;
  lifecycle_effective?: string | null;
  roster_count?: number;
  attended_count?: number;
  feedback?: FeedbackSummary | null;
};

export type RosterRow = {
  registration_id: string;
  name?: string | null;
  email?: string | null;
  participant_type?: string | null;
  department?: string | null;
  phone?: string | null;
  booking_status?: string;
  payment_status?: string;
  attendance_status?: string | null;
  created_at?: string;
  session_id?: string | null;
  session_date?: string | null;
  session_seq?: number | null;
};

export type RosterSession = PublicSession & { waitlisted: number; attended: number };

export type FeedbackSummary = {
  count: number;
  average: number | null;
  distribution: Record<string, number>;
  comments: { rating?: number; comment?: string; created_at?: string }[];
};

export type RosterSummary = { total: number; confirmed: number; waitlisted: number; cancelled: number; pending: number; attended: number; attendance_rate?: number };

export type RenewalInsights = { can_renew: boolean; participants: number; attended: number; attendance_rate: number; avg_rating: number | null; feedback_count: number };

export async function syncTeacherDirectory(
  user: User,
  body: {
    name?: string; handle?: string; city?: string; email?: string;
    level?: string; languages?: string[]; specializations?: string[];
    taxonomies?: string[]; experience_years?: number; rating?: number;
    empanelled?: boolean; id_verified?: boolean;
  },
): Promise<{ newly_matched: number; profile?: { taxonomies: string[]; adaptive_practice_verified: boolean }; rejected_pathways?: string[] } | null> {
  try {
    const r = await institutionalFetch('/teacher/directory/sync', { method: 'POST', actor: institutionalActor(user), body });
    if (!r.ok) return null;
    return (await r.json()) as { newly_matched: number; profile?: { taxonomies: string[]; adaptive_practice_verified: boolean }; rejected_pathways?: string[] };
  } catch {
    return null;
  }
}

export async function getTeacherAssignments(user: User): Promise<TeacherAssignment[]> {
  const d = await safeJson<{ assignments?: TeacherAssignment[] }>(
    institutionalFetch('/teacher/assignments', { actor: institutionalActor(user) }), {},
  );
  return d.assignments ?? [];
}

export type TeacherEventDetail = {
  assignment: TeacherAssignment;
  can_mark_attendance: boolean;
  assignment_status?: string | null;
  can_respond?: boolean;
  can_give_feedback?: boolean;
  my_feedback?: { rating?: number; comment?: string | null } | null;
  roster: RosterRow[];
  sessions?: { session_id: string; seq: number; date: string; can_mark: boolean }[];
  feedback: FeedbackSummary;
};

export async function getTeacherEvent(user: User, eventId: string): Promise<TeacherEventDetail | null> {
  try {
    const r = await institutionalFetch(`/teacher/events/${encodeURIComponent(eventId)}`, { actor: institutionalActor(user) });
    if (!r.ok) return null;
    return (await r.json()) as TeacherEventDetail;
  } catch {
    return null;
  }
}

export async function getEventRoster(user: User, eventId: string): Promise<
  { event: { event_id: string; title?: string; slug?: string; event_date?: string; city?: string; schedule_label?: string | null; lifecycle_effective?: string; teacher_state?: string | null; teacher_state_label?: string | null; teacher_confirmed?: boolean; teacher_verified?: boolean; assigned_teacher?: { name?: string; handle?: string } | null }; summary: RosterSummary; registrations: RosterRow[]; sessions?: RosterSession[]; feedback: FeedbackSummary; renewal: RenewalInsights } | null
> {
  try {
    const r = await institutionalFetch(`/events/${encodeURIComponent(eventId)}/registrations`, { actor: institutionalActor(user) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── §12 Council programme adoption (non-PII aggregates) ───────────────────────
export type CouncilProgrammeUsage = {
  programme_id: string;
  name: string;
  taxonomy: Taxonomy;
  taxonomy_label: string;
  version?: string | null;
  council_attribution?: string | null;
  provenance?: string | null;
  event_count: number;
  published_count: number;
  draft_count: number;
  organisation_count: number;
  city_count: number;
};
export type CouncilUsage = {
  programmes: CouncilProgrammeUsage[];
  programme_count: number;
  total_events: number;
  total_published: number;
  adopting_organisations: number;
  by_taxonomy: { taxonomy: Taxonomy; taxonomy_label: string; programme_count: number; event_count: number }[];
  council_attribution: string;
} | null;

export async function getCouncilProgrammeUsage(user: User): Promise<CouncilUsage> {
  return safeJson<CouncilUsage>(
    institutionalFetch('/council/programme-usage', { actor: institutionalActor(user) }), null,
  );
}

// ── §12 Council programme QUALITY intelligence (knowledge layer, non-PII) ─────
export type Theme = { theme: string; count: number };
export type TrendPoint = { month: string; events: number };
export type CouncilProgrammeQuality = {
  programme_id: string;
  name: string;
  taxonomy: Taxonomy;
  taxonomy_label: string;
  version?: string | null;
  organisation_count: number;
  event_count: number;
  participation: number;
  attended: number;
  attendance_rate: number;
  distinct_attendees: number;
  repeat_participation: number;
  repeat_rate: number;
  participant_rating: number | null;
  participant_rating_count: number;
  participant_themes: Theme[];
  teacher_rating: number | null;
  teacher_rating_count: number;
  teacher_themes: Theme[];
  cities: string[];
  trend: TrendPoint[];
  governance: { health: string; signals: string[] };
};
export type CouncilQuality = {
  programmes: CouncilProgrammeQuality[];
  programme_count: number;
  total_events: number;
  total_participation: number;
  total_attended: number;
  overall_attendance_rate: number;
  overall_participant_rating: number | null;
  adopting_organisations: number;
  governance_summary: {
    performing_strongly: number;
    needs_refinement: number;
    low_participation: number;
    strong_repeat: number;
  };
  governance_note: string;
  council_attribution: string;
  privacy_note: string;
} | null;

export async function getCouncilProgrammeQuality(user: User): Promise<CouncilQuality> {
  return safeJson<CouncilQuality>(
    institutionalFetch('/council/programme-quality', { actor: institutionalActor(user) }), null,
  );
}

// ── §13 Admin institutional overview + escalation inbox ───────────────────────
export type AdminInstEvent = {
  event_id: string;
  title: string;
  lifecycle: string;
  visibility: string;
  organisation_id: string;
  programme?: string | null;
  programme_version?: string | null;
  city?: string | null;
  event_date?: string | null;
  created_at?: string | null;
};
export type AdminInstOverview = {
  organisations: Organisation[];
  organisation_count: number;
  events: AdminInstEvent[];
  event_count: number;
  draft_count: number;
  programme_usage: { programme_id: string; name?: string | null; count: number }[];
} | null;

export async function getAdminInstitutionalOverview(user: User): Promise<AdminInstOverview> {
  return safeJson<AdminInstOverview>(
    institutionalFetch('/admin/overview', { actor: institutionalActor(user) }), null,
  );
}

// §5 — configurable teacher offer response window (admin platform setting).
export type AdminSettings = {
  teacher_response_window_hours: number;
  teacher_response_window_default: number;
  is_default: boolean;
} | null;

export async function getAdminSettings(user: User): Promise<AdminSettings> {
  return safeJson<AdminSettings>(
    institutionalFetch('/admin/settings', { actor: institutionalActor(user) }), null,
  );
}

export type DirectoryTeacher = {
  teacher_id: string; name?: string | null; handle?: string | null; city?: string | null;
  taxonomies: string[]; invalid_taxonomies?: string[]; languages?: string[]; level?: string | null;
  adaptive_practice_verified: boolean;
  adaptive_practice_verified_at?: string | null; adaptive_practice_note?: string | null; is_demo: boolean;
};

// SPECIAL NEEDS events that still need a teacher with VERIFIED adaptive-practice
// competence (eligibility-based, not self-declared pathways).
export type SpecialNeedsAwaiting = {
  event_id: string; title?: string | null; city?: string | null; event_date?: string | null;
  organisation_name?: string | null; programme_name?: string | null; verified_teachers_in_city: number;
  status: 'NO_VERIFIED_TEACHER_IN_CITY' | 'VERIFIED_TEACHERS_UNAVAILABLE' | 'OFFER_HELD_BY_UNVERIFIED_TEACHER';
};

// SPECIAL NEEDS — teachers + their verified adaptive-practice competence (admin).
export async function getAdminTeacherDirectory(user: User): Promise<{ teachers: DirectoryTeacher[]; awaiting: SpecialNeedsAwaiting[] }> {
  const d = await safeJson<{ teachers?: DirectoryTeacher[]; special_needs_awaiting?: SpecialNeedsAwaiting[] }>(
    institutionalFetch('/admin/teacher-directory', { actor: institutionalActor(user) }), {},
  );
  return { teachers: d?.teachers || [], awaiting: d?.special_needs_awaiting || [] };
}

// READ-ONLY audit: teachers who DECLARED Special Needs but have no reviewed
// adaptive-practice verification record (admin / Council). Changes nothing.
export type SpecialNeedsReviewRow = {
  teacher_id: string; name?: string | null; handle?: string | null; city?: string | null; level?: string | null;
  declared_pathways: string[]; is_demo_seeded: boolean;
  verification_status: 'NOT_REVIEWED' | 'REVOKED' | 'FLAG_WITHOUT_REVIEW_RECORD';
};

export async function getSpecialNeedsReview(user: User): Promise<{ teachers: SpecialNeedsReviewRow[]; generated_at?: string } | null> {
  try {
    const r = await institutionalFetch('/admin/special-needs-review', { actor: institutionalActor(user) });
    if (!r.ok) return null;
    return (await r.json()) as { teachers: SpecialNeedsReviewRow[]; generated_at?: string };
  } catch {
    return null;
  }
}

// 1:1 discovery — handles with a REVIEWED adaptive-practice verification record.
// Fails closed (empty set → no badge) if the engine is unreachable.
export async function getAdaptiveVerifiedHandles(): Promise<Set<string>> {
  const d = await safeJson<{ handles?: string[] }>(institutionalFetch('/public/adaptive-verified'), {});
  return new Set(d?.handles || []);
}

export async function markAdaptiveVerified<T extends { handle: string; adaptiveVerified?: boolean }>(teachers: T[]): Promise<T[]> {
  const handles = await getAdaptiveVerifiedHandles();
  return teachers.map((t) => ({ ...t, adaptiveVerified: handles.has(t.handle) }));
}

export type Escalation = {
  reference: string;
  category: string;
  message: string;
  event_id?: string | null;
  from_role?: string | null;
  from_name?: string | null;
  created_at?: string | null;
  reply_count?: number;
  last_reply?: string | null;
  last_reply_by?: string | null;
};
export type EscalationInbox = { escalations: Escalation[]; count: number; open_count: number; categories: string[] } | null;

export async function getAdminEscalations(user: User): Promise<EscalationInbox> {
  return safeJson<EscalationInbox>(
    institutionalFetch('/admin/escalations', { actor: institutionalActor(user) }), null,
  );
}

// ── §14 City Coordinator city events (operational record, no approval, no PII) ─
export type CoordCityEvent = {
  event_id: string;
  title: string;
  city?: string | null;
  programme?: string | null;
  event_date?: string | null;
  visibility: string;
  lifecycle: string;
  slug?: string | null;
  flag?: {
    reason: string;
    reason_label: string;
    note?: string | null;
    flagged_at?: string | null;
    flagged_by_name?: string | null;
    reference?: string | null;
    replies?: { by_name?: string | null; by_role?: string | null; message: string; created_at?: string | null }[];
  } | null;
};
export type CoordCityEvents = { city?: string | null; approval_required: boolean; events: CoordCityEvent[]; count: number } | null;

// `roleOverride` lets the SERVER (after verifying coordinator eligibility against
// the remote /coordinators/me) present the institutional engine with a
// coordinator identity. The browser never sees or sets X-Pulse-User, so this
// cannot be spoofed client-side.
export async function getCoordinatorCityEvents(user: User, city?: string | null, roleOverride?: string): Promise<CoordCityEvents> {
  const actor = { ...institutionalActor(user), role: roleOverride || institutionalActor(user).role };
  const q = city ? `?city=${encodeURIComponent(city)}` : '';
  return safeJson<CoordCityEvents>(institutionalFetch(`/coordinator/city-events${q}`, { actor }), null);
}

export type CertificateVerification = {
  valid: boolean;
  reference?: string;
  participant_name?: string | null;
  event_title?: string | null;
  programme_name?: string | null;
  programme_taxonomy_label?: string | null;
  event_date?: string | null;
  city?: string | null;
  organisation_name?: string | null;
  teacher_name?: string | null;
  attended?: boolean;
};

export async function verifyCertificate(code: string): Promise<CertificateVerification> {
  try {
    const r = await institutionalFetch(`/public/certificate/verify/${encodeURIComponent(code)}`);
    if (!r.ok) return { valid: false };
    return (await r.json()) as CertificateVerification;
  } catch {
    return { valid: false };
  }
}
