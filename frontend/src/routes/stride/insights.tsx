import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  CalendarCheck,
  Flame,
  Gauge,
  TrendingUp,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/stride/page-header";
import {
  useStrideDashboard,
  useJourneyStats,
} from "@/hooks/queries/use-stride";
import type { DateRangePreset } from "@/types/stride";

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

  // For chart: use stats from the first active journey if available
  const focusJourneyId = activeJourneys[0]?.journey.id;
  const { data: focusStats } = useJourneyStats(focusJourneyId ?? 0, {
    range,
  });

  // Total streak from first journey
  const totalStreak = activeJourneys[0]?.streak.current_streak ?? 0;
  const totalActiveDays = activeJourneys[0]?.streak.active_days ?? 0;
  const totalEvents =
    dashboard?.journeys.reduce(
      (sum, dj) => sum + (dj.progress.event_count ?? 0),
      0,
    ) ?? 0;
  const onPaceCount = activeJourneys.filter(
    (dj) => dj.journey.is_active,
  ).length;

  // Build a simple weekly chart from stats if available
  const chartData = buildChartData(focusStats);

  return (
    <AppShell headerTitle="Insights">
      <div className="animate-fade-up space-y-5 pb-12">
        <PageHeader
          eyebrow="Patterns, not pressure"
          title="Insights"
          description="See the rhythms behind your progress and where your pace is taking you."
          action={
            <div className="flex rounded-xl border border-border bg-card/60 p-1">
              {RANGE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={range === opt.value ? "secondary" : "ghost"}
                  onClick={() => setRange(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          }
        />

        {/* Stat cards */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((k) => (
                <Skeleton key={k} className="h-28 rounded-xl" />
              ))}
            </>
          ) : (
            <>
              <StatCard
                icon={<Flame size={20} />}
                label="Current streak"
                value={`${totalStreak} days`}
              />
              <StatCard
                icon={<CalendarCheck size={20} />}
                label="Active days"
                value={`${totalActiveDays}`}
              />
              <StatCard
                icon={<Activity size={20} />}
                label="Progress events"
                value={String(totalEvents)}
              />
              <StatCard
                icon={<Gauge size={20} />}
                label="Active journeys"
                value={`${onPaceCount}`}
              />
            </>
          )}
        </section>

        {/* Chart + projection */}
        <section className="grid gap-4 lg:grid-cols-[1.35fr_.8fr]">
          <div className="glass rounded-xl p-5 sm:p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Activity rhythm
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {focusStats
                  ? `${focusStats.stats.journey.name} — ${focusStats.stats.period_label}`
                  : "Progress over time"}
              </h2>
            </div>
            <div className="mt-7 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-popover-foreground)",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-primary)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <TrendingUp className="text-primary" size={20} />
            <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Journey progress
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {activeJourneys.length} active
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your journeys are moving forward. Keep the rhythm going.
            </p>
            <div className="mt-6 space-y-4">
              {activeJourneys.map((dj) => (
                <div key={dj.journey.id}>
                  <div className="flex justify-between text-xs">
                    <span className="truncate">{dj.journey.name}</span>
                    <span className="ml-2 shrink-0 text-muted-foreground">
                      {dj.progress.percentage}%
                    </span>
                  </div>
                  <Progress value={dj.progress.percentage} className="mt-2" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Journey comparison */}
        <section className="glass rounded-xl p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Journey comparison
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Momentum by journey
          </h2>
          {isLoading ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((k) => (
                <Skeleton key={k} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : activeJourneys.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {activeJourneys.map((dj) => (
                <div
                  key={dj.journey.id}
                  className="rounded-xl border border-border bg-card/60 p-4"
                >
                  <div className="truncate text-sm">{dj.journey.name}</div>
                  <div className="mt-4 text-3xl font-bold">
                    {dj.progress.percentage}%
                  </div>
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    overall progress
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              No active journeys to compare.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between text-primary">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-5 text-3xl font-bold">{value}</div>
    </div>
  );
}

/** Build chart data from journey analytics. Falls back to empty placeholders. */
function buildChartData(
  stats: import("@/types/stride").JourneyAnalyticsResponse | undefined,
): Array<{ label: string; value: number }> {
  if (!stats) {
    // Decorative fallback while loading or when no journey selected
    return [
      { label: "Mon", value: 3 },
      { label: "Tue", value: 6 },
      { label: "Wed", value: 4 },
      { label: "Thu", value: 8 },
      { label: "Fri", value: 5 },
      { label: "Sat", value: 10 },
      { label: "Sun", value: 7 },
    ];
  }
  // Use backend stats as single bar for the period
  return [
    {
      label: stats.stats.period_label,
      value: stats.stats.total_value,
    },
    {
      label: "Best day",
      value: stats.stats.best_day_value,
    },
    {
      label: "Avg/day",
      value: Math.round(stats.stats.average_per_active_day * 10) / 10,
    },
  ];
}
