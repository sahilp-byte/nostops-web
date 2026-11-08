// Route-level loading state for every /app/admin/* page (§14). Shown while the
// server component fetches from the authoritative backend.
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse" data-testid="admin-loading">
      <div className="h-3 w-40 rounded bg-line" />
      <div className="mt-3 h-8 w-64 rounded bg-line" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-line/70" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
