'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/auth-client';
import { SPACE_STATUS } from '@/lib/spaces';

type Dup = { id: string; name: string; status: string; same_address: boolean; same_name: boolean };

/** Warning only — never blocks saving or submitting. */
export function DuplicateWarning({ id }: { id: string }) {
  const [dups, setDups] = useState<Dup[]>([]);
  useEffect(() => {
    let live = true;
    getBff<{ duplicates?: Dup[] }>(`/bff/spaces/mine/${encodeURIComponent(id)}/duplicates`).then((r) => { if (live && r.ok) setDups(r.data.duplicates || []); });
    return () => { live = false; };
  }, [id]);
  if (!dups.length) return null;
  return (
    <div role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="space-duplicate-warning">
      <p className="font-bold">This may be the same place as another Space you listed</p>
      <ul className="mt-1 list-disc pl-5">
        {dups.map((d) => (
          <li key={d.id}><Link href={`/app/spaces/${d.id}`} className="font-semibold underline">{d.name}</Link> · {SPACE_STATUS[d.status]?.label || d.status} · same locality and {d.same_address && d.same_name ? 'same address and name' : d.same_address ? 'same address' : 'same name'}</li>
        ))}
      </ul>
      <p className="mt-1">If it is the same place, please continue with the existing listing instead. You can withdraw this draft below.</p>
    </div>
  );
}

export function WithdrawDraftButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    const r = await postBff(`/bff/spaces/mine/${encodeURIComponent(id)}/withdraw`, {});
    setBusy(false);
    if (!r.ok) return setErr(r.data?.error || 'Could not withdraw this draft.');
    router.refresh();
  }
  return (
    <div className="sp-card mt-6 p-5" data-testid="space-withdraw">
      <h2 className="text-[20px]">Withdraw this draft</h2>
      <p className="mt-1 text-sm text-ink-soft">Not listing this place after all? Withdraw the draft. It is kept in your history but no longer counts as unfinished, and it can’t be submitted.</p>
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="mt-3 min-h-[44px] rounded-xl border border-red-300 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50" data-testid="space-withdraw-btn">Withdraw draft</button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="space-withdraw-confirm">
          <span className="text-sm font-semibold text-ink">Withdraw this draft?</span>
          <button type="button" disabled={busy} onClick={go} className="min-h-[44px] rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50" data-testid="space-withdraw-yes">{busy ? 'Withdrawing…' : 'Yes, withdraw'}</button>
          <button type="button" disabled={busy} onClick={() => setConfirm(false)} className="min-h-[44px] rounded-xl border border-line bg-white px-4 text-sm font-semibold" data-testid="space-withdraw-no">Keep draft</button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-700" data-testid="space-withdraw-error">{err}</p>}
    </div>
  );
}
