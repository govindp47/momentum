import { createFileRoute } from "@tanstack/react-router";
import {
  Compass,
  Filter,
  Flame,
  RefreshCw,
  Scale,
  Sprout,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { ApiError } from "@/api/client";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FacetedStone } from "@/components/ui/faceted-stone";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatLocalDate,
  todayLocalDate,
  useLedgerAllTasks,
  useLedgerHistory,
  useLedgerInsightsSummary,
  useLedgerInsightsTrend,
} from "@/hooks/queries/use-ledger";
import {
  analyzeThirtyDayBalance,
  type BalanceAnalysisHighlight as BalanceHighlight,
  type BalanceAnalysisTone as BalanceTone,
} from "@/lib/balance-analysis";
import { getCommitmentCategoryMetadata } from "@/lib/commitment-categories";
import { analyzeCumulativeBalanceTrend } from "@/lib/cumulative-balance-analysis";
import { STONES, type StoneId } from "@/lib/stones";
import type {
  HistoryEntryResponse,
  InsightsSummaryResponse,
  InsightsTrendMode,
  InsightsTrendPointResponse,
  InsightsTrendResponse,
  TaskResponse,
} from "@/types/ledger";

export const Route = createFileRoute("/ledger/insights")({
  head: () => ({
    meta: [
      { title: "Insights — LifeLedger" },
      {
        name: "description",
        content:
          "See how your recorded effort is balanced across the commitments that matter in LifeLedger.",
      },
      { property: "og:title", content: "Insights — LifeLedger" },
      {
        property: "og:description",
        content:
          "See how your recorded effort is balanced across the commitments that matter in LifeLedger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsightsPage,
});

type CommitmentScope = "active" | "all" | "custom";
type DatePreset = "7-days" | "30-days" | "year" | "custom";

interface DateRange {
  startDate: string;
  endDate: string;
  error: string | null;
}

interface TrendChartDatum {
  periodLabel: string;
  startDate: string;
  endDate: string;
  details: Record<string, InsightsTrendPointResponse>;
  [key: string]: string | Record<string, InsightsTrendPointResponse> | number;
}

interface TrendSeriesMeta {
  name: string;
  color: string;
}

interface TrendHighlightAnalysis {
  score: number | null;
  level: string;
  highlights: BalanceHighlight[];
  unavailableReason: string | null;
}

interface RegistrationMonth {
  key: string;
  label: string;
  accessibleLabel: string;
  recordedDays: number;
}

interface RegistrationMomentumAnalysis {
  currentStreak: number;
  longestStreak: number;
  months: RegistrationMonth[];
}

const MAX_CUSTOM_RANGE_DAYS = 3_660;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const BALANCE_STONE_ICONS: Record<StoneId, LucideIcon> = {
  lodestar: Compass,
  crucible: RefreshCw,
  verdure: Sprout,
  tidemark: Waves,
  emberwake: Flame,
  concord: Scale,
};

const BALANCE_VALUE_COLORS: Record<StoneId, string> = {
  lodestar: "text-amber-700 dark:text-amber-300",
  crucible: "text-violet-700 dark:text-violet-300",
  verdure: "text-emerald-700 dark:text-emerald-300",
  tidemark: "text-sky-700 dark:text-sky-300",
  emberwake: "text-orange-700 dark:text-orange-300",
  concord: "text-pink-700 dark:text-pink-300",
};

const BALANCE_CARD_BACKGROUNDS: Record<StoneId, string> = {
  lodestar: "bg-amber-500/5",
  crucible: "bg-violet-500/5",
  verdure: "bg-emerald-500/5",
  tidemark: "bg-sky-500/5",
  emberwake: "bg-orange-500/5",
  concord: "bg-pink-500/5",
};

function InsightsPage() {
  const [scope, setScope] = useState<CommitmentScope>("active");
  const [customIds, setCustomIds] = useState<Set<number>>(() => new Set());
  const [datePreset, setDatePreset] = useState<DatePreset>("7-days");
  const [presetEndDate] = useState(() => todayLocalDate());
  const [customStartDate, setCustomStartDate] = useState(() =>
    addCalendarDays(todayLocalDate(), -6),
  );
  const [customEndDate, setCustomEndDate] = useState(() => todayLocalDate());
  const [trendMode, setTrendMode] = useState<InsightsTrendMode>("monthly");
  const currentYear = Number(presetEndDate.slice(0, 4));
  const [trendYear, setTrendYear] = useState(currentYear);

  const {
    data: allTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorValue,
    refetch: refetchTasks,
  } = useLedgerAllTasks();

  useEffect(() => {
    if (!allTasks) return;

    const availableIds = new Set(allTasks.map((task) => task.id));
    setCustomIds((current) => {
      const availableSelection = new Set(
        [...current].filter((id) => availableIds.has(id)),
      );
      return availableSelection.size === current.size
        ? current
        : availableSelection;
    });
  }, [allTasks]);

  const selectedTasks = useMemo(() => {
    if (!allTasks) return [];
    if (scope === "active") return allTasks.filter((task) => task.is_active);
    if (scope === "all") return allTasks;
    return allTasks.filter((task) => customIds.has(task.id));
  }, [allTasks, customIds, scope]);

  const selectedIds = useMemo(
    () => selectedTasks.map((task) => task.id),
    [selectedTasks],
  );
  const dateRange = resolveDateRange(
    datePreset,
    presetEndDate,
    customStartDate,
    customEndDate,
  );
  const summaryQueryEnabled =
    !tasksLoading && selectedIds.length > 0 && dateRange.error === null;
  const trendQueryEnabled = !tasksLoading && selectedIds.length > 0;
  const currentBalanceStartDate = addCalendarDays(presetEndDate, -29);

  const summaryQuery = useLedgerInsightsSummary(
    {
      commitmentIds: selectedIds,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
    summaryQueryEnabled,
  );
  const currentBalanceHistoryQuery = useLedgerHistory({
    from: currentBalanceStartDate,
    to: presetEndDate,
  });
  const registrationHistoryQuery = useLedgerHistory({ to: presetEndDate });
  const trendQuery = useLedgerInsightsTrend(
    {
      commitmentIds: selectedIds,
      referenceDate: presetEndDate,
      year: trendYear,
      mode: trendMode,
    },
    trendQueryEnabled,
  );

  useEffect(() => {
    const availableYears = trendQuery.data?.available_years;
    if (availableYears && !availableYears.includes(trendYear)) {
      setTrendYear(currentYear);
    }
  }, [currentYear, trendQuery.data, trendYear]);

  const applyCustomSelection = (taskIds: Set<number>) => {
    setCustomIds(new Set(taskIds));
    setScope("custom");
  };

  return (
    <AppShell subApp="ledger">
      <div className="mx-auto w-full max-w-5xl space-y-7 md:space-y-8">
        <section className="animate-fade-up">
          <PageIntro
            eyebrow="LEDGER INSIGHTS"
            title="A life in balance."
            description="See how your recorded effort is shared across the commitments you care about. The goal is a balanced rhythm, not perfect daily completion."
            action={
              <RegistrationMomentum
                history={registrationHistoryQuery.data ?? []}
                referenceDate={presetEndDate}
                isLoading={registrationHistoryQuery.isLoading}
                error={
                  registrationHistoryQuery.isError
                    ? registrationHistoryQuery.error
                    : null
                }
                onRetry={() => void registrationHistoryQuery.refetch()}
              />
            }
          />
        </section>

        {!tasksError ? (
          <CurrentBalanceSnapshot
            tasks={selectedTasks}
            history={currentBalanceHistoryQuery.data ?? []}
            startDate={currentBalanceStartDate}
            endDate={presetEndDate}
            isLoading={tasksLoading || currentBalanceHistoryQuery.isLoading}
            error={
              currentBalanceHistoryQuery.isError
                ? currentBalanceHistoryQuery.error
                : null
            }
            onRetry={() => void currentBalanceHistoryQuery.refetch()}
          />
        ) : null}

        <InsightsFilters
          allTasks={allTasks ?? []}
          tasksLoading={tasksLoading}
          scope={scope}
          setScope={setScope}
          customIds={customIds}
          applyCustomSelection={applyCustomSelection}
        />

        {tasksError ? (
          <ErrorState
            title="Could not load commitments"
            error={tasksErrorValue}
            onRetry={() => void refetchTasks()}
          />
        ) : tasksLoading ? (
          <LoadingSummary />
        ) : selectedIds.length === 0 ? (
          <EmptySelection scope={scope} />
        ) : (
          <>
            {dateRange.error ? (
              <div className="rounded-xl border border-status-no/30 bg-status-no/5 p-5 text-sm text-status-no shadow-sm">
                {dateRange.error}
              </div>
            ) : summaryQuery.isLoading ? (
              <Skeleton
                className="h-72 rounded-xl"
                aria-label="Loading balance distribution"
              />
            ) : summaryQuery.isError ? (
              <ErrorState
                title="Could not load insights"
                error={summaryQuery.error}
                onRetry={() => void summaryQuery.refetch()}
              />
            ) : summaryQuery.data ? (
              <Distribution
                summary={summaryQuery.data}
                dateRangeFilter={
                  <InsightsDateRangeFilters
                    datePreset={datePreset}
                    setDatePreset={setDatePreset}
                    customStartDate={customStartDate}
                    setCustomStartDate={setCustomStartDate}
                    customEndDate={customEndDate}
                    setCustomEndDate={setCustomEndDate}
                    latestEndDate={presetEndDate}
                    dateRange={dateRange}
                  />
                }
              />
            ) : null}
            <HistoricalTrend
              trend={trendQuery.data}
              isLoading={trendQuery.isLoading}
              error={trendQuery.isError ? trendQuery.error : null}
              mode={trendMode}
              setMode={setTrendMode}
              year={trendYear}
              setYear={setTrendYear}
              currentYear={currentYear}
              onRetry={() => void trendQuery.refetch()}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

function RegistrationMomentum({
  history,
  referenceDate,
  isLoading,
  error,
  onRetry,
}: {
  history: HistoryEntryResponse[];
  referenceDate: string;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const momentum = useMemo(
    () => analyzeRegistrationMomentum(history, referenceDate),
    [history, referenceDate],
  );
  const highestMonthlyCount = Math.max(
    1,
    ...momentum.months.map((month) => month.recordedDays),
  );

  if (isLoading) {
    return (
      <Skeleton
        className="h-28 w-full rounded-xl sm:w-80"
        aria-label="Loading recording streak"
      />
    );
  }

  if (error) {
    return (
      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-status-no/30 bg-status-no/5 px-4 py-3 shadow-sm sm:w-80">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-status-no">
            Momentum is unavailable
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {errorMessage(error)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 rounded-lg px-2.5 text-[10px]"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <aside
      className="w-full sm:w-80"
      aria-label={`Current recording streak: ${momentum.currentStreak} days. All-time best: ${momentum.longestStreak} days.`}
    >
      <div className="flex items-end justify-end gap-4">
        <div
          className="flex min-w-0 items-end gap-0.5"
          aria-label="Registration days by month"
        >
          {momentum.months.map((month) => (
            <div
              key={month.key}
              className="flex w-6 shrink-0 flex-col items-center"
              title={`${month.accessibleLabel}: ${month.recordedDays} registration day${month.recordedDays === 1 ? "" : "s"}`}
            >
              <div className="flex h-15 w-full flex-col items-center justify-end gap-0.5">
                <span className="text-[8px] font-medium tabular-nums text-muted-foreground">
                  {month.recordedDays}
                </span>
                <div
                  className={`w-full max-w-4 rounded-t-sm transition-colors ${
                    month.key === referenceDate.slice(0, 7)
                      ? "bg-secondary-accent shadow-[0_0_12px_color-mix(in_oklch,var(--secondary-accent)_18%,transparent)]"
                      : "bg-primary/20"
                  }`}
                  style={{
                    height:
                      month.recordedDays === 0
                        ? 2
                        : `${Math.max(10, (month.recordedDays / highestMonthlyCount) * 44)}px`,
                  }}
                  aria-hidden
                />
              </div>
              <span className="truncate text-[8px] font-medium text-muted-foreground">
                {month.label}
              </span>
              <span className="sr-only">
                {month.accessibleLabel}: {month.recordedDays} registration days
              </span>
            </div>
          ))}
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-end justify-end gap-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <Flame className="h-5 w-5 text-orange-500" aria-hidden />
            Streak
          </div>
          <p className="mt-2 text-xl font-bold leading-none tracking-tight tabular-nums">
            {momentum.currentStreak} day
            {momentum.currentStreak === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">
            Best {momentum.longestStreak} day
            {momentum.longestStreak === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </aside>
  );
}

function CurrentBalanceSnapshot({
  tasks,
  history,
  startDate,
  endDate,
  isLoading,
  error,
  onRetry,
}: {
  tasks: TaskResponse[];
  history: HistoryEntryResponse[];
  startDate: string;
  endDate: string;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const analysis = useMemo(
    () =>
      analyzeThirtyDayBalance({
        commitments: tasks.map((task) => ({
          id: task.id,
          name: task.name,
          color: getCommitmentCategoryMetadata(task.category).color,
        })),
        events: history.map(({ entry }) => ({
          commitmentId: entry.task_id,
          date: entry.date,
          contributes: entry.completed,
        })),
        startDate,
        endDate,
      }),
    [endDate, history, startDate, tasks],
  );

  if (isLoading) {
    return (
      <Skeleton
        className="h-32 rounded-xl"
        aria-label="Loading current balance direction"
      />
    );
  }

  if (error) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-xl border border-status-no/30 bg-status-no/5 px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-status-no">
            Current balance is unavailable
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {errorMessage(error)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-lg px-2.5 text-[10px]"
          onClick={onRetry}
        >
          Retry
        </Button>
      </section>
    );
  }

  return (
    <section className="mb-12 space-y-2 md:mb-16">
      <p className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Current direction · Last 30 days
      </p>

      {analysis.score === null ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {analysis.unavailableReason}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {analysis.highlights.map((highlight) => (
            <BalanceHighlightCard key={highlight.key} highlight={highlight} />
          ))}
        </div>
      )}
    </section>
  );
}

function InsightsFilters({
  allTasks,
  tasksLoading,
  scope,
  setScope,
  customIds,
  applyCustomSelection,
}: {
  allTasks: TaskResponse[];
  tasksLoading: boolean;
  scope: CommitmentScope;
  setScope: (scope: CommitmentScope) => void;
  customIds: Set<number>;
  applyCustomSelection: (taskIds: Set<number>) => void;
}) {
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [draftCustomIds, setDraftCustomIds] = useState<Set<number>>(
    () => new Set(),
  );

  const handleCustomPickerOpenChange = (open: boolean) => {
    if (open) {
      setDraftCustomIds(
        scope === "custom" ? new Set(customIds) : new Set<number>(),
      );
      setCustomPickerOpen(true);
      return;
    }

    setCustomPickerOpen(false);
    if (draftCustomIds.size > 0) {
      applyCustomSelection(draftCustomIds);
    }
  };

  const toggleDraftCustomTask = (taskId: number, checked: boolean) => {
    setDraftCustomIds((current) => {
      const next = new Set(current);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const activeTaskCount = allTasks.filter((task) => task.is_active).length;
  const selectedCommitmentCount =
    scope === "active"
      ? activeTaskCount
      : scope === "all"
        ? allTasks.length
        : customIds.size;
  return (
    <section
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Insights filters"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
          <div className="flex h-7 shrink-0 items-center gap-1 px-2 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <Filter className="h-3 w-3" />
            Commitments
          </div>
          {(["active", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
              className={`h-7 shrink-0 rounded-2xl px-3 text-xs font-medium transition-colors ${
                scope === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              {value === "active" ? "Active" : "All"}
            </button>
          ))}
          <Popover
            open={customPickerOpen}
            onOpenChange={handleCustomPickerOpenChange}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-pressed={scope === "custom"}
                disabled={tasksLoading || allTasks.length === 0}
                className={`flex h-7 shrink-0 items-center gap-1 rounded-2xl px-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                  scope === "custom"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                Custom
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(12rem,calc(100vw-2rem))] rounded-3xl p-2"
            >
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {allTasks.map((task) => {
                  const category = getCommitmentCategoryMetadata(task.category);
                  const checkboxId = `insights-task-${task.id}`;
                  return (
                    <Label
                      key={task.id}
                      htmlFor={checkboxId}
                      className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border/60 bg-card/60 p-2 text-[11px] hover:bg-accent/40"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={draftCustomIds.has(task.id)}
                        onCheckedChange={(checked) =>
                          toggleDraftCustomTask(task.id, checked === true)
                        }
                      />
                      <span
                        className="min-w-0 truncate font-semibold"
                        style={{ color: category.color }}
                      >
                        {task.name}
                      </span>
                    </Label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <p className="px-3 text-[11px] text-muted-foreground">
          Viewing {selectedCommitmentCount} commitment
          {selectedCommitmentCount === 1 ? "" : "s"}
        </p>
      </div>
    </section>
  );
}

function InsightsDateRangeFilters({
  datePreset,
  setDatePreset,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  latestEndDate,
  dateRange,
}: {
  datePreset: DatePreset;
  setDatePreset: (preset: DatePreset) => void;
  customStartDate: string;
  setCustomStartDate: (value: string) => void;
  customEndDate: string;
  setCustomEndDate: (value: string) => void;
  latestEndDate: string;
  dateRange: DateRange;
}) {
  const [customDateDialogOpen, setCustomDateDialogOpen] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(customStartDate);
  const [draftEndDate, setDraftEndDate] = useState(customEndDate);
  const draftDateError = validateCustomDateRange(
    draftStartDate,
    draftEndDate,
    latestEndDate,
  );
  const dateRangeLabel =
    datePreset === "7-days"
      ? "Last 7 days"
      : datePreset === "30-days"
        ? "Last 30 days"
        : datePreset === "year"
          ? "Past year"
          : "Custom range";

  const handleCustomDateDialogOpenChange = (open: boolean) => {
    if (open) {
      setDraftStartDate(customStartDate);
      setDraftEndDate(customEndDate);
    }
    setCustomDateDialogOpen(open);
  };

  const applyCustomDateRange = () => {
    if (draftDateError) return;
    setCustomStartDate(draftStartDate);
    setCustomEndDate(draftEndDate);
    setDatePreset("custom");
    setCustomDateDialogOpen(false);
  };

  return (
    <div className="space-y-1 sm:text-right">
      <div
        className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm"
        aria-label={`Date range: ${formatExactDate(dateRange.startDate)} to ${formatExactDate(dateRange.endDate)}, inclusive`}
      >
        {(
          [
            ["7 days", "7-days"],
            ["30 days", "30-days"],
            ["1 year", "year"],
          ] as const
        ).map(([label, value]) => (
          <button
            key={value}
            type="button"
            aria-pressed={datePreset === value}
            onClick={() => setDatePreset(value)}
            className={`h-7 shrink-0 rounded-2xl px-3 text-xs font-medium transition-colors ${
              datePreset === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <Dialog
          open={customDateDialogOpen}
          onOpenChange={handleCustomDateDialogOpenChange}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              aria-pressed={datePreset === "custom"}
              className={`h-7 shrink-0 rounded-xl px-3 text-xs font-medium transition-colors ${
                datePreset === "custom"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              Custom
            </button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Custom date range</DialogTitle>
              <DialogDescription>
                Choose the inclusive start and end dates for your insights.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div>
                <Label
                  htmlFor="insights-start"
                  className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Start date
                </Label>
                <Input
                  id="insights-start"
                  type="date"
                  value={draftStartDate}
                  max={draftEndDate || undefined}
                  onChange={(event) => setDraftStartDate(event.target.value)}
                  className="mt-1.5 rounded-lg text-xs"
                />
              </div>
              <div>
                <Label
                  htmlFor="insights-end"
                  className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  End date
                </Label>
                <Input
                  id="insights-end"
                  type="date"
                  value={draftEndDate}
                  min={draftStartDate || undefined}
                  max={latestEndDate}
                  onChange={(event) => setDraftEndDate(event.target.value)}
                  className="mt-1.5 rounded-lg text-xs"
                />
              </div>
            </div>
            <p
              className={`text-[10px] ${draftDateError ? "text-status-no" : "text-muted-foreground"}`}
            >
              {draftDateError ??
                `Custom ranges can span up to ${MAX_CUSTOM_RANGE_DAYS.toLocaleString()} calendar days.`}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustomDateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={draftDateError !== null}
                onClick={applyCustomDateRange}
              >
                Apply range
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <p className="px-3 text-[11px] text-muted-foreground">
        {dateRangeLabel} · {formatExactDate(dateRange.startDate)} –{" "}
        {formatExactDate(dateRange.endDate)}
      </p>
    </div>
  );
}

interface DistributionTreemapTileProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  color?: string;
  Icon?: ReturnType<typeof getCommitmentCategoryMetadata>["icon"];
  categoryLabel?: string;
  completedDays?: number;
  recordedDays?: number;
  distributionPercentage?: number;
}

function DistributionTreemapTile({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  depth = 0,
  name = "",
  color = "var(--color-muted)",
  Icon,
  categoryLabel = "",
  completedDays = 0,
  recordedDays = 0,
  distributionPercentage = 0,
}: DistributionTreemapTileProps) {
  if (depth !== 1 || width <= 0 || height <= 0) {
    return null;
  }

  const showLabel = width >= 72 && height >= 42;
  const showRecordedDays = width >= 104 && height >= 42;
  const approximateCharacterWidth = width >= 150 ? 7 : 6;
  const maxCharacters = Math.max(
    4,
    Math.floor((width - 20) / approximateCharacterWidth),
  );
  const displayName =
    name.length > maxCharacters ? `${name.slice(0, maxCharacters - 1)}…` : name;
  const accessibleLabel = `${name}: ${formatPercentage(distributionPercentage)} (${completedDays}/${recordedDays})`;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const iconSize = Math.min(Math.min(width, height) * 0.62, 128);
  const showIcon = Icon && iconSize >= 20;
  const showCategory = categoryLabel && width >= 88 && height >= 48;
  const maxCategoryCharacters = Math.max(5, Math.floor((width - 16) / 5));
  const displayCategory =
    categoryLabel.length > maxCategoryCharacters
      ? `${categoryLabel.slice(0, maxCategoryCharacters - 1)}…`
      : categoryLabel;

  return (
    <g role="img" aria-label={accessibleLabel}>
      <title>{accessibleLabel}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.12}
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={2}
        shapeRendering="crispEdges"
        style={{
          filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))",
        }}
      />
      {showIcon ? (
        <foreignObject
          x={centerX - iconSize / 2}
          y={centerY - iconSize / 2}
          width={iconSize}
          height={iconSize}
          pointerEvents="none"
          aria-hidden
        >
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color, opacity: 0.12 }}
          >
            <Icon className="h-full w-full" />
          </div>
        </foreignObject>
      ) : null}
      {showLabel ? (
        <>
          <text
            x={centerX}
            y={centerY}
            fill={color}
            fontFamily="inherit"
            fontSize={width >= 140 ? 16 : 12}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {displayName}
          </text>
          <text
            x={x + 8}
            y={y + 8}
            fill={color}
            fontFamily="inherit"
            fontSize={width >= 140 ? 13 : 11}
            fontWeight={700}
            textAnchor="start"
            dominantBaseline="hanging"
          >
            {formatPercentage(distributionPercentage)}
          </text>
          {showRecordedDays ? (
            <text
              x={x + width - 8}
              y={y + 8}
              fill={color}
              fontFamily="inherit"
              fontSize={11}
              fontWeight={600}
              textAnchor="end"
              dominantBaseline="hanging"
            >
              {completedDays}/{recordedDays}
            </text>
          ) : null}
          {showCategory ? (
            <text
              x={x + width - 8}
              y={y + height - 7}
              fill={color}
              fillOpacity={0.8}
              fontFamily="inherit"
              fontSize={9}
              fontWeight={500}
              textAnchor="end"
            >
              {displayCategory}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function Distribution({
  summary,
  dateRangeFilter,
}: {
  summary: InsightsSummaryResponse;
  dateRangeFilter: ReactNode;
}) {
  const hasEntries = summary.commitment_stats.some(
    (stats) => stats.recorded_days > 0,
  );
  const hasCompletions = summary.total_completed_days > 0;
  const treemapData = summary.commitment_stats
    .filter((stats) => stats.completed_days > 0)
    .map((stats) => {
      const category = getCommitmentCategoryMetadata(stats.task.category);
      return {
        name: stats.task.name,
        completedDays: stats.completed_days,
        recordedDays: stats.recorded_days,
        distributionPercentage: stats.distribution_percentage,
        color: category.color,
        Icon: category.icon,
        categoryLabel: category.label,
      };
    })
    .sort((left, right) => right.completedDays - left.completedDays);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            Balance across commitments
          </h2>
          <p className="text-[13px] font-medium text-muted-foreground">
            See how your completed days are shared across the commitments in
            this view.
          </p>
        </div>
        {dateRangeFilter}
      </div>

      {hasCompletions ? (
        <div className="overflow-hidden rounded-4xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur-sm md:p-4">
          <div className="flex items-center justify-between gap-3 px-1 pb-3 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <span>How your effort is shared</span>
            <span>
              recorded days: {summary.days_with_any_entry} /{" "}
              {summary.calendar_days}
            </span>
          </div>
          <ChartContainer
            config={{}}
            className="h-48 w-full aspect-auto overflow-hidden rounded-2xl md:h-56"
            role="img"
            aria-label="Treemap showing how completed days are balanced across selected commitments"
          >
            <Treemap
              data={treemapData}
              dataKey="completedDays"
              nameKey="name"
              aspectRatio={2 / 1}
              content={<DistributionTreemapTile />}
              isAnimationActive={false}
            />
          </ChartContainer>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card/80 p-4 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          {hasEntries
            ? "No completed entries in this range, so every distribution share is 0%."
            : "No entries were recorded in this range. Missing dates are not counted as incomplete."}
        </div>
      )}
    </section>
  );
}

function HistoricalTrend({
  trend,
  isLoading,
  error,
  mode,
  setMode,
  year,
  setYear,
  currentYear,
  onRetry,
}: {
  trend: InsightsTrendResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  mode: InsightsTrendMode;
  setMode: (mode: InsightsTrendMode) => void;
  year: number;
  setYear: (year: number) => void;
  currentYear: number;
  onRetry: () => void;
}) {
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    trend?.series.forEach((series) => {
      const key = trendSeriesKey(series.task.id);
      config[key] = {
        label: series.task.name,
        color: getCommitmentCategoryMetadata(series.task.category).color,
      };
    });
    return config;
  }, [trend]);
  const seriesMeta = useMemo<Record<string, TrendSeriesMeta>>(() => {
    const metadata: Record<string, TrendSeriesMeta> = {};
    trend?.series.forEach((series) => {
      const key = trendSeriesKey(series.task.id);
      metadata[key] = {
        name: series.task.name,
        color: getCommitmentCategoryMetadata(series.task.category).color,
      };
    });
    return metadata;
  }, [trend]);
  const chartData = useMemo(() => buildTrendChartData(trend), [trend]);
  const yAxis = useMemo(() => buildTrendYAxis(trend), [trend]);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(
    null,
  );
  const [pinnedPeriodKey, setPinnedPeriodKey] = useState<string | null>(null);
  const hoveredDatum =
    hoveredTrendIndex === null ? undefined : chartData[hoveredTrendIndex];
  const pinnedDatum =
    (pinnedPeriodKey
      ? chartData.find((datum) => trendPeriodKey(datum) === pinnedPeriodKey)
      : undefined) ?? chartData.at(-1);
  const displayedDatum = hoveredDatum ?? pinnedDatum;
  const isDisplayingPinnedDatum = !hoveredDatum && Boolean(pinnedDatum);
  const availableYears = useMemo(() => {
    const years = new Set(trend?.available_years ?? []);
    years.add(year);
    return [...years].sort((left, right) => right - left);
  }, [trend?.available_years, year]);
  const pinnedMonthHistoryQuery = useLedgerHistory(
    pinnedDatum ? { from: pinnedDatum.startDate, to: pinnedDatum.endDate } : {},
    trend?.mode === "monthly" && Boolean(pinnedDatum),
  );
  const balanceAnalysis = useMemo(
    () =>
      analyzePinnedTrendBalance({
        trend,
        pinnedDatum,
        monthlyHistory: pinnedMonthHistoryQuery.data ?? [],
      }),
    [pinnedDatum, pinnedMonthHistoryQuery.data, trend],
  );
  const balanceAnalysisLoading =
    isLoading ||
    (trend?.mode === "monthly" && pinnedMonthHistoryQuery.isLoading);
  const balanceAnalysisError =
    trend?.mode === "monthly" && pinnedMonthHistoryQuery.isError
      ? pinnedMonthHistoryQuery.error
      : null;

  return (
    <section className="mt-8 space-y-7 md:mt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">
            Your balance over time
          </h2>
          <p className="text-[13px] font-medium text-muted-foreground">
            {mode === "monthly"
              ? year === currentYear
                ? "Compare how your effort was shared within each of the last 12 calendar months."
                : `Compare how your effort was shared across the 12 calendar months of ${year}.`
              : year === currentYear
                ? "Follow how your balance develops cumulatively across the last 12 calendar months."
                : `Follow how your balance developed cumulatively across ${year}.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <div
            className="flex items-center gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm"
            role="group"
            aria-label="Balance trend view"
          >
            {(["monthly", "cumulative"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  if (mode === value) return;
                  setHoveredTrendIndex(null);
                  setPinnedPeriodKey(null);
                  setMode(value);
                }}
                className={`h-7 rounded-2xl px-3 text-xs font-medium transition-colors ${
                  mode === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                {value === "monthly" ? "Monthly balance" : "Cumulative trend"}
              </button>
            ))}
          </div>
          <Select
            value={String(year)}
            onValueChange={(value) => {
              setHoveredTrendIndex(null);
              setPinnedPeriodKey(null);
              setYear(Number(value));
            }}
          >
            <SelectTrigger
              className="h-9 w-20 rounded-2xl border-border/70 bg-card/80 text-xs font-medium shadow-sm backdrop-blur-sm"
              aria-label="Balance trend year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-20 min-w-0 rounded-2xl">
              {availableYears.map((availableYear) => (
                <SelectItem
                  key={availableYear}
                  value={String(availableYear)}
                  className="w-auto rounded-xl py-1 text-[11px] data-[state=checked]:bg-accent/80 data-[state=checked]:font-medium"
                >
                  {availableYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TrendBalanceHighlights
        analysis={balanceAnalysis}
        isLoading={balanceAnalysisLoading}
        error={balanceAnalysisError}
        onRetry={() => void pinnedMonthHistoryQuery.refetch()}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
          <Skeleton className="h-80 w-full rounded-xl md:h-96" />
          <Skeleton className="h-80 w-full rounded-xl md:h-96" />
        </div>
      ) : error ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-status-no/30 bg-status-no/5 text-center shadow-sm">
          <p className="text-xs font-semibold text-status-no">
            Could not load balance history
          </p>
          <p className="mt-1 max-w-md text-[10px] text-muted-foreground">
            {errorMessage(error)}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3 rounded-lg"
          >
            Try again
          </Button>
        </div>
      ) : trend && chartData.length === trend.period_count ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
          <div className="h-72 overflow-hidden rounded-4xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur-sm md:h-80 md:p-4">
            <ChartContainer
              config={chartConfig}
              className="h-full w-full aspect-auto"
            >
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 8, left: -8, bottom: 4 }}
                onMouseMove={(state) => {
                  setHoveredTrendIndex(
                    state.isTooltipActive &&
                      state.activeTooltipIndex !== undefined
                      ? state.activeTooltipIndex
                      : null,
                  );
                }}
                onMouseLeave={() => setHoveredTrendIndex(null)}
                onClick={(state) => {
                  if (state.activeTooltipIndex === undefined) return;
                  const datum = chartData[state.activeTooltipIndex];
                  if (datum) setPinnedPeriodKey(trendPeriodKey(datum));
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="periodLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={9}
                  minTickGap={20}
                  fontSize={9}
                />
                <YAxis
                  domain={[0, yAxis.maximum]}
                  ticks={yAxis.ticks}
                  tickFormatter={(value: number) => `${value}%`}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                  fontSize={9}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--color-border)" }}
                  content={() => null}
                />
                <ChartLegend
                  content={
                    <ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 text-[10px]" />
                  }
                />
                {trend.series.map((series) => {
                  const key = trendSeriesKey(series.task.id);
                  return (
                    <Line
                      key={series.task.id}
                      type="monotone"
                      dataKey={key}
                      name={series.task.name}
                      stroke={`var(--color-${key})`}
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ChartContainer>
          </div>
          <TrendPeriodDetails
            datum={displayedDatum}
            seriesMeta={seriesMeta}
            isPinned={isDisplayingPinnedDatum}
          />
        </div>
      ) : (
        <div className="flex h-72 items-center justify-center rounded-xl border border-border/70 bg-card/80 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          No balance history is available.
        </div>
      )}
    </section>
  );
}

function TrendBalanceHighlights({
  analysis,
  isLoading,
  error,
  onRetry,
}: {
  analysis: TrendHighlightAnalysis | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-label="Loading balance analysis"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-status-no/30 bg-status-no/5 px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-status-no">
            Could not analyze the pinned month
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {errorMessage(error)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-lg px-2.5 text-[10px]"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!analysis) return null;

  if (analysis.score === null) {
    return (
      <div className="rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
        {analysis.unavailableReason}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {analysis.highlights.map((highlight) => (
        <BalanceHighlightCard key={highlight.key} highlight={highlight} />
      ))}
    </div>
  );
}

function BalanceHighlightCard({ highlight }: { highlight: BalanceHighlight }) {
  const tone = balanceToneClasses(highlight.tone);
  const stone = STONES[highlight.stone];
  const StoneIcon = BALANCE_STONE_ICONS[highlight.stone];
  return (
    <article
      className={`relative isolate min-w-0 overflow-hidden rounded-4xl border p-3 shadow-md backdrop-blur-sm ${BALANCE_CARD_BACKGROUNDS[highlight.stone]} ${stone.theme.border} ${stone.theme.glow}`}
    >
      <div
        className={`absolute inset-0 z-0 bg-gradient-to-br opacity-[0.06] ${stone.theme.gradient}`}
        aria-hidden
      />
      <div
        className={`absolute -right-10 top-1/2 z-0 h-28 w-28 -translate-y-1/2 rounded-full blur-2xl ${stone.theme.inner}`}
        aria-hidden
      />
      <div
        className={`absolute -bottom-10 -right-6 z-0 h-24 w-24 rotate-12 rounded-[2rem] blur-md ${stone.theme.facet}`}
        aria-hidden
      />
      <StoneIcon
        className={`absolute -bottom-7 -right-5 z-0 h-28 w-28 rotate-[-12deg] ${stone.theme.icon} opacity-[0.15]`}
        aria-hidden
      />
      <div className="relative z-10 flex h-full min-w-0 flex-col">
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-2">
          <div className="min-w-0">
            <span
              className={`inline-flex w-fit items-center gap-1 rounded-full border px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] shadow-sm ${tone.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {tone.label}
            </span>
            <p className="mt-1 min-w-0 truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
              {highlight.title}
            </p>
          </div>
          <FacetedStone
            stone={highlight.stone}
            icon={StoneIcon}
            size="small"
            className="-translate-x-2 origin-top-right scale-65"
            title={`${stone.name} · ${stone.purpose}`}
          />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {highlight.color ? (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: highlight.color }}
              aria-hidden
            />
          ) : null}
          <p
            className={`truncate text-[12px] font-bold tracking-tight ${BALANCE_VALUE_COLORS[highlight.stone]}`}
          >
            {highlight.value}
          </p>
        </div>
        <p className="truncate whitespace-nowrap text-[9px] font-medium leading-snug">
          {highlight.detail}
        </p>
      </div>
    </article>
  );
}

function TrendPeriodDetails({
  datum,
  seriesMeta,
  isPinned,
}: {
  datum: TrendChartDatum | undefined;
  seriesMeta: Record<string, TrendSeriesMeta>;
  isPinned: boolean;
}) {
  return (
    <aside className="flex h-72 min-w-0 flex-col overflow-hidden rounded-4xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:h-80">
      {datum ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold">
              {formatExactDate(datum.startDate)} –{" "}
              {formatExactDate(datum.endDate)}
            </p>
            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {isPinned ? "Pinned" : "Preview"}
            </span>
          </div>
          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {Object.entries(datum.details)
              .sort(
                ([, left], [, right]) =>
                  right.distribution_percentage - left.distribution_percentage,
              )
              .map(([key, point]) => {
                const meta = seriesMeta[key];
                if (!meta) return null;
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/60 bg-card/60 p-2.5 text-[10px]"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium">{meta.name}</span>
                      <span className="shrink-0 font-normal tabular-nums text-muted-foreground">
                        ({point.completed_days}/{point.recorded_days})
                      </span>
                    </span>
                    <span className="text-right font-semibold tabular-nums">
                      {formatPercentage(point.distribution_percentage)}
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-3 text-center">
          <p className="text-xs font-semibold">Explore a period</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Hover over the trend to preview its details. Click a period to keep
            it here.
          </p>
        </div>
      )}
    </aside>
  );
}

function LoadingSummary() {
  return (
    <div className="space-y-5" aria-label="Loading insights">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

function EmptySelection({ scope }: { scope: CommitmentScope }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-9 text-center shadow-sm backdrop-blur-sm">
      <p className="text-sm font-semibold">
        {scope === "custom"
          ? "No commitments selected"
          : "No commitments match this filter"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {scope === "custom"
          ? "Choose at least one commitment to calculate Insights. An empty custom selection stays empty."
          : "Try All or Custom selection to include archived commitments."}
      </p>
    </div>
  );
}

function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-status-no/30 bg-status-no/5 p-5 shadow-sm">
      <p className="text-sm font-semibold text-status-no">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {errorMessage(error)}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 rounded-lg"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}

function analyzePinnedTrendBalance({
  trend,
  pinnedDatum,
  monthlyHistory,
}: {
  trend: InsightsTrendResponse | undefined;
  pinnedDatum: TrendChartDatum | undefined;
  monthlyHistory: HistoryEntryResponse[];
}): TrendHighlightAnalysis | null {
  if (!trend || !pinnedDatum) return null;

  const commitments = trend.series.map((series) => ({
    id: series.task.id,
    name: series.task.name,
    color: getCommitmentCategoryMetadata(series.task.category).color,
  }));

  if (trend.mode === "monthly") {
    return analyzeThirtyDayBalance({
      commitments,
      events: monthlyHistory.map(({ entry }) => ({
        commitmentId: entry.task_id,
        date: entry.date,
        contributes: entry.completed,
      })),
      startDate: pinnedDatum.startDate,
      endDate: pinnedDatum.endDate,
    });
  }

  const firstSeries = trend.series[0];
  if (!firstSeries) return null;

  const pinnedPointIndex = firstSeries.points.findIndex(
    (point) =>
      point.start_date === pinnedDatum.startDate &&
      point.end_date === pinnedDatum.endDate,
  );
  if (pinnedPointIndex < 0) return null;

  const checkpoints = firstSeries.points
    .slice(0, pinnedPointIndex + 1)
    .map((point, pointIndex) => ({
      date: point.end_date,
      shares: trend.series.map((series) => ({
        commitmentId: series.task.id,
        percentage: series.points[pointIndex]?.distribution_percentage ?? 0,
      })),
    }));

  return analyzeCumulativeBalanceTrend({ commitments, checkpoints });
}

function balanceToneClasses(tone: BalanceTone): {
  badge: string;
  dot: string;
  label: string;
} {
  const classes: Record<
    BalanceTone,
    {
      badge: string;
      dot: string;
      label: string;
    }
  > = {
    positive: {
      badge: "border-status-yes/30 bg-status-yes/10 text-status-yes",
      dot: "bg-status-yes",
      label: "Healthy",
    },
    neutral: {
      badge: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
      dot: "bg-sky-500",
      label: "Neutral",
    },
    attention: {
      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
      label: "Watch",
    },
    critical: {
      badge: "border-status-no/30 bg-status-no/10 text-status-no",
      dot: "bg-status-no",
      label: "Critical",
    },
  };
  return classes[tone];
}

function resolveDateRange(
  preset: DatePreset,
  presetEndDate: string,
  customStartDate: string,
  customEndDate: string,
): DateRange {
  if (preset === "7-days") {
    return {
      startDate: addCalendarDays(presetEndDate, -6),
      endDate: presetEndDate,
      error: null,
    };
  }
  if (preset === "30-days") {
    return {
      startDate: addCalendarDays(presetEndDate, -29),
      endDate: presetEndDate,
      error: null,
    };
  }
  if (preset === "year") {
    return {
      startDate: addCalendarYears(presetEndDate, -1),
      endDate: presetEndDate,
      error: null,
    };
  }
  return {
    startDate: customStartDate,
    endDate: customEndDate,
    error: validateCustomDateRange(
      customStartDate,
      customEndDate,
      presetEndDate,
    ),
  };
}

function validateCustomDateRange(
  startDate: string,
  endDate: string,
  latestEndDate: string,
): string | null {
  if (!startDate || !endDate) {
    return "Choose both a start date and an end date.";
  }
  if (startDate > endDate) {
    return "Start date cannot be after end date.";
  }
  if (endDate > latestEndDate) {
    return "End date cannot be after today.";
  }
  const calendarDays = calendarDayDifference(startDate, endDate) + 1;
  return calendarDays > MAX_CUSTOM_RANGE_DAYS
    ? `Custom ranges cannot exceed ${MAX_CUSTOM_RANGE_DAYS.toLocaleString()} calendar days.`
    : null;
}

function addCalendarDays(value: string, amount: number): string {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const localDate = new Date(year, month - 1, day, 12);
  localDate.setDate(localDate.getDate() + amount);
  return formatLocalDate(localDate);
}

function addCalendarYears(value: string, amount: number): string {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  const targetYear = year + amount;
  const lastDayOfTargetMonth = new Date(targetYear, month, 0, 12).getDate();
  return formatLocalDate(
    new Date(targetYear, month - 1, Math.min(day, lastDayOfTargetMonth), 12),
  );
}

function calendarDayDifference(startDate: string, endDate: string): number {
  const [startYear = 0, startMonth = 1, startDay = 1] = startDate
    .split("-")
    .map(Number);
  const [endYear = 0, endMonth = 1, endDay = 1] = endDate
    .split("-")
    .map(Number);
  const startOrdinal = Date.UTC(startYear, startMonth - 1, startDay);
  const endOrdinal = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endOrdinal - startOrdinal) / 86_400_000);
}

function analyzeRegistrationMomentum(
  history: HistoryEntryResponse[],
  referenceDate: string,
): RegistrationMomentumAnalysis {
  const recordedDates = [
    ...new Set(
      history
        .map(({ entry }) => entry.date)
        .filter((entryDate) => entryDate <= referenceDate),
    ),
  ].sort();
  const recordedDateSet = new Set(recordedDates);

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: string | null = null;
  for (const recordedDate of recordedDates) {
    runningStreak =
      previousDate !== null &&
      calendarDayDifference(previousDate, recordedDate) === 1
        ? runningStreak + 1
        : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = recordedDate;
  }

  const yesterday = addCalendarDays(referenceDate, -1);
  let streakCursor = recordedDateSet.has(referenceDate)
    ? referenceDate
    : recordedDateSet.has(yesterday)
      ? yesterday
      : null;
  let currentStreak = 0;
  while (streakCursor && recordedDateSet.has(streakCursor)) {
    currentStreak += 1;
    streakCursor = addCalendarDays(streakCursor, -1);
  }

  const currentMonth = referenceDate.slice(0, 7);
  const earliestMonth = recordedDates[0]?.slice(0, 7) ?? currentMonth;
  const firstVisibleMonth = [
    shiftCalendarMonth(currentMonth, -5),
    earliestMonth,
  ]
    .sort()
    .at(-1)!;
  const recordedDaysByMonth = new Map<string, number>();
  recordedDates.forEach((recordedDate) => {
    const monthKey = recordedDate.slice(0, 7);
    recordedDaysByMonth.set(
      monthKey,
      (recordedDaysByMonth.get(monthKey) ?? 0) + 1,
    );
  });

  const months: RegistrationMonth[] = [];
  for (
    let monthKey = firstVisibleMonth;
    monthKey <= currentMonth;
    monthKey = shiftCalendarMonth(monthKey, 1)
  ) {
    const [year = 0, month = 1] = monthKey.split("-").map(Number);
    const monthLabel = MONTH_NAMES[month - 1] ?? monthKey;
    months.push({
      key: monthKey,
      label: monthLabel,
      accessibleLabel: `${monthLabel} ${year}`,
      recordedDays: recordedDaysByMonth.get(monthKey) ?? 0,
    });
  }

  return { currentStreak, longestStreak, months };
}

function shiftCalendarMonth(value: string, amount: number): string {
  const [year = 0, month = 1] = value.split("-").map(Number);
  const monthIndex = year * 12 + month - 1 + amount;
  const shiftedYear = Math.floor(monthIndex / 12);
  const shiftedMonth = (monthIndex % 12) + 1;
  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}`;
}

function formatExactDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day || month > 12) return value || "—";
  const monthName = MONTH_NAMES[month - 1];
  return monthName ? `${monthName} ${day}, ${year}` : value;
}

function formatMonth(value: string): string {
  const [, month] = value.split("-").map(Number);
  if (!month || month > 12) return value;
  return MONTH_NAMES[month - 1] ?? value;
}

function formatPercentage(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}

function trendSeriesKey(taskId: number): string {
  return `commitment_${taskId}`;
}

function trendPeriodKey(datum: TrendChartDatum): string {
  return `${datum.startDate}:${datum.endDate}`;
}

function buildTrendChartData(
  trend: InsightsTrendResponse | undefined,
): TrendChartDatum[] {
  const firstSeries = trend?.series[0];
  if (!firstSeries) return [];

  return firstSeries.points.map((point, index) => {
    const datum: TrendChartDatum = {
      periodLabel:
        trend.mode === "monthly"
          ? formatMonth(point.start_date)
          : formatMonth(point.end_date),
      startDate: point.start_date,
      endDate: point.end_date,
      details: {},
    };
    trend.series.forEach((series) => {
      const seriesPoint = series.points[index];
      if (!seriesPoint) return;
      const key = trendSeriesKey(series.task.id);
      datum[key] = seriesPoint.distribution_percentage;
      datum.details[key] = seriesPoint;
    });
    return datum;
  });
}

function buildTrendYAxis(trend: InsightsTrendResponse | undefined): {
  maximum: number;
  ticks: number[];
} {
  const highestPercentage = Math.max(
    0,
    ...(trend?.series.flatMap((series) =>
      series.points.map((point) => point.distribution_percentage),
    ) ?? []),
  );
  const step =
    highestPercentage <= 25
      ? 5
      : highestPercentage <= 50
        ? 10
        : highestPercentage <= 80
          ? 20
          : 25;
  const maximum = Math.max(step, Math.ceil(highestPercentage / step) * step);
  const ticks = Array.from(
    { length: maximum / step + 1 },
    (_, index) => index * step,
  );
  return { maximum, ticks };
}

function errorMessage(error: Error | null): string {
  if (error instanceof ApiError) return error.message;
  return error?.message ?? "An unexpected error occurred.";
}
