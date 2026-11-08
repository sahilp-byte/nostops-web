'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveDraft, newDraftId } from '@/lib/retreat-drafts';
import type { RetreatDraft } from '@/lib/retreat-draft';

// PROMPT 45 — "Create another retreat from this experience". Seeds a new device
// draft from the finished retreat and opens the wizard at step 1 so the teacher
// re-confirms dates, pricing, capacity, cancellation and venue availability.
export default function DuplicateRetreatButton({ draft, title }: { draft: RetreatDraft; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function duplicate() {
    setBusy(true);
    const id = newDraftId();
    saveDraft(id, draft);
    router.push(`/app/teacher/retreats/new?draft=${id}&from=duplicate`);
  }

  return (
    <button
      type="button"
      onClick={duplicate}
      disabled={busy}
      data-testid="duplicate-retreat-btn"
      className="inline-flex items-center gap-2 rounded-xl border border-brand bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
      title={`Reuse the structure of “${title}” for a new retreat`}
    >
      <span aria-hidden>🔁</span> {busy ? 'Preparing…' : 'Create another from this'}
    </button>
  );
}
