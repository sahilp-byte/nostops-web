import { fmtDate } from '@/lib/pulse-ui';

// Lifecycle banner shown at the top of the community. Presentational.
export default function StatusBanner({ status, closeDate }: { status: string; closeDate?: number }) {
  if (status === 'CLOSING_SOON') {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent-600" data-testid="pulse-status-banner">
        ⏳ Teacher Pulse is closing soon{closeDate ? ` (around ${fmtDate(closeDate)})` : ''}. Share your thoughts while the conversation is open.
      </div>
    );
  }
  if (status === 'ARCHIVED') {
    return (
      <div className="rounded-2xl border border-line bg-cream px-4 py-3 text-sm font-semibold text-muted" data-testid="pulse-status-banner">
        📦 Teacher Pulse is archived. You can read past conversations, but new posts are closed. Thank you for taking part.
      </div>
    );
  }
  return null;
}
