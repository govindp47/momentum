import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CalendarCheck2,
  Flame,
  Gauge,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useStrideDashboard,
  useJourneyStats,
} from "@/hooks/queries/use-stride";
import type { DateRangePreset } from "@/types/stride";
import { formatPercentage } from "@/lib/utils";

export const Route = createFileRoute("/stride/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Stride" },
      {
        name: "description",
        content:
          "Understand your consistency, pace, and progress trends in Stride.",
      },
    ],
  }),
  component: StrideInsightsPage,
});

const RANGE_OPTIONS: Array<{ label: string; value: DateRangePreset }> = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "Year", value: "this-year" },
];

function StrideInsightsPage() {
  const [range, setRange] = useState<DateRangePreset>("30d");

  const { data: dashboard, isLoading } = useStrideDashboard();

  const activeJourneys =
    dashboard?.journeys.filter((dj) => dj.journey.is_active).slice(0, 4) ?? [];

  const focusJourneyId = activeJourneys[0]?.journey.id;

  const { data: focusStats, isLoading: focusStatsLoading } =
    useJourneyStats(focusJourneyId ?? 0, {
      range,
    });

  const totalStreak = activeJourneys[0]?.streak.current_streak ?? 0;
  const totalActiveDays = activeJourneys[0]?.streak.active_days ?? 0;

  const totalEvents =
    dashboard?.journeys.reduce(
      (sum, dj) => sum + (dj.progress.event_count ?? 0),
      0,
    ) ?? 0;

  const activeJourneyCount = activeJourneys.length;

  const chartData = buildChartData(focusStats);

  return (
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <PageIntro
              eyebrow="PATTERNS, NOT PRESSURE"
              title="See how you’re moving."
              description="Progress becomes clearer when you step back and look at the pattern."
            />
          </div>

          <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={range === option.value ? "secondary" : "ghost"}
                onClick={() => setRange(option.value)}
                className="h-7 rounded-lg px-2.5 text-[10px] font-semibold"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            [1, 2, 3, 4].map((key) => (
              <Skeleton key={key} className="h-24 rounded-xl" />
            ))
          ) : (
            <>
              <StatCard
                icon={Flame}
                label="The rhythm you’re building."
                value={`${totalStreak} days`}
                iconClass="text-orange-500"
                iconBgClass="bg-orange-500/10"
                borderClass="border-orange-500/20"
              />

              <StatCard
                icon={CalendarCheck2}
                label="Days you showed up."
                value={String(totalActiveDays)}
                iconClass="text-sky-500"
                iconBgClass="bg-sky-500/10"
                borderClass="border-sky-500/20"
              />

              <StatCard
                icon={Activity}
                label="Steps that added up."
                value={String(totalEvents)}
                iconClass="text-emerald-500"
                iconBgClass="bg-emerald-500/10"
                borderClass="border-emerald-500/20"
              />

              <StatCard
                icon={Gauge}
                label="Paths still in motion."
                value={String(activeJourneyCount)}
                iconClass="text-violet-500"
                iconBgClass="bg-violet-500/10"
                borderClass="border-violet-500/20"
              />
            </>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.8fr)]">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Activity rhythm
                </p>
                <h2 className="mt-1 truncate text-xl font-bold tracking-tight md:text-2xl">
                  {focusStats
                    ? `${focusStats.stats.journey.name} — ${focusStats.stats.period_label}`
                    : "The shape of your progress."}
                </h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {focusStats
                    ? `Analytics for the selected ${RANGE_OPTIONS.find((option) => option.value === range)?.label.toLowerCase() ?? "period"}`
                    : "Select an active journey to explore its rhythm."}
                </p>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="mt-6 h-64 md:h-72">
              {focusStatsLoading ? (
                <div className="flex h-full items-end gap-3 px-3 pb-5">
                  {[42, 68, 50, 82, 58, 92, 70].map((height, index) => (
                    <Skeleton
                      key={index}
                      className="flex-1 rounded-t-md"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              ) : !focusJourneyId ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-border/60 bg-background/20">
                  <div className="text-center">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10">
                      <Activity className="h-4 w-4 text-sky-500" />
                    </div>
                    <p className="mt-3 text-xs font-semibold">
                      No active journey
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Start a journey to see progress analytics here.
                    </p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="var(--color-border)"
                      vertical={false}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      stroke="var(--color-muted-foreground)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-accent)", opacity: 0.35 }}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 10,
                        color: "var(--color-popover-foreground)",
                        fontSize: 11,
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill="var(--color-primary)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Journey progress
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
                  {activeJourneys.length} active
                </h2>
              </div>

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Your journeys are moving forward. Keep the rhythm going.
            </p>

            {activeJourneys.length > 0 ? (
              <div className="mt-6 space-y-4">
                {activeJourneys.map((dj) => (
                  <div key={dj.journey.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-[10px] font-semibold">
                        {dj.journey.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                        {formatPercentage(dj.progress.percentage)}
                      </span>
                    </div>

                    <Progress
                      value={dj.progress.percentage}
                      className="mt-2 h-1.5"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-border/60 bg-background/20 p-4 text-[10px] text-muted-foreground">
                No active journeys to track yet.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Where your energy is going.
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
                Momentum by journey
              </h2>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
              <Gauge className="h-4 w-4 text-violet-500" />
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((key) => (
                <Skeleton key={key} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : activeJourneys.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {activeJourneys.map((dj, index) => (
                <JourneyComparisonCard
                  key={dj.journey.id}
                  name={dj.journey.name}
                  percentage={dj.progress.percentage}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-border/60 bg-background/20 p-4 text-xs text-muted-foreground">
              No active journeys to compare.
            </div>
          )}
        </section>

        {!isLoading && activeJourneys.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-3">
            <InsightNote
              icon={Flame}
              title="Keep the streak"
              description={`${totalStreak} day${totalStreak === 1 ? "" : "s"} of current momentum.`}
              iconClass="text-orange-500"
              iconBgClass="bg-orange-500/10"
            />

            <InsightNote
              icon={CalendarCheck2}
              title="Stay consistent"
              description={`${totalActiveDays} active day${totalActiveDays === 1 ? "" : "s"} recorded for your focus journey.`}
              iconClass="text-sky-500"
              iconBgClass="bg-sky-500/10"
            />

            <InsightNote
              icon={Activity}
              title="Keep logging"
              description={`${totalEvents} progress event${totalEvents === 1 ? "" : "s"} recorded across your journeys.`}
              iconClass="text-emerald-500"
              iconBgClass="bg-emerald-500/10"
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
  iconBgClass,
  borderClass,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  iconClass: string;
  iconBgClass: string;
  borderClass: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border ${borderClass} bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-5`}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
        >
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>

        <span className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className={`mt-4 text-2xl font-bold tracking-tight ${iconClass}`}>
        {value}
      </div>
    </div>
  );
}

function JourneyComparisonCard({
  name,
  percentage,
  index,
}: {
  name: string;
  percentage: number;
  index: number;
}) {
  const accents = [
    {
      value: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      bar: "bg-emerald-500",
    },
    {
      value: "text-sky-500",
      bg: "bg-sky-500/10",
      border: "border-sky-500/20",
      bar: "bg-sky-500",
    },
    {
      value: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      bar: "bg-violet-500",
    },
    {
      value: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      bar: "bg-orange-500",
    },
  ];

  function getJourneyAccent(index: number) {
    return (
      accents[index % accents.length] ?? {
        value: "text-emerald-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        bar: "bg-emerald-500",
      }
    );
  }

  const accent = getJourneyAccent(index);

  return (
    <div
      className={`overflow-hidden rounded-xl border ${accent.border} bg-background/20 p-4 transition-colors hover:bg-accent/20`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${accent.bar}`}
          aria-hidden="true"
        />
        <div className="min-w-0 truncate text-[11px] font-semibold">
          {name}
        </div>
      </div>

      <div className={`mt-4 text-2xl font-bold tracking-tight ${accent.value}`}>
        {formatPercentage(percentage)}%
      </div>

      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        overall progress
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${accent.bar}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}

function InsightNote({
  icon: Icon,
  title,
  description,
  iconClass,
  iconBgClass,
}: {
  icon: typeof Flame;
  title: string;
  description: string;
  iconClass: string;
  iconBgClass: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur-sm">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
      >
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

/** Build chart data from journey analytics. Falls back to empty placeholders. */
function buildChartData(
  stats: import("@/types/stride").JourneyAnalyticsResponse | undefined,
): Array<{ label: string; value: number }> {
  if (!stats) {
    return [];
  }

  return [
    {
      label: stats.stats.period_label,
      value: stats.stats.total_value,
    },
    {
      label: "Best day",
      value: Number(stats.stats.best_day_value.toFixed(2)),
    },
    {
      label: "Avg/day",
      value: Math.round(stats.stats.average_per_active_day * 10) / 10,
    },
  ];
}