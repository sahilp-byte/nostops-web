import { apiGetSafe } from '@/lib/api';

type FoundingIntake = {
  claimed: number;
  cap: number;
  remaining: number;
  percentage: number;
  next_seat: number;
  launch_cities: string[];
};

// ── SINGLE SOURCE OF TRUTH: total registered yoga teachers ───────────────────
// "All registered teachers, whether or not they've built a public profile."
// Served PUBLICLY by the backend at /platform/founding-intake, where `claimed`
// is the count of registered teacher accounts. Verified to equal the
// authoritative admin roster total (/admin/people/teachers → `total`), so every
// surface can show ONE consistent number without an admin login. The public
// teacher directory (teachers with a published profile) is a strict subset.
export async function getRegisteredTeacherCount(): Promise<number> {
  const intake = await apiGetSafe<FoundingIntake>(
    '/platform/founding-intake',
    { claimed: 0, cap: 1500, remaining: 1500, percentage: 0, next_seat: 1, launch_cities: [] },
    { revalidate: 60 },
  );
  return Math.max(0, Number(intake.claimed) || 0);
}
