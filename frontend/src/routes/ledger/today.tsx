import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { iconMap, getTaskIcon } from "@/lib/lifeledger";
import {
  useLedgerToday,
  useRecordEntry,
  todayLocalDate,
  formatLocalDate,
} from "@/hooks/queries/use-ledger";
import { ApiError } from "@/api/client";

export const Route = createFileRoute("/ledger/today")({
  head: () => ({
    meta: [
      { title: "Today — LifeLedger" },
      {
        name: "description",
        content: "Record today's personal commitments in LifeLedger.",
      },
      { property: "og:title", content: "Today — LifeLedger" },
      {
        property: "og:description",
        content: "Record today's personal commitments in LifeLedger.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

/**
 * Format a date string for display.
 * Input: local date "YYYY-MM-DD"
 * Output: "Friday, September 25"
 */
function formatDateLabel(dateStr: string): string {
  // Append T12:00:00 to avoid timezone-induced date shift
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function TodayPage() {
  const today = todayLocalDate();
  const {
    data: entries,
    isLoading,
    isError,
    error,
    refetch,
  } = useLedgerToday(today);
  const recordEntry = useRecordEntry(today);

  const active = entries ?? [];
  const recorded = active.filter((pair) => pair.entry !== null).length;
  const completed = active.filter(
    (pair) => pair.entry !== null && pair.entry.completed,
  ).length;

  const handleEntry = (taskId: number, completed: boolean) => {
    recordEntry.mutate({ task_id: taskId, date: today, completed });
  };

  // Derive day number (e.g. day 269 of year)
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);

  if (isLoading) {
    return (
      <AppShell headerTitle="Today">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="space-y-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <PageIntro
                eyebrow="LOADING…"
                title="Good morning."
                description="A quiet check-in with the promises you made to yourself."
              />
            </div>
          </section>
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading commitments…
          </div>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Failed to load today's commitments.";
    return (
      <AppShell headerTitle="Today">
        <div className="mx-auto max-w-6xl">
          <div className="border border-status-no/40 bg-status-no/10 p-6">
            <p className="text-sm font-semibold text-status-no">
              Could not load today's entries
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      headerTitle="Today"
      headerActions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous day"
            disabled
          >
            <ChevronLeft />
          </Button>
          <span className="hidden px-2 text-xs text-muted-foreground sm:block">
            {formatDateLabel(today)}
          </span>
          <Button variant="ghost" size="icon" aria-label="Next day" disabled>
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <PageIntro
              eyebrow={`${now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()} · DAY ${dayOfYear}`}
              title="Good morning."
              description="A quiet check-in with the promises you made to yourself."
            />
            <div className="flex w-full items-stretch border border-border bg-card lg:w-auto">
              <div className="min-w-28 border-r border-border p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  RECORDED
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {recorded}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / {active.length}
                  </span>
                </p>
              </div>
              <div className="min-w-28 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  COMPLETED
                </p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {completed}
                </p>
              </div>
            </div>
          </div>
          <div
            className="h-1 overflow-hidden bg-secondary"
            aria-label={`${recorded} of ${active.length} recorded`}
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${active.length ? (recorded / active.length) * 100 : 0}%`,
              }}
            />
          </div>
        </section>

        {active.length === 0 ? (
          <div className="border border-border bg-card p-12 text-center">
            <p className="text-sm font-semibold">No active commitments</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add commitments in the Commitments section to start tracking.
            </p>
          </div>
        ) : (
          <section
            aria-labelledby="commitments-heading"
            className="animate-fade-up [animation-delay:100ms]"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 id="commitments-heading" className="text-sm font-semibold">
                  Today's commitments
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose yes or no for each commitment.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {active.length - recorded} remaining
              </span>
            </div>
            <div className="border border-border bg-card">
              {active.map((pair, index) => {
                const { task, entry } = pair;
                const status: "yes" | "no" | "unrecorded" =
                  entry === null
                    ? "unrecorded"
                    : entry.completed
                      ? "yes"
                      : "no";
                const Icon = iconMap[getTaskIcon(task.name)];
                const isPending =
                  recordEntry.isPending &&
                  recordEntry.variables?.task_id === task.id;

                return (
                  <article
                    key={task.id}
                    className={`group grid gap-4 p-4 transition-colors hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-5 ${index < active.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center border ${status === "yes" ? "border-status-yes/40 bg-status-yes/10 text-status-yes" : status === "no" ? "border-status-no/40 bg-status-no/10 text-status-no" : "border-border bg-secondary text-muted-foreground"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold">{task.name}</h4>
                          <span
                            className={`text-[10px] font-semibold uppercase ${status === "yes" ? "text-status-yes" : status === "no" ? "text-status-no" : "text-muted-foreground"}`}
                          >
                            {status === "unrecorded" ? "Not recorded" : status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {task.cutoff_message}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <Button
                        variant="outline"
                        onClick={() => handleEntry(task.id, false)}
                        aria-pressed={status === "no"}
                        disabled={isPending}
                        className={`min-w-24 ${status === "no" ? "border-status-no bg-status-no/10 text-status-no hover:bg-status-no/15 hover:text-status-no" : "text-muted-foreground"}`}
                      >
                        <X /> No
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleEntry(task.id, true)}
                        aria-pressed={status === "yes"}
                        disabled={isPending}
                        className={`min-w-24 ${status === "yes" ? "border-status-yes bg-status-yes/10 text-status-yes hover:bg-status-yes/15 hover:text-status-yes" : "text-muted-foreground"}`}
                      >
                        <Check /> Yes
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {recorded === active.length && active.length > 0 && (
          <div className="animate-fade-up border border-primary/40 bg-primary/10 p-5 text-center">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-primary">
              Today is fully recorded.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your ledger is complete for the day.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
