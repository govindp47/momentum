/**
 * Skeleton loading placeholders for the Momentum dashboard.
 * Used while the API request is in-flight.
 */

export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse space-y-8"
      aria-label="Loading dashboard…"
      aria-busy="true"
    >
      {/* Header context skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-24 rounded-none bg-primary/20" />
        <div className="h-8 w-56 rounded-none bg-muted" />
        <div className="h-4 w-80 rounded-none bg-muted/60" />
      </div>

      {/* Ledger summary cards */}
      <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card p-5 space-y-3">
            <div className="h-3 w-20 bg-muted rounded-none" />
            <div className="h-7 w-14 bg-muted rounded-none" />
            <div className="h-2.5 w-16 bg-muted/60 rounded-none" />
          </div>
        ))}
      </div>

      {/* Journeys section */}
      <div className="border border-border bg-card space-y-0 divide-y divide-border">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-5 space-y-3">
            <div className="h-4 w-40 bg-muted rounded-none" />
            <div className="h-2 w-full bg-muted/40 rounded-none" />
            <div className="flex gap-6">
              <div className="h-3 w-20 bg-muted/60 rounded-none" />
              <div className="h-3 w-24 bg-muted/60 rounded-none" />
            </div>
          </div>
        ))}
      </div>

      {/* Today activity */}
      <div className="border border-border bg-card p-5 space-y-3">
        <div className="h-4 w-32 bg-muted rounded-none" />
        <div className="h-3 w-48 bg-muted/60 rounded-none" />
      </div>
    </div>
  );
}
