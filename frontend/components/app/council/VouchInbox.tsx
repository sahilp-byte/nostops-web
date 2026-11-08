'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import type { VouchItem } from '@/lib/server/guru';

const SAFFRON = '#F59E0B';
const TEAL = '#0D9488';
const STATUS_COLOR: Record<string, string> = { approved: TEAL, pending: SAFFRON, declined: '#EF4444', revoked: '#94A3B8' };

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function Card({ v, onDone }: { v: VouchItem; onDone: (msg: string, ok: boolean) => void }) {
  const [action, setAction] = useState<'approve' | 'decline' | 'revoke' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isPending = v.status === 'pending';
  const isApproved = v.status === 'approved';

  async function submit() {
    if (!action) return;
    setBusy(true);
    const r = await postBff(`/bff/guru/vouch/${v.vouchId}/${action}`, { note: note.trim() });
    setBusy(false);
    if (r.ok) {
      const verb = action === 'approve' ? 'attested ✓' : action === 'decline' ? 'declined' : 'revoked';
      onDone(`Lineage ${verb} for ${v.teacherName}`, true);
    } else {
      onDone(r.data?.error || 'Could not process decision.', false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-black text-brand-700">{initials(v.teacherName)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">{v.teacherName}</p>
          {v.teacherHandle && <p className="truncate text-xs text-muted">@{v.teacherHandle}</p>}
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black text-white" style={{ backgroundColor: STATUS_COLOR[v.status] || '#94A3B8' }}>{v.status.toUpperCase()}</span>
      </div>

      {v.lineageLabel && (
        <div className="mt-3 rounded-xl px-3 py-2" style={{ backgroundColor: `${SAFFRON}12` }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>Claims parampara</p>
          <p className="text-sm font-extrabold text-ink">{v.lineageLabel}</p>
        </div>
      )}
      {v.note && <p className="mt-2 text-xs italic text-ink-soft">“{v.note}”</p>}

      {action ? (
        <div className="mt-3 rounded-xl border border-line bg-cream/60 p-3">
          <p className="text-xs font-extrabold text-ink">
            {action === 'approve' ? 'Attest this lineage' : action === 'decline' ? 'Decline this claim' : 'Revoke your vouch'}
          </p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note…" className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setAction(null)} className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-soft">Cancel</button>
            <button type="button" onClick={submit} disabled={busy} className="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: action === 'decline' || action === 'revoke' ? '#EF4444' : TEAL }}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {isPending && (
            <>
              <button type="button" onClick={() => { setAction('approve'); setNote(''); }} className="flex-1 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: TEAL }}>✓ Attest</button>
              <button type="button" onClick={() => { setAction('decline'); setNote(''); }} className="flex-1 rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: '#EF444440', color: '#EF4444' }}>Decline</button>
            </>
          )}
          {isApproved && (
            <button type="button" onClick={() => { setAction('revoke'); setNote(''); }} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: '#EF444440', color: '#EF4444' }}>Revoke vouch</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function VouchInbox({ items }: { items: VouchItem[] }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function done(msg: string, ok: boolean) {
    setToast({ msg, ok });
    router.refresh();
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="sticky top-2 z-10 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: toast.ok ? '#0D948840' : '#EF444440', backgroundColor: toast.ok ? '#0D948812' : '#EF444412', color: toast.ok ? '#0F766E' : '#B91C1C' }}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: `${TEAL}30`, backgroundColor: `${TEAL}0A` }}>
        <span className="text-lg">🛡️</span>
        <div>
          <p className="text-sm font-extrabold text-ink">Guard the parampara</p>
          <p className="text-xs text-ink-soft">Attest only teachers whose lineage you can personally vouch for. Two Council vouches earn a teacher the gold lineage ribbon on their public profile.</p>
        </div>
      </div>

      <p className="text-sm font-extrabold text-ink">Pending ({items.length})</p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="text-3xl">📭</span>
          <h2 className="mt-2 text-base font-black text-ink">No pending vouch requests</h2>
          <p className="mt-1 text-sm text-ink-soft">When a teacher claims your parampara, their request will appear here for you to attest or decline.</p>
        </div>
      ) : (
        items.map((v) => <Card key={v.vouchId} v={v} onDone={done} />)
      )}
    </div>
  );
}
