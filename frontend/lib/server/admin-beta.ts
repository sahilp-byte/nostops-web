import { backendFetch } from '@/lib/server/session';

// Admin Beta Feedback data layer (PHASE 14). Reads GET /api/admin/beta-feedback.
// Resolve writes through the admin-guarded BFF; CSV export streams through a BFF
// proxy (bearer stays server-side).

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type FeedbackItem = {
  id: string;
  category: string;
  severity: number;
  persona: string | null;
  screen: string | null;
  message: string;
  reproSteps: string | null;
  contactEmail: string | null;
  devicePlatform: string | null;
  viewport: string | null;
  status: string;
  createdAt: string | null;
};

function project(f: any): FeedbackItem {
  return {
    id: str(f._id) || str(f.id) || str(f.feedback_id) || '',
    category: str(f.category) || 'general',
    severity: num(f.severity),
    persona: str(f.persona),
    screen: str(f.screen),
    message: str(f.message) || '',
    reproSteps: str(f.repro_steps),
    contactEmail: str(f.contact_email),
    devicePlatform: str(f.device_platform),
    viewport: str(f.viewport),
    status: str(f.status) || 'open',
    createdAt: str(f.created_at),
  };
}

export type BetaFeedbackData = {
  items: FeedbackItem[];
  total: number;
  open: number;
  categories: string[];
};

export async function getBetaFeedback(): Promise<BetaFeedbackData> {
  const res = await backendFetch('/admin/beta-feedback');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  const items = (Array.isArray(d.items) ? d.items : []).map(project).filter((f: FeedbackItem) => f.id);
  const categories = Array.from(new Set(items.map((f: FeedbackItem) => f.category))).sort() as string[];
  return { items, total: num(d.total) || items.length, open: num(d.open) || items.filter((f: FeedbackItem) => f.status === 'open').length, categories };
}
