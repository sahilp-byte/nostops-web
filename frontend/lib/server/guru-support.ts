// Server-side readers for the admin Support Queue page. The bearer secret stays
// on the server; the page is additionally gated by requireAdminUser().
import { testTagHeaders } from '@/lib/server/test-tag';
const AI_BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';

export type SupportNote = { text: string; author: string; at: string };
export type SupportRequest = {
  id: string;
  ref: string;
  name: string | null;
  email: string;
  role: string | null;
  category: string;
  issue: string;
  summary: string | null;
  conversation: { role: string; content: string }[];
  page_type: string | null;
  route: string | null;
  reference: string | null;
  priority: string;
  status: string;
  assignee: string | null;
  notes: SupportNote[];
  created_at: string | null;
  updated_at: string | null;
};

export type SupportAnalytics = {
  total_requests: number;
  open_requests: number;
  total_chats: number;
  escalation_rate: number | null;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_page: Record<string, number>;
  categories: string[];
  statuses: string[];
};

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${AI_BASE}${path}`, {
      headers: { Accept: 'application/json', 'X-Pulse-Secret': SECRET, ...testTagHeaders() },
      cache: 'no-store',
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getSupportRequests(status = 'open'): Promise<SupportRequest[]> {
  const data = await get<{ items?: SupportRequest[] }>(`/api/guru/support/requests?status=${encodeURIComponent(status)}`, {});
  return Array.isArray(data.items) ? data.items : [];
}

export async function getSupportAnalytics(): Promise<SupportAnalytics> {
  return get<SupportAnalytics>('/api/guru/support/analytics', {
    total_requests: 0,
    open_requests: 0,
    total_chats: 0,
    escalation_rate: null,
    by_category: {},
    by_status: {},
    by_priority: {},
    by_page: {},
    categories: [],
    statuses: [],
  });
}
