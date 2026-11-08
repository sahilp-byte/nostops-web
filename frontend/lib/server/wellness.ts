// Server-only Yoga Seeker "Wellness Journey" data access. Reuses the SAME backend
// the mobile app uses (no new API, no new store): /wellness/my-journey, /karma/*,
// /home/my-streak, /community/leaderboard/me, /users/me/wellness-champion.
// Every call is wrapped so one failing endpoint yields an honest empty state.
import { backendFetch } from '@/lib/server/session';

export type WellnessStats = {
  sessions_attended: number;
  current_streak: number;
  avg_rating: number;
  mood_improvement: number;
};
export type WellnessJourney = {
  stats: WellnessStats;
  daily_tip: string;
  active_pilots: unknown[];
  completed_pilots: unknown[];
  upcoming_sessions: Array<Record<string, unknown>>;
  recent_feedback: Array<Record<string, unknown>>;
};
export type Karma = {
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  earn_rules: Record<string, number>;
};
export type Streak = { streak: number; today_done: boolean; last_completed_day: string | null };
export type Leaderboard = { rank: number | null; referrals: number; pool_size: number };
export type Champion = {
  available: boolean;
  total_invites: number;
  best_rank: number | null;
  badge_level: string | null;
  badge_label: string | null;
  badge_color: string | null;
  badge_icon: string | null;
  next_milestone: { invites_needed: number; badge_to_unlock: string } | null;
  batches_contributed: unknown[];
};

export type WellnessData = {
  journey: WellnessJourney;
  karma: Karma | null;
  streak: Streak;
  leaderboard: Leaderboard | null;
  champion: Champion | null;
};

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await backendFetch(path);
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_JOURNEY: WellnessJourney = {
  stats: { sessions_attended: 0, current_streak: 0, avg_rating: 0, mood_improvement: 0 },
  daily_tip: '',
  active_pilots: [],
  completed_pilots: [],
  upcoming_sessions: [],
  recent_feedback: [],
};

export async function getWellnessJourney(): Promise<WellnessData> {
  const [journey, karma, streak, leaderboard, champion] = await Promise.all([
    getJson<WellnessJourney>('/wellness/my-journey', EMPTY_JOURNEY),
    getJson<Karma | null>('/karma/balance', null),
    getJson<Streak>('/home/my-streak', { streak: 0, today_done: false, last_completed_day: null }),
    getJson<Leaderboard | null>('/community/leaderboard/me', null),
    getJson<Champion | null>('/users/me/wellness-champion', null),
  ]);
  return { journey: journey ?? EMPTY_JOURNEY, karma, streak, leaderboard, champion };
}
