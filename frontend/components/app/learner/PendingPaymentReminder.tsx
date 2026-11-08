'use client';

import { useEffect, useState } from 'react';
import { inr, titleCase, fmtDateTime } from '@/lib/format';
import CashfreePayButton from '@/components/payments/CashfreePayButton';
import type { SeekerPendingRow } from '@/lib/server/audit';

// Missed Payment Recovery — a gentle, dismissible nudge for the seeker's OWN
// reservations that were never paid. Tapping "Complete payment" resumes the
// secured Cashfree checkout (the BFF re-derives the authoritative amount from
// the booking). Dismissals are remembered client-side so we never nag.
const KEY = 'nostops.paydismiss.v1';

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = JSON.parse(raw || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export default function PendingPaymentReminder({ rows }: { rows: SeekerPendingRow[] }) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  // Wait for the client read so we never flash a card the seeker already dismissed.
  if (!dismissed) return null;

  const pending = rows.filter((r) => r.booking_id && !dismissed.has(r.booking_id));
  if (pending.length === 0) return null;

  const top = pending[0];

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    writeDismissed(next);
    setDismissed(next);
  }

  const when = top.slot_iso ? fmtDateTime(top.slot_iso) : '';

  return (
    <div data-testid="pending-payment-reminder" className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-xl">⏳</span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold tracking-tight text-ink">Finish booking your session with {top.teacher_name || 'your teacher'}</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Your slot is reserved but payment isn&apos;t complete yet.
            {' '}Pay securely to lock it in{when ? ` for ${when}` : ''}.
            {pending.length > 1 ? ` You have ${pending.length} reservations awaiting payment.` : ''}
          </p>
          <p className="mt-1 text-xs text-muted">
            {[top.session_mode ? titleCase(top.session_mode) : null, top.matrix_reason ? `Focus: ${top.matrix_reason}` : null].filter(Boolean).join(' · ')}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <CashfreePayButton
                amount={Number(top.amount_inr) || 0}
                orderType="one_on_one"
                referenceId={top.booking_id}
                customerPhone={top.seeker_phone || undefined}
                note={`1:1 session with ${top.teacher_name || 'teacher'}`}
                label={top.amount_inr ? `Complete payment · ₹${inr(top.amount_inr)} →` : 'Complete payment →'}
              />
            </div>
            <button
              type="button"
              onClick={() => dismiss(top.booking_id)}
              data-testid="pending-payment-dismiss"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink-soft"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
