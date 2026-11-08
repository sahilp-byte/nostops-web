import 'server-only';
import { apiGet } from '@/lib/api';
import { isTeacherActivePublic } from '@/lib/public-teacher';

// B4.7 — a host teacher's number is never part of public page data. It is looked up here,
// server-side, only when a visitor chooses to send a message, and the browser is redirected
// straight to WhatsApp. With no published number, WhatsApp opens with the text only.
function waNumber(raw?: string | null): string {
  if (!raw) return '';
  let d = raw.replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`; // bare Indian mobile → add country code
  return d;
}

export async function teacherWhatsappUrl(handle: string | null | undefined, text: string): Promise<string> {
  const msg = encodeURIComponent((text || '').slice(0, 1500));
  const fallback = `https://wa.me/?text=${msg}`;
  if (!handle) return fallback;
  try {
    const d = await apiGet<{ teachers?: any[] }>('/teachers/directory', { revalidate: 3600 });
    const t = (Array.isArray(d?.teachers) ? d.teachers : []).find((x) => x?.handle === handle && isTeacherActivePublic(x));
    const num = waNumber((typeof t?.whatsapp === 'string' && t.whatsapp) || (typeof t?.phone === 'string' && t.phone) || '');
    return num ? `https://wa.me/${num}?text=${msg}` : fallback;
  } catch {
    return fallback;
  }
}
