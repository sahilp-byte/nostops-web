'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';

export type ClaimItem = { requestId: string; teacherName: string; city: string; specialties: string[] };

// "Available Interviews · Claim Now" — first-come, first-served panel shown on
// the Council Home when unclaimed, paid empanelment interviews exist. Claiming
// forwards to POST /empanelment/fast-track/{id}/claim via the CSRF-guarded BFF.
export default function ClaimPanel({ items }: { items: ClaimItem[] }) {
  const router = useRouter();
  const [list, setList] = useState<ClaimItem[]>(items);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (list.length === 0) return null;

  async function claim(id: string) {
    setBusy(id);
    setMsg(null);
    const r = await postBff(`/bff/guru/empanelment/${id}/claim`);
    setBusy(null);
    if (r.ok) {
      setList((prev) => prev.filter((i) => i.requestId !== id));
      setMsg('Claimed ✓ — WhatsApp the candidate to schedule the 30-min interview.');
      router.refresh();
    } else {
      setMsg(r.data?.error || 'Could not claim — another Guru may have claimed it first.');
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: '#FB923C', backgroundColor: '#FFF7ED' }} data-testid="available-interviews-panel">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundColor: '#EA580C' }}>🔥</span>
        <div className="flex-1">
          <p className="text-sm font-extrabold" style={{ color: '#7C2D12' }}>Available interviews · claim now</p>
          <p className="text-[11px] font-semibold" style={{ color: '#172554' }}>First-come, first-served · ₹1,500 per completed 30-min interview</p>
        </div>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold" style={{ color: '#134E4A' }}>{msg}</p>}
      <div className="mt-3 space-y-2">
        {list.slice(0, 5).map((r) => (
          <div key={r.requestId} className="flex items-center gap-3 rounded-xl bg-white p-3" data-testid={`claim-card-${r.requestId}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-brand-700">{r.teacherName}</p>
              <p className="truncate text-[11px] font-semibold" style={{ color: '#172554' }}>{r.city || '—'}{r.specialties.length ? ` · ${r.specialties.slice(0, 2).join(', ')}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={() => claim(r.requestId)}
              disabled={busy === r.requestId}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition disabled:opacity-50"
              style={{ backgroundColor: '#EA580C' }}
              data-testid={`claim-btn-${r.requestId}`}
            >
              {busy === r.requestId ? 'Claiming…' : '⚡ Claim'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
