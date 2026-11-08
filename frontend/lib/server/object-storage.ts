// Server-only Emergent Object Storage client (Node runtime, BFF only).
// The EMERGENT_LLM_KEY never leaves the server. Reads require the X-Storage-Key
// so a public media proxy route re-attaches it server-side. Objects are stored
// under `nostops/retreats/{userId}/{uuid}.{ext}` — the app namespace separates
// this app's objects from the shared per-user bucket.
import 'server-only';

const STORAGE_BASE = (process.env.INTEGRATION_PROXY_URL || '').trim() || 'https://integrations.emergentagent.com';
const STORAGE_URL = STORAGE_BASE.replace(/\/$/, '') + '/objstore/api/v1/storage';
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY || '';

export const STORAGE_PREFIX = 'nostops/retreats';

let storageKey: string | null = null;

async function init(force = false): Promise<string> {
  if (storageKey && !force) return storageKey;
  const res = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: EMERGENT_KEY }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`storage init ${res.status}`);
  const d = await res.json();
  storageKey = d.storage_key as string;
  return storageKey;
}

export async function putObject(path: string, data: Buffer | Uint8Array, contentType: string): Promise<{ path: string; size: number }> {
  let key = await init();
  let res = await fetch(`${STORAGE_URL}/objects/${path}`, {
    method: 'PUT',
    headers: { 'X-Storage-Key': key, 'Content-Type': contentType },
    body: data as any,
    cache: 'no-store',
  });
  // A stale storage_key returns 503 — reset + re-init once, then retry.
  if (res.status === 503) {
    key = await init(true);
    res = await fetch(`${STORAGE_URL}/objects/${path}`, {
      method: 'PUT',
      headers: { 'X-Storage-Key': key, 'Content-Type': contentType },
      body: data as any,
      cache: 'no-store',
    });
  }
  if (!res.ok) throw new Error(`storage put ${res.status}`);
  return (await res.json()) as { path: string; size: number };
}

export async function getObject(path: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  let key = await init();
  let res = await fetch(`${STORAGE_URL}/objects/${path}`, { headers: { 'X-Storage-Key': key }, cache: 'no-store' });
  if (res.status === 503) {
    key = await init(true);
    res = await fetch(`${STORAGE_URL}/objects/${path}`, { headers: { 'X-Storage-Key': key }, cache: 'no-store' });
  }
  // A missing object returns 500 (no clean 404 in the storage API) — treat as not found.
  if (!res.ok) return null;
  const contentType = res.headers.get('Content-Type') || 'application/octet-stream';
  const body = await res.arrayBuffer();
  return { body, contentType };
}
