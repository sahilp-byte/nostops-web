'use client';

import { useState } from 'react';
import PinLocalityPicker, { type PickedLocation } from '@/components/spaces/PinLocalityPicker';

// Admin tester for the S1 picker: shows exactly what a Spaces form would store.
export default function PinLookupTester() {
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white p-5">
        <PinLocalityPicker onChange={setPicked} />
      </div>
      <div className="rounded-2xl border border-line bg-white p-5" data-testid="pin-picked">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">What a Space record would store</p>
        {picked ? (
          <dl className="mt-3 space-y-1 text-sm">
            {Object.entries(picked).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-24 shrink-0 font-semibold text-muted">{k}</dt>
                <dd className="font-bold text-ink" data-testid={`picked-${k}`}>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-soft" data-testid="picked-empty">Enter a PIN code and choose a locality.</p>
        )}
      </div>
    </div>
  );
}
