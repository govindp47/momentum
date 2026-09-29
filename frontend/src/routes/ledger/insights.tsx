import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarCheck2,
  Flame,
  Gauge,
  Target,
} from "lucide-react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { iconMap, getTaskIcon } from "@/lib/lifeledger";
import {
  useLedgerStats,
  useLedgerWeeklyStats,
} from "@/hooks/queries/use-ledger";
import type { OverallStatsResponse, Trend } from "@/types/ledger";
import { ApiError } from "@/api/client";

export const Route = createFileRoute("/ledger/insights")({
  head: () => ({
    meta: [
      { title: "Insights — LifeLedger" },
      {
        name: "description",
        content:
          "Understand completion, coverage, streaks, and trends in LifeLedger.",
      },
      { property: "og:title", content: "Insights — LifeLedger" },
      {
        property: "og:description",
        content:
          "Understand completion, coverage, streaks, and trends in LifeLedger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsightsPage,
});

// ---------------------------------------------------------------------------
// Trend display helpers
// ---------------------------------------------------------------------------

const trendIcon = {
  "↑": ArrowUp,
  "↓": ArrowDown,
  "→": ArrowRight,
  "—": ArrowRight,
} as const;

const trendLabel = {
  "↑": "UP",
  "↓": "DOWN",
  "→": "FLAT",
  "—": "N/A",
} as const;

const trendClass = {
  "↑": "text-status-yes",
  "↓": "text-status-no",
  "→": "text-muted-foreground",
  "—": "text-muted-foreground",
} as const;

/**
 * Derive the overall trend from task stats.
 * Returns "↑" if the majority are up, "↓" if majority are down, else "→".
 */
function deriveOverallTrend(stats: OverallStatsResponse): Trend {
  const trends = stats.task_stats.map((ts) => ts.trend);
  const up = trends.filter((t) => t === "↑").length;
  const down = trends.filter((t) => t === "↓").length;
  if (up > down) return "↑";
  if (down > up) return "↓";
  return "→";
}

// ---------------------------------------------------------------------------
// Format helpers — convert 0..1 ratio to display percentage string
// ---------------------------------------------------------------------------

function fmtRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function fmtRateNum(rate: number | null): number {
  if (rate === null) return 0;
  return Math.round(rate * 100);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function InsightsPage() {
  // Fetch 90-day stats for the main metrics and per-commitment section
  const {
    data: stats90,
    isLoading: loading90,
    isError: error90,
    error: err90,
    refetch: refetch90,
  } = useLedgerStats(90);

  // Fetch 7-day stats for the 7-day window
  const { data: stats7 } = useLedgerStats(7);

  // Fetch 30-day stats for the 30-day window
  const { data: stats30 } = useLedgerStats(30);

  // Fetch weekly chart data (12 weeks)
  const {
    data: weeklyRates,
    isLoading: weeklyLoading,
    isError: weeklyError,
    refetch: refetchWeekly,
  } = useLedgerWeeklyStats(12);

  const overallTrend: Trend = stats90 ? deriveOverallTrend(stats90) : "—";
  const TrendIconComp = trendIcon[overallTrend];

  // Compute aggregate streaks — max current streak / max longest streak across tasks
  const allStreaks = (stats90?.task_stats ?? []).filter(
    (ts) => ts.current_streak > 0 || ts.longest_streak > 0,
  );
  const maxCurrentStreak = allStreaks.reduce(
    (acc, ts) => Math.max(acc, ts.current_streak),
    0,
  );
  const maxLongestStreak = allStreaks.reduce(
    (acc, ts) => Math.max(acc, ts.longest_streak),
    0,
  );

  // Coverage: tracked_days / total_days
  const trackingCoverageNum =
    stats90 && stats90.total_days > 0
      ? Math.round((stats90.tracked_days / stats90.total_days) * 100)
      : null;

  const metrics = [
    {
      label: "Average completion",
      value: fmtRate(stats90?.avg_rate ?? null),
      note: "of recorded entries",
      icon: Gauge,
    },
    {
      label: "Tracking coverage",
      value: trackingCoverageNum !== null ? `${trackingCoverageNum}%` : "—",
      note: "of trackable days",
      icon: CalendarCheck2,
    },
    {
      label: "Current streak",
      value: loading90 ? "…" : `${maxCurrentStreak} days`,
      note: "fully recorded",
      icon: Flame,
    },
    {
      label: "Longest streak",
      value: loading90 ? "…" : `${maxLongestStreak} days`,
      note: "across commitments",
      icon: Target,
    },
  ];

  if (loading90) {
    return (
      <AppShell headerTitle="Insights">
        <div className="mx-auto max-w-6xl space-y-8">
          <PageIntro
            eyebrow="LAST 90 DAYS"
            title="Patterns, not judgments."
            description="Completion is calculated from recorded entries. Tracking coverage is shown separately."
          />
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading insights…
          </div>
        </div>
      </AppShell>
    );
  }

  if (error90) {
    const message =
      err90 instanceof ApiError ? err90.message : "Failed to load insights.";
    return (
      <AppShell headerTitle="Insights">
        <div className="mx-auto max-w-6xl">
          <div className="border border-status-no/40 bg-status-no/10 p-6">
            <p className="text-sm font-semibold text-status-no">
              Could not load insights
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void refetch90()}
            >
              Try again
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const noData = !stats90 || stats90.task_stats.length === 0;

  return (
    <AppShell headerTitle="Insights">
      <div className="mx-auto max-w-6xl space-y-8">
        <PageIntro
          eyebrow="LAST 90 DAYS"
          title="Patterns, not judgments."
          description="Completion is calculated from recorded entries. Tracking coverage is shown separately."
        />

        {/* Key metrics */}
        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Key metrics"
        >
          {metrics.map(({ label, value, note, icon: Icon }, index) => (
            <div
              key={label}
              className="animate-fade-up border border-border bg-card p-6 opacity-0 [animation-fill-mode:forwards]"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="mb-4 flex items-start justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {label}
                </p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-4xl font-bold tracking-tight">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{note}</p>
            </div>
          ))}
        </section>

        {/* Chart + time windows */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
          {/* Weekly completion trend chart */}
          <div className="border border-border bg-card p-5 md:p-6">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold">Completion trend</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Weekly rate · recorded entries only
                </p>
              </div>
              <span
                className={`flex items-center gap-1 text-xs font-medium ${trendClass[overallTrend]}`}
              >
                <TrendIconComp className="h-3 w-3" /> {trendLabel[overallTrend]}
              </span>
            </div>

            {weeklyLoading ? (
              <div className="flex h-64 items-center justify-center border-b border-l border-border text-xs text-muted-foreground">
                Loading chart…
              </div>
            ) : weeklyError || !weeklyRates ? (
              <div className="flex h-64 flex-col items-center justify-center border-b border-l border-border text-xs text-status-no">
                <p>Failed to load chart</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => void refetchWeekly()}
                  className="mt-1 h-auto p-0"
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="relative h-64 border-b border-l border-border">
                <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-muted-foreground">
                  <span className="-translate-x-7">100%</span>
                  <span className="-translate-x-6">75%</span>
                  <span className="-translate-x-6">50%</span>
                  <span className="-translate-x-5">25%</span>
                </div>
                <div className="absolute inset-0 flex items-end gap-2 px-3 md:gap-3">
                  {weeklyRates.map((rate, index) => (
                    <div
                      key={index}
                      className="group relative flex h-full flex-1 items-end"
                    >
                      <div
                        className="w-full bg-primary/25 transition-colors group-hover:bg-primary"
                        style={{ height: `${rate}%` }}
                      />
                      <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[10px] group-hover:block">
                        {rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
              <span>12 weeks ago</span>
              <span>This week</span>
            </div>
          </div>

          {/* Time windows */}
          <div className="border border-border bg-card p-5 md:p-6">
            <h3 className="text-sm font-semibold">Time windows</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Completion rate by period
            </p>
            <div className="mt-6 space-y-6">
              {[
                {
                  label: "7 days",
                  value: fmtRateNum(stats7?.avg_rate ?? null),
                  raw: stats7?.avg_rate ?? null,
                },
                {
                  label: "30 days",
                  value: fmtRateNum(stats30?.avg_rate ?? null),
                  raw: stats30?.avg_rate ?? null,
                },
                {
                  label: "90 days",
                  value: fmtRateNum(stats90?.avg_rate ?? null),
                  raw: stats90?.avg_rate ?? null,
                },
              ].map(({ label, value, raw }) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <strong>{raw !== null ? `${value}%` : "—"}</strong>
                  </div>
                  <div className="h-1.5 bg-secondary">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-2 border border-border">
              <div className="border-r border-border p-4">
                <p className="text-xs text-muted-foreground">Highest</p>
                <p className="mt-1 text-xl font-bold">
                  {fmtRate(stats90?.max_rate ?? null)}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground">Lowest</p>
                <p className="mt-1 text-xl font-bold">
                  {fmtRate(stats90?.min_rate ?? null)}
                </p>
              </div>
              <div className="col-span-2 border-t border-border p-4">
                <p className="text-xs text-muted-foreground">Spread</p>
                <p className="mt-1 text-xl font-bold">
                  {stats90?.spread !== null && stats90?.spread !== undefined
                    ? `${Math.round(stats90.spread * 100)} points`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Per-commitment breakdown */}
        <section>
          <div className="mb-3">
            <h3 className="text-sm font-semibold">By commitment</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Completion and recording coverage are intentionally separate.
            </p>
          </div>

          {noData ? (
            <div className="border border-border bg-card p-8 text-center">
              <p className="text-sm font-semibold">No data yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start recording your commitments to see per-commitment insights.
              </p>
            </div>
          ) : (
            <div className="border border-border bg-card">
              {stats90!.task_stats.map((ts, index) => {
                const Icon = iconMap[getTaskIcon(ts.task.name)];
                const trend = ts.trend;
                const TrendIcon = trendIcon[trend];
                const completionPct = fmtRateNum(ts.completion_rate);
                // Coverage = recorded / total period days (excluding pre-creation days)
                const periodDays =
                  (new Date(ts.end_date).getTime() -
                    new Date(ts.start_date).getTime()) /
                    86_400_000 +
                  1;
                const coveragePct =
                  periodDays > 0
                    ? Math.round((ts.recorded / periodDays) * 100)
                    : 0;

                return (
                  <div
                    key={ts.task.id}
                    className={`grid gap-5 p-5 md:grid-cols-[minmax(180px,0.7fr)_1fr_1fr_auto] md:items-center ${index < stats90!.task_stats.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-secondary text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">
                        {ts.task.name}
                      </span>
                    </div>
                    <Rate
                      label="Completion"
                      value={ts.completion_rate !== null ? completionPct : null}
                      color="bg-primary"
                    />
                    <Rate
                      label="Coverage"
                      value={coveragePct}
                      color="bg-foreground/60"
                    />
                    <span
                      className={`flex min-w-20 items-center justify-end gap-1 text-xs font-medium ${trendClass[trend]}`}
                    >
                      <TrendIcon className="h-3 w-3" /> {trendLabel[trend]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Rate({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{value !== null ? `${value}%` : "—"}</span>
      </div>
      <div className="h-1 bg-secondary">
        <div
          className={`h-full ${color}`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}
