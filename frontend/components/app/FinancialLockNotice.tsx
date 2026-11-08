import { FINANCIAL_LOCK_MESSAGE } from '@/lib/financial-lock-rules';

// Shown wherever a money action is paused by the financial safety audit lock.
export default function FinancialLockNotice({ title = 'Money actions are paused', children }: { title?: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5" role="status" data-testid="financial-lock-notice">
      <h2 className="text-sm font-extrabold text-amber-900">🔒 {title}</h2>
      <p className="mt-1 text-sm text-amber-900/90">{FINANCIAL_LOCK_MESSAGE}</p>
      {children}
    </section>
  );
}
