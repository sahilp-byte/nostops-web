import Link from 'next/link';
import type { CapacityStatus } from '@/lib/capacity-alert';

// Presentational (server-safe) capacity alert banner. Rendered only when the
// host should be warned (almost full / at / over the venue's operational limit).
const STYLE: Record<string, { box: string; icon: string; text: string }> = {
  almost_full: { box: 'border-amber-300 bg-amber-50', icon: '⚠️', text: 'text-amber-800' },
  full: { box: 'border-amber-400 bg-amber-100', icon: '🚪', text: 'text-amber-900' },
  over: { box: 'border-red-300 bg-red-50', icon: '⛔', text: 'text-red-700' },
};

export default function CapacityAlert({
  status,
  title,
  href,
}: {
  status: CapacityStatus;
  title?: string;
  href?: string;
}) {
  if (!status.alert) return null;
  const s = STYLE[status.level] || STYLE.almost_full;

  const body = (
    <div className={`rounded-xl border ${s.box} px-3.5 py-2.5`} data-testid="capacity-alert" data-level={status.level}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="text-base leading-5">{s.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-extrabold ${s.text}`}>{status.title}{title ? ` · ${title}` : ''}</p>
          <p className={`mt-0.5 text-xs ${s.text} opacity-90`}>{status.message}</p>
        </div>
        {href && <span className="shrink-0 self-center text-xs font-bold text-brand-700">Manage →</span>}
      </div>
    </div>
  );

  return href ? <Link href={href} className="block transition hover:opacity-90">{body}</Link> : body;
}
