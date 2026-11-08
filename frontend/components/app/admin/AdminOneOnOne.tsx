'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { inr, titleCase, fmtDateTime } from '@/lib/format';
import type { LedgerRow } from '@/lib/server/audit';

// Admin 1:1 Sessions ledger (read-only). The remote business backend exposes no
// 1:1 admin endpoint, so this reads the LOCAL audit ledger the BFF writes on
// every reserve / payment. Purely informational — no writes here.

const STATUS_CLS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700',
  PAYMENT_INITIATED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-emerald-50 text-emerald-700',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pending payment',
  PAYMENT_INITIATED: 'Payment initiated',
  PAID: 'Paid',
};

function iso(ms?: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function Row({ r }: { r: LedgerRow }) {
  const status = r.status || 'PENDING_PAYMENT';
  return (
    <Link
      href={`/app/admin/one-on-one/${encodeURIComponent(r.booking_id)}`}
      data-testid={`ledger-${r.booking_id}`}
      className="block border-b border-line px-4 py-3 transition last:border-0 hover:bg-cream/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-ink">{r.teacher_name || r.teacher_handle || 'Teacher'}</p>
            <span className="text-muted">←</span>
            <p className="truncate text-sm font-semibold text-ink-soft">{r.seeker_name || r.seeker_email || 'Seeker'}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[status] || 'bg-slate-100 text-slate-600'}`}>
              {STATUS_LABEL[status] || titleCase(status)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {[
              r.session_mode ? titleCase(r.session_mode) : null,
              r.gateway ? `via ${titleCase(r.gateway)}` : null,
              r.slot_iso ? `slot ${fmtDateTime(r.slot_iso)}` : null,
              r.created_at ? `booked ${fmtDateTime(iso(r.created_at))}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
          {r.matrix_reason && (
            <p className="mt-0.5 text-xs text-ink-soft">
              <span className="font-semibold text-brand-700">Focus:</span> {r.matrix_reason}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-muted">
            {r.booking_id}
            {r.order_id ? ` · order ${r.order_id}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {r.amount_inr ? (
            <p className="text-lg font-black tabular-nums text-ink">₹{inr(r.amount_inr)}</p>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
          <p className="text-[11px] text-muted">{r.currency || 'INR'}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-brand-700">View →</p>
        </div>
      </div>
    </Link>
  );
}

export default function AdminOneOnOne({ rows, statuses }: { rows: LedgerRow[]; statuses: string[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && (r.status || 'PENDING_PAYMENT') !== status) return false;
      if (needle) {
        const hay = `${r.teacher_name ?? ''} ${r.teacher_handle ?? ''} ${r.seeker_name ?? ''} ${r.seeker_email ?? ''} ${r.matrix_reason ?? ''} ${r.booking_id}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, status]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search teacher, seeker, focus or booking id"
          data-testid="ledger-search"
          className="min-w-[220px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-testid="ledger-status-filter"
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s] || titleCase(s)}</option>
          ))}
        </select>
        <a
          href="/bff/admin/one-on-one/export"
          data-testid="ledger-export"
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-cream"
        >
          Export CSV
        </a>
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-white">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {rows.length === 0
              ? 'No 1:1 sessions recorded yet. New bookings will appear here automatically.'
              : 'No sessions match your filters.'}
          </p>
        ) : (
          visible.map((r) => <Row key={r.booking_id} r={r} />)
        )}
      </div>
    </div>
  );
}
