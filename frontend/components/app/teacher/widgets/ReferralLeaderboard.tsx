import type { ReferralLeaderboard } from '@/lib/server/widgets';

const MEDAL = ['🥇', '🥈', '🥉'];

// Top-inviting teachers leaderboard (real data from /teacher-referrals/leaderboard).
// Honest "warming up" state when the endpoint returns nothing yet — never faked ranks.
export default function ReferralLeaderboard({ data }: { data: ReferralLeaderboard }) {
  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-cream/40 p-4 text-sm text-ink-soft" data-testid="referral-leaderboard-empty">
        🏆 The top-inviters leaderboard is warming up — invite teachers to climb the ranks. It appears here once there&apos;s activity.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="referral-leaderboard">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-ink">🏆 Top-inviting teachers</p>
        {data?.myRank ? <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">You&apos;re #{data.myRank}</span> : null}
      </div>
      <ol className="mt-3 space-y-1.5 p-0">
        {entries.slice(0, 10).map((e) => (
          <li
            key={`${e.rank}-${e.name}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 ${e.isMe ? 'bg-brand-50 ring-1 ring-brand/30' : 'bg-cream/40'}`}
          >
            <span className="w-7 shrink-0 text-center text-sm font-black text-ink-soft">{MEDAL[e.rank - 1] || `#${e.rank}`}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
              {e.name}
              {e.isMe && <span className="ml-1.5 text-[11px] font-bold text-brand-700">(you)</span>}
            </span>
            {e.tier && <span className="hidden shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 sm:inline-block">{e.tier}</span>}
            <span className="shrink-0 text-right text-xs text-muted">
              <span className="font-black text-ink">{e.invited}</span> invited{e.empanelled ? ` · ${e.empanelled} empanelled` : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
