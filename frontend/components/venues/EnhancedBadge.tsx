// "Enhanced Listing" badge — shown for venues with paid AI-assisted onboarding
// (and the grandfathered venues that already carry the same upgraded content).
const TIP = 'Enhanced Listing — upgraded profile with AI-assisted onboarding and Google photos & reviews';

export default function EnhancedBadge({ size = 'md', testId = 'venue-enhanced-badge' }: { size?: 'sm' | 'md'; testId?: string }) {
  const cls = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-xs';
  return (
    <span
      title={TIP}
      aria-label={TIP}
      className={`inline-flex items-center gap-1 rounded-full bg-indigo-600 font-bold text-white shadow-sm ${cls}`}
      data-testid={testId}
    >
      <span aria-hidden>✦</span>
      Enhanced Listing
    </span>
  );
}
