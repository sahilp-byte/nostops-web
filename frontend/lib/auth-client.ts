// Client-side helper to call the BFF endpoints (/bff/*). Safe to import from
// client components. Never touches the bearer token — that lives only in the
// httpOnly session cookie the BFF sets. Attaches the double-submit CSRF token
// (readable `nostops_csrf` cookie) as the `x-csrf-token` header so the BFF can
// reject cross-site forgeries.
import { CSRF_COOKIE, CSRF_HEADER, CSRF_META } from '@/lib/session-cookie';

export type BffResult<T = any> = { ok: boolean; status: number; data: T };

function csrfToken(): string {
  if (typeof document === 'undefined') return '';
  // Prefer the SSR-rendered <meta> tag — readable even when third-party
  // `document.cookie` access is blocked inside an embedded webview/iframe.
  const meta = document.querySelector(`meta[name="${CSRF_META}"]`)?.getAttribute('content');
  if (meta) return meta;
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + CSRF_COOKIE + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export async function postBff<T = any>(path: string, body?: unknown): Promise<BffResult<T>> {
  return sendBff<T>(path, 'POST', body);
}

export async function getBff<T = any>(path: string): Promise<BffResult<T>> {
  try {
    const res = await fetch(path, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

/** Multipart POST (file uploads). The browser sets the multipart Content-Type itself. */
export async function postBffForm<T = any>(path: string, form: FormData): Promise<BffResult<T>> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { [CSRF_HEADER]: csrfToken() }, credentials: 'same-origin', body: form });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error. Please check your connection.' } as T };
  }
}

export async function sendBff<T = any>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<BffResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrfToken() },
      credentials: 'same-origin',
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error. Please check your connection.' } as T };
  }
}
