import 'server-only';
import { backendFetch } from '@/lib/server/session';
import { testTagHeaders } from '@/lib/server/test-tag';
import { isTeacherActivePublic } from '@/lib/public-teacher';

// Photo reminder email (admin). Recipients = teachers listed publicly (same policy as /teachers) with no
// profile photo; emails come from the main backend's admin teacher roster (admin session only). The local
// service sends each teacher the email once, ever, and reports who already got it.
const BASE = (process.env.PULSE_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const SECRET = process.env.PULSE_SHARED_SECRET || '';
const PAGE = 200;

export function photoReminderFetch(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  return fetch(`${BASE}/api/teacher-photo-reminder${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Pulse-Secret': SECRET,
      ...testTagHeaders(),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export type PhotoReminderStatus = 'due' | 'sent' | 'failed' | 'sending' | 'no_email';
export type PhotoCandidate = {
  teacherId: string;
  name: string;
  handle: string;
  email: string | null;
  status: PhotoReminderStatus;
  at: string | null;
};
export type PhotoReminderRun = { started_at: string; sent: number; failed: number; already: number; preview_skipped: number };
export type PhotoReminderData = { rows: PhotoCandidate[]; runs: PhotoReminderRun[]; preview: boolean };

const hasPhoto = (t: any) => [t?.avatar_url, t?.avatar_base64].some((v) => typeof v === 'string' && v.trim());

async function teacherEmails(): Promise<Map<string, string> | null> {
  const out = new Map<string, string>();
  for (let skip = 0; skip < 5000; skip += PAGE) {
    const r = await backendFetch(`/admin/people/teachers?limit=${PAGE}&skip=${skip}`);
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    const items: any[] = Array.isArray(d?.items) ? d.items : [];
    for (const p of items) {
      if (p?.teacher_id && typeof p.email === 'string' && p.email.trim() && !p.deleted_at) out.set(String(p.teacher_id), p.email.trim());
    }
    if (items.length < PAGE || skip + PAGE >= Number(d?.total || 0)) break;
  }
  return out;
}

/** null when the main backend or the reminder service can't be read. */
export async function getPhotoReminderData(): Promise<PhotoReminderData | null> {
  const [dirRes, emails] = await Promise.all([backendFetch('/teachers/directory?limit=1000'), teacherEmails()]);
  if (!dirRes.ok || !emails) return null;
  const dir = await dirRes.json().catch(() => ({}));
  const listed: any[] = (Array.isArray(dir?.teachers) ? dir.teachers : []).filter(
    (t: any) => t?.teacher_id && isTeacherActivePublic(t) && !hasPhoto(t),
  );
  const st = await photoReminderFetch('/admin/status', {
    method: 'POST',
    body: JSON.stringify({ teacher_ids: listed.map((t) => String(t.teacher_id)) }),
  }).catch(() => null);
  if (!st?.ok) return null;
  const s = await st.json().catch(() => ({}));
  const rows: PhotoCandidate[] = listed.map((t) => {
    const id = String(t.teacher_id);
    const email = emails.get(id) || null;
    const rec = s?.states?.[id];
    const status: PhotoReminderStatus = rec?.status === 'sent' || rec?.status === 'failed' || rec?.status === 'sending'
      ? rec.status
      : email ? 'due' : 'no_email';
    return { teacherId: id, name: String(t.name || 'Teacher').trim(), handle: String(t.handle), email, status, at: rec?.at || null };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { rows, runs: Array.isArray(s?.runs) ? s.runs : [], preview: !!s?.preview };
}
