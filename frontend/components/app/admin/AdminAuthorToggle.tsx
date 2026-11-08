'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

// Admin: enable/disable a teacher as a NOSTOPS Author. Default OFF; only admins
// can flip it. Persists in the isolated local Voices store.
export default function AdminAuthorToggle({ teacherId, initialEnabled }: { teacherId: string; initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const next = !enabled;
    setBusy(true);
    const res = await postBff<{ ok?: boolean; error?: string; enabled?: boolean }>(`/bff/admin/teachers/${encodeURIComponent(teacherId)}/author`, { enabled: next });
    setBusy(false);
    if (!res.ok || !res.data?.ok) { setError(res.data?.error || 'Could not save.'); return; }
    setEnabled(next);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5" data-testid="author-toggle">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-ink">NOSTOPS Author</h3>
          <p className="mt-0.5 text-xs text-muted">Enable this teacher to write &amp; submit articles for NOSTOPS Voices.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={toggle}
          data-testid="author-toggle-switch"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <p className={`mt-3 text-xs font-bold ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
        {enabled ? '✓ Enabled — “Write for NOSTOPS” appears in their dashboard.' : 'Disabled (default).'}
      </p>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}
