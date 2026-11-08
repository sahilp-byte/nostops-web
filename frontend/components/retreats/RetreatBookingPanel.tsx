'use client';

import { useState } from 'react';
import RetreatReserve from '@/components/retreats/RetreatReserve';
import GroupBook from '@/components/retreats/GroupBook';

// Lets a seeker choose between reserving one seat (pay now) or booking a group
// (tiered discount, host-coordinated payment). Client toggle over the two flows.
export default function RetreatBookingPanel({
  retreatId,
  retreatTitle,
  priceInr,
  startISO,
  endISO,
  defaultName,
  defaultEmail,
  defaultPhone,
  cohort,
  via,
  initialMode,
}: {
  retreatId: string;
  retreatTitle: string;
  priceInr?: number;
  startISO?: string;
  endISO?: string;
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
  cohort?: string;
  via?: string;
  initialMode?: 'individual' | 'group';
}) {
  const [mode, setMode] = useState<'individual' | 'group'>(initialMode === 'group' ? 'group' : 'individual');

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Booking type">
        <button
          type="button"
          onClick={() => setMode('individual')}
          data-testid="book-mode-individual"
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition ${mode === 'individual' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
        >
          Just me
        </button>
        <button
          type="button"
          onClick={() => setMode('group')}
          data-testid="book-mode-group"
          className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition ${mode === 'group' ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-soft hover:border-brand'}`}
        >
          A group
        </button>
      </div>

      {mode === 'individual' ? (
        <RetreatReserve
          retreatId={retreatId}
          retreatTitle={retreatTitle}
          priceInr={priceInr}
          startISO={startISO}
          endISO={endISO}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          defaultPhone={defaultPhone}
          cohort={cohort}
          via={via}
        />
      ) : (
        <GroupBook
          retreatId={retreatId}
          retreatTitle={retreatTitle}
          startISO={startISO}
          endISO={endISO}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          defaultPhone={defaultPhone}
          standardInr={priceInr}
        />
      )}
    </div>
  );
}
