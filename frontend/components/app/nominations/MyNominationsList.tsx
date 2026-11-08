'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postBff } from '@/lib/auth-client';
import { fmtDate } from '@/lib/format';
import { NOMINATION_STEPS, NOMINATION_TONE, nominationStep } from '@/lib/nomination-status';
import type { MyNomination } from '@/lib/server/guru-nominations';

// The nominator's own Guru nominations: status, a 5-step progress line, the admin's question
// (with an answer box) and Withdraw while it is still waiting for review.
function Progress({ status }: { status: string }) {
  const at = nominationStep(status);
  if (at < 0) return null;
  return (
    <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Progress">
      {NOMINATION_STEPS.map((s, i) => (
        <li key={s} className="min-w-0">
          <span className={`block h-1.5 rounded-full ${i <= at ? 'bg-brand' : 'bg-line'}`} />
          <span className={`mt-1 block truncate text-[11px] font-semibold ${i <= at ? 'text-brand-700' : 'text-muted'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Card({ n }: { n: MyNomination }) {
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: 'reply' | 'withdraw') {
    if (action === 'reply' && answer.trim().length < 2) {
      setError('Please type your answer.');
      return;
    }
    setError(null);
    setBusy(true);
    const res = await postBff(`/bff/nominations/${encodeURIComponent(n.id)}`, { action, text: answer.trim() });
    setBusy(false);
    if (!res.ok || res.data?.ok === false) {
      setError(res.data?.error || 'Could not update the nomination.');
      return;
    }
    setAnswer('');
    setConfirmWithdraw(false);
    router.refresh();
  }

  return (
    <article data-testid={`my-nom-${n.id}`} className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-ink">{n.nominee_name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {[n.nominee_lineage, n.nominee_city, n.created_at ? `Nominated ${fmtDate(n.created_at)}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span data-testid={`my-nom-status-${n.id}`} className={`rounded-full border px-3 py-1 text-xs font-bold ${NOMINATION_TONE[n.status] || 'bg-cream text-ink-soft border-line'}`}>
          {n.status_label}
        </span>
      </div>
      <Progress status={n.status} />
      <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{n.citation}</p>

      {n.open_question && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4" data-testid={`my-nom-question-${n.id}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-orange-800">Question from the NOSTOPS team</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{n.open_question}</p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            maxLength={1200}
            data-testid={`my-nom-answer-${n.id}`}
            placeholder="Type your answer"
            className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
          />
          <button type="button" disabled={busy} onClick={() => act('reply')} data-testid={`my-nom-send-${n.id}`} className="mt-2 min-h-[44px] rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            {busy ? 'Sending…' : 'Send answer'}
          </button>
        </div>
      )}

      {n.messages.length > 0 && !n.open_question && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink-soft">Messages ({n.messages.length})</summary>
          <ul className="mt-2 space-y-2">
            {n.messages.map((m, i) => (
              <li key={i} className={`rounded-xl px-3 py-2 ${m.from === 'nostops' ? 'bg-cream' : 'bg-brand/5'}`}>
                <span className="text-xs font-bold text-muted">{m.from === 'nostops' ? 'NOSTOPS team' : 'You'}{m.at ? ` · ${fmtDate(m.at)}` : ''}</span>
                <p className="whitespace-pre-line text-ink">{m.text}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {n.council_url && (
          <Link href={n.council_url} className="inline-flex min-h-[44px] items-center text-sm font-bold text-brand-700 hover:underline">
            View on the Council page →
          </Link>
        )}
        {n.can_withdraw && !confirmWithdraw && (
          <button type="button" onClick={() => setConfirmWithdraw(true)} data-testid={`my-nom-withdraw-${n.id}`} className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs font-bold text-muted transition hover:bg-cream">
            Withdraw
          </button>
        )}
        {confirmWithdraw && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            Withdraw this nomination?
            <button type="button" disabled={busy} onClick={() => act('withdraw')} data-testid={`my-nom-withdraw-confirm-${n.id}`} className="min-h-[44px] rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">
              Yes, withdraw
            </button>
            <button type="button" onClick={() => setConfirmWithdraw(false)} className="min-h-[44px] rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-soft hover:bg-cream">
              Keep it
            </button>
          </span>
        )}
      </div>
    </article>
  );
}

export default function MyNominationsList({ items }: { items: MyNomination[] }) {
  if (items.length === 0) {
    return (
      <div data-testid="my-nom-empty" className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <p className="text-4xl" aria-hidden>📜</p>
        <p className="mt-3 text-lg font-black text-ink">You haven&apos;t nominated a Guru yet</p>
        <p className="mt-1 text-sm text-ink-soft">Know a living Guru who belongs on the Council of Yoga Gurus? Tell us about them.</p>
        <Link href="/council/nominate" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          Nominate a Guru
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="my-nom-list">
      {items.map((n) => <Card key={n.id} n={n} />)}
    </div>
  );
}
