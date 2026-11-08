import type { GrowthCounts } from '@/lib/server/venue-growth';

const ROWS: { key: keyof GrowthCounts; label: string; hint: string }[] = [
  { key: 'invite_visit', label: 'Invitation visits', hint: 'People who opened your NOSTOPS link, QR code or widget' },
  { key: 'profile_view', label: 'Profile views', hint: 'Visits to your NOSTOPS listing from your invitations' },
  { key: 'register_start', label: 'Teachers who opened sign-up', hint: 'From your “Create your free teacher profile” link' },
  { key: 'register_complete', label: 'New teachers who joined', hint: 'Created a new NOSTOPS teacher account' },
  { key: 'existing_signin', label: 'Existing NOSTOPS teachers', hint: 'Already on NOSTOPS and signed in from your invitation' },
  { key: 'profile_complete', label: 'Teacher profiles completed', hint: 'New teachers who finished their profile' },
];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The owner's own invitation activity + partner badge status (anonymous counts only).
export default function GrowthActivity({ counts, badge, widget, published }: { counts: GrowthCounts; badge: boolean; widget: { host: string | null; seen_at: number | null }; published: boolean }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-5" data-testid="growth-counts">
        <p className="text-sm font-black text-ink">Your invitation activity</p>
        <p className="mt-0.5 text-xs text-muted">Anonymous counts — we never show who visited.</p>
        <dl className="mt-3 divide-y divide-line">
          {ROWS.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-3 py-2.5" data-testid={`count-${r.key}`}>
              <dt className="min-w-0">
                <span className="block text-sm font-bold text-ink">{r.label}</span>
                <span className="block text-[11px] leading-snug text-muted">{r.hint}</span>
              </dt>
              <dd className="text-lg font-black tabular-nums text-brand-700">{counts?.[r.key] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={`rounded-2xl border p-5 ${badge ? 'border-emerald-300 bg-emerald-50' : 'border-line bg-white'}`} data-testid="partner-badge-status" data-active={badge ? '1' : '0'}>
        <p className="text-sm font-black text-ink">{badge ? '🤝 NOSTOPS Partner badge: active' : '🤝 NOSTOPS Partner badge'}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {badge
            ? `Thank you for sharing NOSTOPS. Your widget was seen on ${widget.host}${widget.seen_at ? ` on ${fmtDate(widget.seen_at)}` : ''}, so your listing ${published ? 'shows the Partner badge.' : 'will show the Partner badge once it’s published.'}`
            : `Add a widget to your own website and the Partner badge turns on automatically the first time it loads.${published ? '' : ' It shows on your listing once published.'}`}
        </p>
        <p className="mt-2 text-[11px] text-muted">The badge means you share NOSTOPS on your website. It is not a verification or endorsement.</p>
      </div>
    </div>
  );
}
