/**
 * Skeleton loading placeholders for the Momentum dashboard.
 * Used while the API request is in-flight.
 */

export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl animate-pulse space-y-7 pb-12 md:space-y-8"
      aria-label="Loading dashboard…"
      aria-busy="true"
    >
      {/* Header context */}
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-md bg-primary/15" />
        <div className="h-8 w-56 rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full rounded-md bg-muted/60" />
      </div>

      {/* Ledger summary */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-4 w-20 rounded-md bg-muted" />
          <div className="h-3 w-32 rounded-md bg-muted/60" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted" />
                <div className="h-6 w-12 rounded-md bg-muted" />
              </div>
              <div className="mt-3 h-3 w-24 rounded-md bg-muted/70" />
              <div className="mt-1.5 h-3 w-28 rounded-md bg-muted/50" />
            </div>
          ))}
        </div>
      </section>

      {/* Commitment breakdown */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <div className="border-b border-border/70 px-5 py-3.5">
          <div className="h-3 w-44 rounded-md bg-muted" />
        </div>

        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="grid gap-4 border-b border-border/60 p-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="space-y-3">
              <div className="h-4 w-36 rounded-md bg-muted" />
              <div className="h-1.5 w-full rounded-full bg-muted/50" />
            </div>

            <div className="flex gap-6">
              <div className="space-y-1.5">
                <div className="h-3 w-20 rounded-md bg-muted/50" />
                <div className="h-5 w-10 rounded-md bg-muted" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-14 rounded-md bg-muted/50" />
                <div className="h-5 w-8 rounded-md bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Journeys */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-4 w-32 rounded-md bg-muted" />
          <div className="h-3 w-16 rounded-md bg-muted/60" />
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="space-y-4 border-b border-border/60 p-5 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="h-4 w-40 rounded-md bg-muted" />
                <div className="h-6 w-12 rounded-md bg-muted" />
              </div>

              <div className="h-1.5 w-full rounded-full bg-muted/50" />

              <div className="flex gap-5">
                <div className="h-3 w-28 rounded-md bg-muted/50" />
                <div className="h-3 w-20 rounded-md bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Today's activity */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-4 w-32 rounded-md bg-muted" />
          <div className="h-3 w-28 rounded-md bg-muted/60" />
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 border-b border-border/60 p-5 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted" />
                <div className="space-y-2">
                  <div className="h-3.5 w-28 rounded-md bg-muted" />
                  <div className="h-3 w-16 rounded-md bg-muted/50" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="ml-auto h-4 w-10 rounded-md bg-muted" />
                <div className="ml-auto h-3 w-14 rounded-md bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}