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
  const {
    data: stats90,
    isLoading: loading90,
    isError: error90,
    error: err90,
    refetch: refetch90,
  } = useLedgerStats(90);

  const { data: stats7 } = useLedgerStats(7);
  const { data: stats30 } = useLedgerStats(30);

  const {
    data: weeklyRates,
    isLoading: weeklyLoading,
    isError: weeklyError,
    refetch: refetchWeekly,
  } = useLedgerWeeklyStats(12);

  const overallTrend: Trend = stats90 ? deriveOverallTrend(stats90) : "—";
  const TrendIconComp = trendIcon[overallTrend];

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
      iconClass: "text-emerald-500",
      iconBgClass: "bg-emerald-500/10",
    },
    {
      label: "Tracking coverage",
      value: trackingCoverageNum !== null ? `${trackingCoverageNum}%` : "—",
      note: "of trackable days",
      icon: CalendarCheck2,
      iconClass: "text-sky-500",
      iconBgClass: "bg-sky-500/10",
    },
    {
      label: "Current streak",
      value: loading90 ? "…" : `${maxCurrentStreak} days`,
      note: "fully recorded",
      icon: Flame,
      iconClass: "text-orange-500",
      iconBgClass: "bg-orange-500/10",
    },
    {
      label: "Longest streak",
      value: loading90 ? "…" : `${maxLongestStreak} days`,
      note: "across commitments",
      icon: Target,
      iconClass: "text-violet-500",
      iconBgClass: "bg-violet-500/10",
    },
  ];

  if (loading90) {
    return (
      <AppShell subApp="ledger">
        <div className="mx-auto w-full max-w-5xl space-y-7 md:space-y-8">
          <PageIntro
            eyebrow="LAST 90 DAYS"
            title="Patterns, not judgments."
            description="Completion is calculated from recorded entries. Tracking coverage is shown separately."
          />

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-7 text-center text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
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
      <AppShell subApp="ledger">
        <div className="mx-auto w-full max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-status-no/30 bg-status-no/5 p-5 shadow-sm">
            <p className="text-sm font-semibold text-status-no">
              Could not load insights
            </p>

            <p className="mt-1 text-xs text-muted-foreground">{message}</p>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
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
    <AppShell subApp="ledger">
      <div className="mx-auto w-full max-w-5xl space-y-7 md:space-y-8">
        {/* ── Page introduction ───────────────────────────────────────── */}
        <section className="animate-fade-up">
          <PageIntro
            eyebrow="LAST 90 DAYS"
            title="Patterns, not judgments."
            description="Completion is calculated from recorded entries. Tracking coverage is shown separately."
          />
        </section>

        {/* ── Key metrics ──────────────────────────────────────────────── */}
        <section
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
          aria-label="Key metrics"
        >
          {metrics.map(({ label, value, note, icon: Icon, iconClass, iconBgClass }, index) => (
            <div
              key={label}
              className="animate-fade-up rounded-xl border border-border/70 bg-card/80 p-4 opacity-0 shadow-sm backdrop-blur-sm [animation-fill-mode:forwards] md:p-5"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {label}
                </p>

                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}>
                  <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
                </div>
              </div>

              <p className="text-2xl font-bold tracking-tight md:text-3xl">
                {value}
              </p>

              <p className="mt-1 text-[10px] font-medium text-muted-foreground md:text-[11px]">
                {note}
              </p>
            </div>
          ))}
        </section>

        {/* ── Chart + time windows ────────────────────────────────────── */}
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.75fr)]">
          {/* Weekly completion trend */}
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-5">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight">
                  Completion trend
                </h3>

                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  Weekly rate · recorded entries only
                </p>
              </div>

              <span
                className={`flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${trendClass[overallTrend]}`}
              >
                <TrendIconComp className="h-3 w-3" />
                {trendLabel[overallTrend]}
              </span>
            </div>

            {weeklyLoading ? (
              <div className="flex h-56 items-center justify-center rounded-lg border border-border/60 bg-background/20 text-xs text-muted-foreground">
                Loading chart…
              </div>
            ) : weeklyError || !weeklyRates ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-border/60 bg-background/20 text-xs text-status-no">
                <p>Failed to load chart</p>

                <Button
                  variant="link"
                  size="sm"
                  onClick={() => void refetchWeekly()}
                  className="mt-1 h-auto p-0 text-xs"
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="relative h-56">
                <div className="absolute inset-y-0 left-0 flex flex-col justify-between pb-5 pt-0 text-[9px] text-muted-foreground">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>

                <div className="absolute inset-y-0 left-8 right-0 flex flex-col justify-between pb-5">
                  {[100, 75, 50, 25, 0].map((value) => (
                    <div
                      key={value}
                      className="border-t border-border/50"
                    />
                  ))}
                </div>

                <div className="absolute inset-y-0 bottom-5 left-9 right-0 flex items-end gap-1.5 px-2 md:gap-2">
                  {weeklyRates.map((rate, index) => (
                    <div
                      key={index}
                      className="group relative flex h-full flex-1 items-end"
                    >
                      <div
                        className="w-full min-h-px rounded-t-sm bg-primary/25 transition-all duration-200 group-hover:bg-primary"
                        style={{ height: `${rate}%` }}
                      />

                      <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border/70 bg-card px-1.5 py-0.5 text-[9px] font-semibold shadow-sm group-hover:block">
                        {rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-2 flex justify-between pl-9 text-[9px] font-medium text-muted-foreground">
              <span>12 weeks ago</span>
              <span>This week</span>
            </div>
          </div>

          {/* Time windows */}
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-5">
            <h3 className="text-sm font-bold tracking-tight">
              Time windows
            </h3>

            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              Completion rate by period
            </p>

            <div className="mt-5 space-y-5">
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
                  <div className="mb-1.5 flex justify-between text-[11px]">
                    <span className="font-medium text-muted-foreground">
                      {label}
                    </span>

                    <strong className="font-bold">
                      {raw !== null ? `${value}%` : "—"}
                    </strong>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border border-border/70 bg-background/20">
              <div className="border-r border-border/70 p-3">
                <p className="text-[10px] font-medium text-muted-foreground">
                  Highest
                </p>

                <p className="mt-1 text-lg font-bold tracking-tight">
                  {fmtRate(stats90?.max_rate ?? null)}
                </p>
              </div>

              <div className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground">
                  Lowest
                </p>

                <p className="mt-1 text-lg font-bold tracking-tight">
                  {fmtRate(stats90?.min_rate ?? null)}
                </p>
              </div>

              <div className="col-span-2 border-t border-border/70 p-3">
                <p className="text-[10px] font-medium text-muted-foreground">
                  Spread
                </p>

                <p className="mt-1 text-lg font-bold tracking-tight">
                  {stats90?.spread !== null && stats90?.spread !== undefined
                    ? `${Math.round(stats90.spread * 100)} points`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Per-commitment breakdown ────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                By commitment
              </h3>

              <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                Completion and recording coverage are intentionally separate.
              </p>
            </div>
          </div>

          {noData ? (
            <div className="rounded-xl border border-border/70 bg-card/80 p-9 text-center shadow-sm backdrop-blur-sm">
              <p className="text-sm font-semibold">No data yet</p>

              <p className="mt-1 text-xs text-muted-foreground">
                Start recording your commitments to see per-commitment
                insights.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
              {stats90!.task_stats.map((ts, index) => {
                const Icon = iconMap[getTaskIcon(ts.task.name)];
                const trend = ts.trend;
                const TrendIcon = trendIcon[trend];
                const completionPct = fmtRateNum(ts.completion_rate);

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
                    className={`grid gap-4 p-4 md:grid-cols-[minmax(160px,0.7fr)_1fr_1fr_auto] md:items-center md:p-5 ${
                      index < stats90!.task_stats.length - 1
                        ? "border-b border-border/70"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/70 text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <span className="truncate text-xs font-semibold">
                        {ts.task.name}
                      </span>
                    </div>

                    <Rate
                      label="Completion"
                      value={
                        ts.completion_rate !== null ? completionPct : null
                      }
                      color="bg-primary"
                    />

                    <Rate
                      label="Coverage"
                      value={coveragePct}
                      color="bg-foreground/60"
                    />

                    <span
                      className={`flex min-w-16 items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-[0.06em] ${trendClass[trend]}`}
                    >
                      <TrendIcon className="h-3 w-3" />
                      {trendLabel[trend]}
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
      <div className="mb-1.5 flex justify-between text-[10px]">
        <span className="font-medium text-muted-foreground">{label}</span>

        <span className="font-semibold">
          {value !== null ? `${value}%` : "—"}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}