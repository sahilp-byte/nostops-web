import { backendFetch } from '@/lib/server/session';

// Admin onboarding conversion (live backend GET /admin/onboarding-analytics). The backend counts
// DISTINCT subjects (teacher_id → user_id → visitor_id) and reports anything before its
// instrumentation date as unavailable. Nothing here estimates or back-fills numbers.
export type OnboardingAnalytics = {
  generatedAt: string | null;
  instrumentationDate: string | null;
  preInstrumentation: string;
  countedBy: string;
  distinctSubjects: number;
  registrations: number;
  started: number;
  resumed: number;
  profileCreated: number;
  profileFailed: number;
  screenCompletions: Record<string, number>;
  abandonmentByLastScreen: Record<string, number>;
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const byScreen = (v: any) => Object.fromEntries(['1', '2', '3', '4', '5'].map((k) => [k, n(v?.[k])]));

/** null = the report could not be loaded (never replaced by guesses). */
export async function getOnboardingAnalytics(): Promise<OnboardingAnalytics | null> {
  const res = await backendFetch('/admin/onboarding-analytics').catch(() => null);
  if (!res?.ok) return null;
  const d = await res.json().catch(() => null);
  if (!d?.metrics) return null;
  const m = d.metrics;
  return {
    generatedAt: d.generated_at || null,
    instrumentationDate: d.instrumentation_date || null,
    preInstrumentation: String(d.pre_instrumentation_data || 'unavailable'),
    countedBy: String(d.counted_distinct_by || ''),
    distinctSubjects: n(d.distinct_subjects),
    registrations: n(m.registrations),
    started: n(m.onboarding_started),
    resumed: n(m.resumed),
    profileCreated: n(m.profile_created),
    profileFailed: n(m.profile_failed),
    screenCompletions: byScreen(m.screen_completions),
    abandonmentByLastScreen: byScreen(m.abandonment_by_last_screen),
  };
}
