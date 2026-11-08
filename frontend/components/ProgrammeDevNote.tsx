// The "In development — pending Council review" chip shown beside every
// Council-curated label until the programme content is approved.
import { PROGRAMME_DEV_NOTE, pendingCouncilReview } from '@/lib/org/programme-status';

export default function ProgrammeDevNote({ programme, size = 'sm' }: {
  programme?: { content_status?: string | null } | null; size?: 'xs' | 'sm';
}) {
  if (!pendingCouncilReview(programme)) return null;
  const text = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1';
  return (
    <span className={`inline-flex items-center rounded-full bg-amber-50 font-bold text-amber-800 ${text}`} data-testid="programme-dev-note">
      {PROGRAMME_DEV_NOTE}
    </span>
  );
}
