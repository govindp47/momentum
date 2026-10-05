// momentum-dashboard.tsx

/**
 * Momentum Dashboard — main view.
 *
 * Consumes GET /api/v1/dashboard via the useDashboard() hook.
 * Shows loading skeleton, error state with retry, and real backend data.
 * Does NOT use mock data, localStorage, or initialCommitments.
 */

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Award,
  CalendarCheck2,
  Flame,
  MapPin,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/queries/use-dashboard";
import { DashboardSkeleton } from "./skeleton";
import { PageIntro } from "@/components/app-shell";
import type {
  DashboardJourneyResponse,
  DashboardLedgerResponse,
  DailyActivityResponse,
} from "@/types/dashboard";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function fmtRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function fmtDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDayOfWeek(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

function fmtMonth(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Shared accents
// ---------------------------------------------------------------------------

const summaryAccents = [
  {
    icon: "text-emerald-500",
    background: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    icon: "text-sky-500",
    background: "bg-sky-500/10",
    border: "border-sky-500/20",
  },
  {
    icon: "text-orange-500",
    background: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: "text-violet-500",
    background: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
];

function getSummaryAccent(index: number) {
  return (
    summaryAccents[index % summaryAccents.length] ?? {
      icon: "text-emerald-500",
      background: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    }
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-20 text-center"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5" aria-hidden />
      </div>

      <h2 className="mt-4 text-base font-semibold tracking-tight">
        Unable to load your dashboard
      </h2>

      <p className="mt-1.5 max-w-sm text-sm leading-5 text-muted-foreground">
        Could not reach the Momentum backend. Make sure the server is running.
      </p>

      <Button
        variant="outline"
        size="sm"
        className="mt-4 h-9 rounded-lg px-3 text-xs"
        onClick={onRetry}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger summary
// ---------------------------------------------------------------------------

function LedgerSummary({ ledger }: { ledger: DashboardLedgerResponse }) {
  const coverage =
    ledger.total_days > 0
      ? Math.round((ledger.tracked_days / ledger.total_days) * 100)
      : null;

  const stats = [
    {
      label: "Avg completion",
      value: fmtRate(ledger.avg_rate),
      note: "of recorded entries",
      icon: TrendingUp,
    },
    {
      label: "Best rate",
      value: fmtRate(ledger.max_rate),
      note: "in period",
      icon: Award,
    },
    {
      label: "Lowest rate",
      value: fmtRate(ledger.min_rate),
      note: "in period",
      icon: TrendingDown,
    },
    {
      label: "Coverage",
      value: coverage !== null ? `${coverage}%` : "—",
      note: `${ledger.tracked_days} of ${ledger.total_days} days tracked`,
      icon: CalendarCheck2,
    },
  ] as const;

  return (
    <section aria-labelledby="ledger-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
          <CalendarCheck2 className="h-4 w-4" aria-hidden />
        </div>

        <h2 id="ledger-heading" className="text-base font-semibold">
          LifeLedger
        </h2>

        <span className="text-xs text-muted-foreground">
          {fmtDate(ledger.start_date)} – {fmtDate(ledger.end_date)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon }, index) => {
          const accent = getSummaryAccent(index);

          return (
            <div
              key={label}
              className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accent.background} ${accent.border}`}
                >
                  <Icon className={`h-4 w-4 ${accent.icon}`} />
                </div>

                <p className="text-xl font-semibold leading-none tracking-tight tabular-nums">
                  {value}
                </p>
              </div>

              <p className="mt-3 text-xs font-medium text-muted-foreground">
                {label}
              </p>

              <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
            </div>
          );
        })}
      </div>

      {ledger.task_stats.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
          <div className="border-b border-border/70 px-5 py-3.5">
            <p className="text-xs font-medium text-muted-foreground">
              By commitment · {ledger.total_days}-day window
            </p>
          </div>

          {ledger.task_stats.map((ts, index) => {
            const rate = ts.completion_rate;
            const pct = rate !== null ? Math.round(rate * 100) : null;

            const TrendIcon =
              ts.trend === "↑"
                ? TrendingUp
                : ts.trend === "↓"
                  ? TrendingDown
                  : ArrowRight;

            const trendColor =
              ts.trend === "↑"
                ? "text-emerald-500"
                : ts.trend === "↓"
                  ? "text-status-no"
                  : "text-muted-foreground";

            return (
              <article
                key={ts.task.id}
                className={`grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                  index < ledger.task_stats.length - 1
                    ? "border-b border-border/60"
                    : ""
                }`}
              >
                <div className="min-w-0 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {ts.task.name}
                    </span>

                    <span
                      className={`flex shrink-0 items-center gap-0.5 text-[10px] font-semibold uppercase ${trendColor}`}
                    >
                      <TrendIcon className="h-3 w-3" />
                      {ts.trend}
                    </span>
                  </div>

                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-secondary/80"
                    aria-label={pct !== null ? `${pct}% completion` : "No data"}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: pct !== null ? `${pct}%` : "0%" }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 sm:min-w-40 sm:justify-end">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Completion</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                      {fmtRate(ts.completion_rate)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Streak</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                      {ts.current_streak}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        d
                      </span>
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card/80 p-9 text-center shadow-sm backdrop-blur-sm">
          <CalendarCheck2 className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No commitment statistics for this period.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stride journeys
// ---------------------------------------------------------------------------

function JourneyCard({ item }: { item: DashboardJourneyResponse }) {
  const { journey, progress, streak } = item;
  const pct = Math.min(100, Math.round(progress.percentage));

  const unitLabel = journey.unit !== null ? ` ${journey.unit}` : "";

  const progressLabel = journey.is_milestone_based
    ? `${progress.milestones_completed} / ${progress.milestones_total} milestones`
    : `${progress.current_value}${unitLabel} / ${progress.target_value}${unitLabel}`;

  return (
    <article className="group p-5 transition-colors hover:bg-accent/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" aria-hidden />
            </div>

            <h3 className="truncate text-sm font-semibold">{journey.name}</h3>
          </div>

          {journey.description && (
            <p className="mt-1.5 line-clamp-1 pl-10 text-xs text-muted-foreground">
              {journey.description}
            </p>
          )}
        </div>

        <span className="shrink-0 text-xl font-semibold leading-none tabular-nums">
          {pct}%
        </span>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary/80"
        aria-label={`${pct}% progress`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 pl-10 text-xs text-muted-foreground">
        <span>{progressLabel}</span>

        {streak.current_streak > 0 && (
          <span className="flex items-center gap-1.5 text-secondary-accent">
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {streak.current_streak}d streak
          </span>
        )}

        {journey.target_date !== null && (
          <span className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-sky-500" aria-hidden />
            Target {fmtDate(journey.target_date)}
          </span>
        )}
      </div>
    </article>
  );
}

function JourneysSection({
  journeys,
}: {
  journeys: DashboardJourneyResponse[];
}) {
  return (
    <section aria-labelledby="journeys-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
          <Activity className="h-4 w-4" aria-hidden />
        </div>

        <h2 id="journeys-heading" className="text-base font-semibold">
          Active journeys
        </h2>

        <span className="text-xs text-muted-foreground">
          {journeys.length} {journeys.length === 1 ? "journey" : "journeys"}
        </span>
      </div>

      {journeys.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
          {journeys.map((item) => (
            <div
              key={item.journey.id}
              className="border-b border-border/60 last:border-b-0"
            >
              <JourneyCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card/80 p-9 text-center shadow-sm backdrop-blur-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" aria-hidden />
          </div>

          <p className="mt-4 text-sm font-semibold">No active journeys</p>

          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
            Start a Stride journey to track long-term goals here.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Today's activity
// ---------------------------------------------------------------------------

function TodayActivity({
  activity,
  asOf,
}: {
  activity: Record<string, DailyActivityResponse>;
  asOf: string;
}) {
  const entries = Object.entries(activity);

  return (
    <section aria-labelledby="today-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
          <Flame className="h-4 w-4" aria-hidden />
        </div>

        <h2 id="today-heading" className="text-base font-semibold">
          Today&apos;s activity
        </h2>

        <span className="text-xs text-muted-foreground">
          {fmtDayOfWeek(asOf)}, {fmtDate(asOf)}
        </span>
      </div>

      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
          {entries.map(([journeyId, act]) => {
            const mins = Math.round(act.total_duration_seconds / 60);
            const hasDuration = act.total_duration_seconds > 0;
            const hasValue = act.total_value > 0;

            return (
              <div
                key={journeyId}
                className="flex items-center justify-between gap-4 border-b border-border/60 p-4.5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                    <Activity className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium">Journey #{journeyId}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {act.event_count}{" "}
                      {act.event_count === 1 ? "event" : "events"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {hasValue && (
                    <p className="text-sm font-semibold tabular-nums">
                      {act.total_value}
                    </p>
                  )}

                  {hasDuration && (
                    <p className="text-xs text-muted-foreground">{mins} min</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card/80 p-9 text-center shadow-sm backdrop-blur-sm">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
            <Flame className="h-5 w-5" />
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            No Stride activity recorded today.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard component
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

type PeriodOption = (typeof PERIOD_OPTIONS)[number]["value"];

export function MomentumDashboard() {
  const [days, setDays] = useState<PeriodOption>(30);
  const { data, isLoading, isError, refetch } = useDashboard(days);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 pb-12 md:space-y-8">
      {/* Page header */}
      <PageIntro
        eyebrow="YOUR RHYTHM · YOUR PROGRESS"
        title="Keep moving forward."
        description="A quiet view of how you’re showing up, day by day."
        action={
          <div className="flex shrink-0 items-center rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDays(opt.value)}
                aria-pressed={days === opt.value}
                className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
                  days === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Content states */}
      {isLoading && <DashboardSkeleton />}

      {isError && (
        <DashboardError
          onRetry={() => {
            void refetch();
          }}
        />
      )}

      {data && (
        <div className="space-y-7 animate-fade-up [animation-delay:80ms] md:space-y-8">
          <LedgerSummary ledger={data.ledger} />
          <JourneysSection journeys={data.journeys} />
          <TodayActivity activity={data.today_activity} asOf={data.as_of} />
        </div>
      )}
    </div>
  );
}
