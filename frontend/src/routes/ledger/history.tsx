import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  X,
} from "lucide-react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { iconMap, getTaskIcon, type Status } from "@/lib/lifeledger";
import {
  useLedgerHistory,
  useLedgerTasks,
  formatLocalDate,
} from "@/hooks/queries/use-ledger";
import type { HistoryEntryResponse } from "@/types/ledger";
import { ApiError } from "@/api/client";

export const Route = createFileRoute("/ledger/history")({
  head: () => ({
    meta: [
      { title: "History — LifeLedger" },
      {
        name: "description",
        content: "Explore historical daily commitment records in LifeLedger.",
      },
      { property: "og:title", content: "History — LifeLedger" },
      {
        property: "og:description",
        content: "Explore historical daily commitment records in LifeLedger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Return the ISO weekday index (0=Mon … 6=Sun) for a JS Date. */
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Format a Date as "YYYY-MM-DD" without timezone shifting. */
function toDateStr(d: Date): string {
  return formatLocalDate(d);
}

interface DayStats {
  date: string;
  yes: number;
  no: number;
  unrecorded: number;
}

function HistoryPage() {
  const today = new Date();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(today));
  const [filter, setFilter] = useState("all");

  const monthFrom = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthTo = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: activeTasks } = useLedgerTasks();

  const {
    data: historyEntries,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErrorObj,
    refetch: refetchHistory,
  } = useLedgerHistory({ from: monthFrom, to: monthTo });

  const filteredTaskName = useMemo(() => {
    if (filter === "all") return undefined;

    const id = Number(filter);

    return (activeTasks ?? []).find((task) => task.id === id)?.name;
  }, [filter, activeTasks]);

  const dayStatsMap = useMemo((): Map<string, DayStats> => {
    const map = new Map<string, DayStats>();
    const entries = historyEntries ?? [];

    for (const item of entries) {
      const { entry, task } = item;

      if (filteredTaskName && task.name !== filteredTaskName) continue;

      const dateStr = entry.date;

      if (!map.has(dateStr)) {
        map.set(dateStr, {
          date: dateStr,
          yes: 0,
          no: 0,
          unrecorded: 0,
        });
      }

      const stat = map.get(dateStr)!;

      if (entry.completed) {
        stat.yes++;
      } else {
        stat.no++;
      }
    }

    return map;
  }, [historyEntries, filteredTaskName]);

  const selectedEntries = useMemo((): HistoryEntryResponse[] => {
    return (historyEntries ?? []).filter(
      (item) => item.entry.date === selectedDate,
    );
  }, [historyEntries, selectedDate]);

  const activeTasksForDay = activeTasks ?? [];

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const leadingBlanks = isoWeekday(firstOfMonth);

  const monthName = firstOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const canGoNext =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);

  const selectedCompleted = selectedEntries.filter(
    (entry) => entry.entry.completed,
  ).length;

  const selectedMissed = selectedEntries.filter(
    (entry) => !entry.entry.completed,
  ).length;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  };

  const nextMonth = () => {
    if (!canGoNext) return;

    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  };

  return (
    <AppShell subApp="ledger">
      <div className="mx-auto w-full max-w-5xl space-y-7 md:space-y-8">
        {/* ── Page introduction ───────────────────────────────────────── */}
        <section className="animate-fade-up">
          <PageIntro
            eyebrow={monthName.toUpperCase()}
            title="Your days, in context."
            description="Recorded, missed, and untouched entries remain visually distinct."
          />
        </section>

        {/* ── Controls ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={prevMonth}
              className="h-9 w-9 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <strong className="min-w-36 text-center text-sm tracking-tight">
              {monthName}
            </strong>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={nextMonth}
              className="h-9 w-9 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <label className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Commitment
            <div className="relative">
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-9 min-w-44 appearance-none rounded-lg border border-border/70 bg-background/60 py-2 pl-3 pr-9 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                <option value="all">All commitments</option>

                {(activeTasks ?? []).map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>

              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </label>
        </section>

        {/* ── Error state ─────────────────────────────────────────────── */}
        {historyError && (
          <div className="overflow-hidden rounded-xl border border-status-no/30 bg-status-no/5 p-5 shadow-sm">
            <p className="text-sm font-semibold text-status-no">
              Could not load history
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {historyErrorObj instanceof ApiError
                ? historyErrorObj.message
                : "Failed to load history."}
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
              onClick={() => void refetchHistory()}
            >
              Try again
            </Button>
          </div>
        )}

        {/* ── Calendar + selected day ─────────────────────────────────── */}
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.72fr)]">
          {/* Calendar */}
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-5">
            <div className="grid grid-cols-7 border-b border-border/70 pb-3">
              {WEEK_LABELS.map((day) => (
                <div
                  key={day}
                  className="text-center text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {historyLoading ? (
              <div className="flex min-h-80 items-center justify-center text-xs text-muted-foreground">
                Loading history…
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: leadingBlanks }, (_, index) => (
                  <div
                    key={`blank-${index}`}
                    className="aspect-square border-b border-r border-border/50"
                  />
                ))}

                {Array.from({ length: lastDay }, (_, index) => {
                  const dayNum = index + 1;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const isFuture = dateStr > toDateStr(today);
                  const chosen = dateStr === selectedDate;
                  const stat = dayStatsMap.get(dateStr);
                  const colIndex = (leadingBlanks + index) % 7;
                  const totalRecorded = stat ? stat.yes + stat.no : 0;

                  return (
                    <button
                      key={dateStr}
                      disabled={isFuture}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative aspect-square min-w-0 border-b border-r border-border/50 p-1 text-left transition-all duration-200 md:p-2 ${
                        isFuture
                          ? "cursor-default opacity-35"
                          : "hover:bg-accent/40"
                      } ${
                        chosen
                          ? "bg-primary/5 outline outline-1 outline-primary/60 -outline-offset-1"
                          : ""
                      } ${colIndex === 6 ? "border-r-0" : ""}`}
                    >
                      <span
                        className={`text-[11px] md:text-xs ${
                          chosen
                            ? "font-bold text-primary"
                            : "font-medium text-muted-foreground"
                        }`}
                      >
                        {dayNum}
                      </span>

                      {stat && totalRecorded > 0 && (
                        <div className="absolute inset-x-1 bottom-1 flex h-1 overflow-hidden rounded-full md:inset-x-2 md:bottom-2">
                          <span
                            className="bg-status-yes transition-all"
                            style={{
                              width: `${(stat.yes / totalRecorded) * 100}%`,
                            }}
                          />

                          <span
                            className="bg-status-no transition-all"
                            style={{
                              width: `${(stat.no / totalRecorded) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-[10px] font-medium text-muted-foreground">
              <Legend color="bg-status-yes" label="Yes" />
              <Legend color="bg-status-no" label="No" />
              <Legend color="bg-muted" label="Not recorded" />
              <Legend
                color="bg-background border border-border"
                label="Not trackable"
              />
            </div>
          </div>

          {/* Detail panel */}
          <aside className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
            <div className="border-b border-border/70 p-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                {selectedDateObject
                  .toLocaleDateString("en-US", {
                    weekday: "long",
                  })
                  .toUpperCase()}
              </p>

              <h3 className="mt-1 text-xl font-bold tracking-tight">
                {selectedDateObject.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}
              </h3>

              {selectedEntries.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-status-yes/25 bg-status-yes/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-status-yes">
                    {selectedCompleted} completed
                  </span>

                  <span className="rounded-full border border-status-no/25 bg-status-no/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.06em] text-status-no">
                    {selectedMissed} missed
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                  No entries recorded
                </p>
              )}
            </div>

            <div>
              {activeTasksForDay.length === 0 &&
              selectedEntries.length === 0 ? (
                <div className="p-7 text-center">
                  <p className="text-xs font-semibold">
                    No commitments to show.
                  </p>

                  <p className="mt-1 text-[10px] text-muted-foreground">
                    There are no active commitments for this day.
                  </p>
                </div>
              ) : (
                (() => {
                  const entryMap = new Map<number, boolean>();

                  for (const entry of selectedEntries) {
                    entryMap.set(entry.task.id, entry.entry.completed);
                  }

                  const displayItems = [
                    ...selectedEntries.map((entry) => ({
                      task: entry.task,
                      hasEntry: true,
                      completed: entry.entry.completed,
                    })),
                    ...activeTasksForDay
                      .filter((task) => !entryMap.has(task.id))
                      .map((task) => ({
                        task,
                        hasEntry: false,
                        completed: false,
                      })),
                  ];

                  const filtered = filteredTaskName
                    ? displayItems.filter(
                        (item) => item.task.name === filteredTaskName,
                      )
                    : displayItems;

                  if (filtered.length === 0) {
                    return (
                      <div className="p-7 text-center">
                        <p className="text-xs font-semibold">
                          No entry for this commitment
                        </p>

                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Nothing was recorded on this day.
                        </p>
                      </div>
                    );
                  }

                  return filtered.map((item, index) => {
                    const status: Status = !item.hasEntry
                      ? "unrecorded"
                      : item.completed
                        ? "yes"
                        : "no";

                    const Icon = iconMap[getTaskIcon(item.task.name)];

                    const Mark =
                      status === "yes" ? Check : status === "no" ? X : Minus;

                    const statusColor =
                      status === "yes"
                        ? "text-status-yes"
                        : status === "no"
                          ? "text-status-no"
                          : "text-muted-foreground";

                    const iconStyle =
                      status === "yes"
                        ? "border-status-yes/30 bg-status-yes/10 text-status-yes"
                        : status === "no"
                          ? "border-status-no/30 bg-status-no/10 text-status-no"
                          : "border-border/70 bg-secondary/70 text-muted-foreground";

                    return (
                      <div
                        key={item.task.id}
                        className={`flex items-center gap-3 p-4 transition-colors hover:bg-accent/30 ${
                          index < filtered.length - 1
                            ? "border-b border-border/70"
                            : ""
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm ${iconStyle}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                          {item.task.name}
                        </span>

                        <span
                          className={`flex shrink-0 items-center gap-1 text-[9px] font-bold uppercase tracking-[0.06em] ${statusColor}`}
                        >
                          <Mark className="h-3 w-3" />
                          {status === "unrecorded" ? "Not recorded" : status}
                        </span>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
