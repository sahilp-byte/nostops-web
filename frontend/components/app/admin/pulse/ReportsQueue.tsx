'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { timeAgo } from '@/lib/pulse-ui';

const TABS = ['OPEN', 'ACTIONED', 'DISMISSED', 'ALL'];

export default function ReportsQueue({ reports, status }: { reports: any[]; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');

  async function resolve(id: string, action: 'dismiss' | 'hide' | 'delete') {
    setBusy(id);
    const r = await postBff(`/bff/admin/pulse/reports/${id}/resolve`, { action, note: '' });
    setBusy('');
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/app/admin/pulse/reports?status=${t}`} className={`rounded-full px-3 py-1 text-xs font-bold ${status === t ? 'bg-brand text-white' : 'border border-line bg-white text-ink-soft'}`}>
            {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">No {status.toLowerCase()} reports. 🎉</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-white p-4" data-testid="admin-report-row">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700">{r.target_type}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${r.status === 'OPEN' ? 'bg-accent/15 text-accent-600' : 'bg-cream text-muted'}`}>{r.status}</span>
                {r.target_status && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">content: {r.target_status}</span>}
                <span className="ml-auto text-xs text-muted">{timeAgo(r.created_at)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">“{r.reason}”</p>
              {r.excerpt && <p className="clamp-2 mt-1 rounded-lg bg-cream px-3 py-2 text-xs text-ink-soft">{r.excerpt}</p>}
              <p className="mt-1 text-xs text-muted">Reported by <span className="font-bold text-ink-soft">{r.reporter_name}</span></p>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {r.thread_id && <Link href={`/app/admin/pulse/threads/${r.thread_id}`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream">View content</Link>}
                {r.status === 'OPEN' && (
                  <>
                    <button disabled={busy === r.id} onClick={() => resolve(r.id, 'dismiss')} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">Dismiss</button>
                    <button disabled={busy === r.id} onClick={() => resolve(r.id, 'hide')} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream disabled:opacity-50">Hide content</button>
                    <button disabled={busy === r.id} onClick={() => resolve(r.id, 'delete')} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Delete content</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
