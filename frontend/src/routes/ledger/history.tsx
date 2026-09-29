import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, X } from "lucide-react";
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
  unrecorded: number; // active tasks with no entry that day
}

function HistoryPage() {
  const today = new Date();

  // Current viewed month (year + month)
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  // Selected day (full "YYYY-MM-DD" string)
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(today));

  // Task filter
  const [filter, setFilter] = useState("all");

  // Build the from/to for the displayed month
  const monthFrom = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthTo = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Fetch active tasks for the filter dropdown and for the detail panel
  const { data: activeTasks } = useLedgerTasks();

  // Fetch history for this month
  const {
    data: historyEntries,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErrorObj,
    refetch: refetchHistory,
  } = useLedgerHistory({ from: monthFrom, to: monthTo });

  // If a task filter is active, also fetch history just for that task for this month
  const filteredTaskName = useMemo(() => {
    if (filter === "all") return undefined;
    const id = Number(filter);
    return (activeTasks ?? []).find((t) => t.id === id)?.name;
  }, [filter, activeTasks]);

  // Group history by date for the calendar
  const dayStatsMap = useMemo((): Map<string, DayStats> => {
    const map = new Map<string, DayStats>();
    const entries = historyEntries ?? [];

    for (const item of entries) {
      const { entry, task } = item;
      // Skip if filtered by task and doesn't match
      if (filteredTaskName && task.name !== filteredTaskName) continue;

      const dateStr = entry.date;
      if (!map.has(dateStr)) {
        map.set(dateStr, { date: dateStr, yes: 0, no: 0, unrecorded: 0 });
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

  // Detail: entries for the selected date
  const selectedEntries = useMemo((): HistoryEntryResponse[] => {
    return (historyEntries ?? []).filter(
      (item) => item.entry.date === selectedDate,
    );
  }, [historyEntries, selectedDate]);

  // Active tasks for the detail panel (the ones active at time of selected date)
  const activeTasksForDay = activeTasks ?? [];

  // Build calendar grid
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const leadingBlanks = isoWeekday(firstOfMonth); // Mon-indexed

  const monthName = firstOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const canGoNext =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <AppShell headerTitle="History">
      <div className="mx-auto max-w-6xl space-y-8">
        <PageIntro
          eyebrow={monthName.toUpperCase()}
          title="Your days, in context."
          description="Recorded, missed, and untouched entries remain visually distinct."
        />

        <div className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              onClick={prevMonth}
            >
              <ChevronLeft />
            </Button>
            <strong className="min-w-36 text-center text-sm">
              {monthName}
            </strong>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={nextMonth}
            >
              <ChevronRight />
            </Button>
          </div>
          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            Commitment
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-10 min-w-44 border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="all">All commitments</option>
              {(activeTasks ?? []).map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {historyError && (
          <div className="border border-status-no/40 bg-status-no/10 p-4">
            <p className="text-xs text-status-no">
              {historyErrorObj instanceof ApiError
                ? historyErrorObj.message
                : "Failed to load history."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void refetchHistory()}
            >
              Retry
            </Button>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.72fr)]">
          {/* Calendar */}
          <div className="border border-border bg-card p-4 md:p-6">
            <div className="grid grid-cols-7 border-b border-border pb-3">
              {WEEK_LABELS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-semibold uppercase text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {historyLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading history…
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {/* Leading blank cells */}
                {Array.from({ length: leadingBlanks }, (_, i) => (
                  <div
                    key={`blank-${i}`}
                    className="aspect-square border-b border-r border-border/60"
                  />
                ))}

                {/* Day cells */}
                {Array.from({ length: lastDay }, (_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const isFuture = dateStr > toDateStr(today);
                  const chosen = dateStr === selectedDate;
                  const stat = dayStatsMap.get(dateStr);
                  const colIndex = (leadingBlanks + i) % 7;

                  return (
                    <button
                      key={dateStr}
                      disabled={isFuture}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative aspect-square min-w-0 border-b border-r border-border/60 p-1 text-left transition-colors md:p-2 ${isFuture ? "cursor-default opacity-40" : "hover:bg-accent"} ${chosen ? "bg-accent outline outline-1 outline-primary -outline-offset-1" : ""} ${colIndex === 6 ? "border-r-0" : ""}`}
                    >
                      <span
                        className={`text-xs ${chosen ? "font-bold text-primary" : "text-muted-foreground"}`}
                      >
                        {dayNum}
                      </span>
                      {stat && (
                        <div className="absolute inset-x-1 bottom-1 flex h-1 overflow-hidden md:inset-x-2 md:bottom-2">
                          <span
                            className="bg-status-yes"
                            style={{
                              width: `${(stat.yes / (stat.yes + stat.no)) * 100}%`,
                            }}
                          />
                          <span
                            className="bg-status-no"
                            style={{
                              width: `${(stat.no / (stat.yes + stat.no)) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-5 text-xs text-muted-foreground">
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
          <aside className="border border-border bg-card">
            <div className="border-b border-border p-5">
              <p className="text-xs font-medium text-primary">
                {new Date(`${selectedDate}T12:00:00`)
                  .toLocaleDateString("en-US", {
                    weekday: "long",
                  })
                  .toUpperCase()}
              </p>
              <h3 className="mt-1 text-xl font-bold">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    day: "numeric",
                  },
                )}
              </h3>
              {selectedEntries.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectedEntries.filter((e) => e.entry.completed).length}{" "}
                  completed ·{" "}
                  {selectedEntries.filter((e) => !e.entry.completed).length}{" "}
                  missed
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No entries recorded
                </p>
              )}
            </div>

            <div>
              {activeTasksForDay.length === 0 &&
              selectedEntries.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No commitments to show.
                </div>
              ) : (
                (() => {
                  // Build a unified list: recorded entries + active tasks without entries
                  const entryMap = new Map<number, boolean>();
                  for (const e of selectedEntries) {
                    entryMap.set(e.task.id, e.entry.completed);
                  }

                  // Show tasks that have an entry, plus all active tasks
                  const displayItems = [
                    ...selectedEntries.map((e) => ({
                      task: e.task,
                      hasEntry: true,
                      completed: e.entry.completed,
                    })),
                    ...activeTasksForDay
                      .filter((t) => !entryMap.has(t.id))
                      .map((t) => ({
                        task: t,
                        hasEntry: false,
                        completed: false,
                      })),
                  ];

                  // Apply filter
                  const filtered = filteredTaskName
                    ? displayItems.filter(
                        (item) => item.task.name === filteredTaskName,
                      )
                    : displayItems;

                  if (filtered.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No entries for this commitment on this day.
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
                    return (
                      <div
                        key={item.task.id}
                        className={`flex items-center gap-3 p-4 ${index < filtered.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center border border-border bg-secondary text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {item.task.name}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-semibold uppercase ${status === "yes" ? "text-status-yes" : status === "no" ? "text-status-no" : "text-muted-foreground"}`}
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
      <span className={`h-2.5 w-2.5 ${color}`} />
      {label}
    </span>
  );
}
