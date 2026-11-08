'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { postBff, sendBff } from '@/lib/auth-client';
import type { CouncilMember } from '@/lib/server/admin-council-roster';

// Council roster management (PHASE 8). Deactivate (DELETE) / reactivate a member.
// Writes through the admin-guarded BFF.

function Card({ m, onChanged }: { m: CouncilMember; onChanged: (handle: string, active: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setBusy(true);
    const res = m.isActive
      ? await sendBff(`/bff/admin/council-roster/${encodeURIComponent(m.handle)}`, 'DELETE')
      : await postBff(`/bff/admin/council-roster/${encodeURIComponent(m.handle)}/reactivate`, {});
    setBusy(false);
    if (!res.ok || res.data?.ok === false) { setError(res.data?.error || 'Could not update.'); return; }
    onChanged(m.handle, !m.isActive);
    router.refresh();
  }

  return (
    <div data-testid={`council-${m.handle}`} className={`rounded-2xl border bg-white p-5 ${m.isActive ? 'border-line' : 'border-line opacity-70'}`}>
      <div className="flex items-start gap-3">
        {m.photoUrl ? (
          <Image src={m.photoUrl} alt={m.name} width={48} height={48} className="h-12 w-12 rounded-full object-cover" unoptimized />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-cream text-lg">🧘</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-ink">{m.name}</h3>
            {!m.isActive && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Inactive</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted">{[m.title, m.lineage, m.city].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      {m.specialtyFocus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.specialtyFocus.slice(0, 4).map((s) => <span key={s} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{s}</span>)}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{[m.decades ? `${m.decades} decades` : null, m.notableMentees ? `${m.notableMentees.toLocaleString()} mentees` : null].filter(Boolean).join(' · ')}</p>

      {error && <p className="mt-2 text-[11px] font-semibold text-red-700">{error}</p>}

      <div className="mt-4">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          data-testid={`council-toggle-${m.handle}`}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${m.isActive ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'bg-brand text-white hover:bg-brand-600'}`}
        >
          {busy ? '…' : m.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </div>
  );
}

export default function CouncilRoster({ members: initial }: { members: CouncilMember[] }) {
  const [members, setMembers] = useState(initial);
  const onChanged = (handle: string, active: boolean) => setMembers((prev) => prev.map((m) => (m.handle === handle ? { ...m, isActive: active } : m)));

  if (members.length === 0) {
    return <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">No council members on the roster.</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="council-roster">
      {members.map((m) => <Card key={m.handle} m={m} onChanged={onChanged} />)}
    </div>
  );
}
