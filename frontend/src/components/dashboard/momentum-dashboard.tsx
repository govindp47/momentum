/**
 * Momentum Dashboard — main view.
 *
 * Consumes GET /api/v1/dashboard via the useDashboard() hook.
 * Shows loading skeleton, error state with retry, and real backend data.
 * Does NOT use mock data, localStorage, or initialCommitments.
 */

import {
  Activity,
  AlertCircle,
  ArrowRight,
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
  // Parse "YYYY-MM-DD" safely without timezone offset issues
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
// Error state
// ---------------------------------------------------------------------------

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center justify-center gap-5 py-24 text-center"
      role="alert"
    >
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
      <div>
        <h2 className="text-sm font-semibold">Unable to load your dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Could not reach the Momentum backend. Make sure the server is running.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
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
    },
    {
      label: "Best rate",
      value: fmtRate(ledger.max_rate),
      note: "in period",
    },
    {
      label: "Lowest rate",
      value: fmtRate(ledger.min_rate),
      note: "in period",
    },
    {
      label: "Coverage",
      value: coverage !== null ? `${coverage}%` : "—",
      note: `${ledger.tracked_days} of ${ledger.total_days} days tracked`,
    },
  ] as const;

  return (
    <section aria-labelledby="ledger-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarCheck2 className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="ledger-heading" className="text-sm font-semibold">
          LifeLedger
        </h2>
        <span className="text-xs text-muted-foreground">
          {fmtDate(ledger.start_date)} – {fmtDate(ledger.end_date)}
        </span>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        {stats.map(({ label, value, note }) => (
          <div key={label} className="bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      {/* Per-task breakdown */}
      {ledger.task_stats.length > 0 && (
        <div className="border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              BY COMMITMENT · {ledger.total_days}-DAY WINDOW
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
                ? "text-status-yes"
                : ts.trend === "↓"
                  ? "text-status-no"
                  : "text-muted-foreground";

            return (
              <article
                key={ts.task.id}
                className={`grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${index < ledger.task_stats.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{ts.task.name}</span>
                    <span
                      className={`flex items-center gap-0.5 text-[10px] font-semibold uppercase ${trendColor}`}
                    >
                      <TrendIcon className="h-3 w-3" />
                      {ts.trend}
                    </span>
                  </div>
                  <div
                    className="h-1 overflow-hidden bg-secondary"
                    aria-label={pct !== null ? `${pct}% completion` : "No data"}
                  >
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: pct !== null ? `${pct}%` : "0%" }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Completion</p>
                    <p className="mt-0.5 text-lg font-bold">
                      {fmtRate(ts.completion_rate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Streak</p>
                    <p className="mt-0.5 text-lg font-bold">
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
      )}

      {ledger.task_stats.length === 0 && (
        <div className="border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
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
    <article className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <h3 className="truncate text-sm font-semibold">{journey.name}</h3>
          </div>
          {journey.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
              {journey.description}
            </p>
          )}
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums text-primary">
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 overflow-hidden bg-secondary"
        aria-label={`${pct}% progress`}
      >
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>{progressLabel}</span>
        {streak.current_streak > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <Flame className="h-3 w-3" aria-hidden />
            {streak.current_streak}d streak
          </span>
        )}
        {journey.target_date !== null && (
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" aria-hidden />
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
        <Activity className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="journeys-heading" className="text-sm font-semibold">
          Active journeys
        </h2>
        <span className="text-xs text-muted-foreground">
          {journeys.length} {journeys.length === 1 ? "journey" : "journeys"}
        </span>
      </div>

      {journeys.length > 0 ? (
        <div className="border border-border bg-card divide-y divide-border">
          {journeys.map((item) => (
            <JourneyCard key={item.journey.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="border border-border bg-card p-10 text-center">
          <Activity
            className="mx-auto h-5 w-5 text-muted-foreground"
            aria-hidden
          />
          <p className="mt-4 text-sm font-medium">No active journeys</p>
          <p className="mt-1 text-xs text-muted-foreground">
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
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="today-heading" className="text-sm font-semibold">
          Today's activity
        </h2>
        <span className="text-xs text-muted-foreground">
          {fmtDayOfWeek(asOf)}, {fmtDate(asOf)}
        </span>
      </div>

      {entries.length > 0 ? (
        <div className="border border-border bg-card divide-y divide-border">
          {entries.map(([journeyId, act]) => {
            const mins = Math.round(act.total_duration_seconds / 60);
            const hasDuration = act.total_duration_seconds > 0;
            const hasValue = act.total_value > 0;
            return (
              <div
                key={journeyId}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-xs text-muted-foreground">
                    Journey #{journeyId}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {act.event_count}{" "}
                    {act.event_count === 1 ? "event" : "events"}
                  </p>
                </div>
                <div className="text-right">
                  {hasValue && (
                    <p className="text-sm font-semibold">{act.total_value}</p>
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
        <div className="border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
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

function isPeriodOption(value: number): value is PeriodOption {
  return PERIOD_OPTIONS.some((o) => o.value === value);
}

import { useState } from "react";

export function MomentumDashboard() {
  const [days, setDays] = useState<PeriodOption>(30);
  const { data, isLoading, isError, refetch } = useDashboard(days);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">
            {data
              ? `${fmtDayOfWeek(data.as_of).toUpperCase()} · ${fmtMonth(data.as_of).toUpperCase()}`
              : "\u00a0"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Momentum
          </h1>
          <p className="mt-2 text-muted-foreground">
            A cross-domain view of your commitments and journeys.
          </p>
        </div>

        {/* Period selector */}
        <div className="flex shrink-0 items-center gap-1 border border-border">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              aria-pressed={days === opt.value}
              className={`h-9 px-3 text-xs font-medium transition-colors ${days === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
        <div className="space-y-8 animate-fade-up [animation-delay:80ms]">
          <LedgerSummary ledger={data.ledger} />
          <JourneysSection journeys={data.journeys} />
          <TodayActivity activity={data.today_activity} asOf={data.as_of} />
        </div>
      )}
    </div>
  );
}
