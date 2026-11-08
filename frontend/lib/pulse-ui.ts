// Client-safe Teacher Pulse helpers + shared types (no server imports).
export type PulseCategoryLite = { id?: string; slug: string; name: string; description?: string; thread_count?: number };
export type PulseThreadLite = {
  id: string; category_slug?: string; category_name?: string; title: string; body?: string;
  author_id: string; author_name: string; author_persona: string;
  author_handle?: string | null; author_public?: boolean;
  status: string; pinned: boolean; reply_count: number; participant_count?: number;
  created_at: number; last_activity_at: number; edited_at?: number | null;
  open_reports?: number; flagged?: boolean; official?: boolean; featured?: boolean;
};
export type PulsePostLite = {
  id: string; thread_id: string; body: string; author_id: string; author_name: string;
  author_persona: string; author_handle?: string | null; author_public?: boolean;
  status: string; created_at: number; edited_at?: number | null;
};

export function timeAgo(ms?: number | null): string {
  if (!ms) return '';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function fmtDate(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const AVATAR_COLORS = ['#0D9488', '#0EA5E9', '#8B5CF6', '#F59E0B', '#0F766E', '#DB2777', '#4F46E5'];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export function initials(name: string): string {
  return (name || 'T').trim().charAt(0).toUpperCase();
}

export const STATUS_LABEL: Record<string, string> = {
  PRE_LAUNCH: 'Pre-launch', ACTIVE: 'Active', CLOSING_SOON: 'Closing soon', ARCHIVED: 'Archived',
};
