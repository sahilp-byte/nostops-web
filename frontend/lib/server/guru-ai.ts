// Server-only "Ask GuruAI" reads. Reuses the SAME backend the mobile app uses
// (single AI + single conversation store): /home/guru-ai/history and
// /home/guru-ai/session/{id}. The chat WRITE goes through /bff/guru-ai/chat.
import { backendFetch } from '@/lib/server/session';

export type GuruMessage = { role: 'user' | 'assistant'; content: string };
export type GuruSessionSummary = {
  session_id: string;
  first_prompt: string;
  last_reply_preview: string;
  message_count: number;
  updated_at: string;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function getGuruHistory(limit = 12): Promise<GuruSessionSummary[]> {
  return safe(async () => {
    const r = await backendFetch(`/home/guru-ai/history?limit=${encodeURIComponent(String(limit))}`);
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d?.sessions) ? d.sessions : []) as GuruSessionSummary[];
  }, []);
}

export async function getGuruSession(sessionId: string): Promise<GuruMessage[]> {
  return safe(async () => {
    const r = await backendFetch(`/home/guru-ai/session/${encodeURIComponent(sessionId)}`);
    if (!r.ok) return [];
    const d = await r.json();
    return (Array.isArray(d?.messages) ? d.messages : []) as GuruMessage[];
  }, []);
}
