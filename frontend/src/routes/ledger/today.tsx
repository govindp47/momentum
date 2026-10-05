import { createFileRoute } from "@tanstack/react-router";
import { Check, Sparkles, X } from "lucide-react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { iconMap, getTaskIcon } from "@/lib/lifeledger";
import {
  useLedgerToday,
  useRecordEntry,
  todayLocalDate,
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
      <AppShell subApp="ledger">
        <div className="mx-auto w-full max-w-5xl space-y-7 md:space-y-8">
          <section className="animate-fade-up space-y-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <PageIntro
                eyebrow="LOADING…"
                title="How did today go?"
                description="A quiet check-in with the promises you made to yourself."
              />
            </div>
          </section>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-7 text-center text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
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
      <AppShell subApp="ledger">
        <div className="mx-auto w-full max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-status-no/30 bg-status-no/5 p-5 shadow-sm">
            <p className="text-sm font-semibold text-status-no">
              Could not load today's entries
            </p>

            <p className="mt-1 text-xs text-muted-foreground">{message}</p>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
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
    <AppShell subApp="ledger">
      <div className="mx-auto w-full max-w-5xl space-y-7 md:space-y-8">
        <section className="animate-fade-up space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <PageIntro
                eyebrow={`${now
                  .toLocaleDateString("en-US", { weekday: "long" })
                  .toUpperCase()} · DAY ${dayOfYear}`}
                title="How did today go?"
                description="A quiet check-in with the promises you made to yourself."
              />
            </div>

            <div className="flex w-full shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm lg:w-auto">
              <div className="min-w-28 border-r border-border/70 px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Recorded
                </p>

                <p className="mt-1 text-xl font-bold tracking-tight">
                  {recorded}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">
                    / {active.length}
                  </span>
                </p>
              </div>

              <div className="min-w-28 px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Completed
                </p>

                <p className="mt-1 text-xl font-bold tracking-tight text-primary">
                  {completed}
                </p>
              </div>
            </div>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full border border-border/50 bg-secondary/70"
            aria-label={`${recorded} of ${active.length} recorded`}
          >
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_10px_color-mix(in_oklch,var(--primary)_35%,transparent)] transition-all duration-500"
              style={{
                width: `${active.length ? (recorded / active.length) * 100 : 0}%`,
              }}
            />
          </div>
        </section>

        {active.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card/80 p-10 text-center shadow-sm backdrop-blur-sm">
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
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h3
                  id="commitments-heading"
                  className="text-sm font-bold tracking-tight"
                >
                  Today's commitments
                </h3>

                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  Choose yes or no for each commitment.
                </p>
              </div>

              <span className="rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground shadow-sm">
                {active.length - recorded} remaining
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
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
                    className={`group relative grid gap-4 p-4 transition-all duration-200 hover:bg-accent/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-5 ${
                      index < active.length - 1
                        ? "border-b border-border/70"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div
                        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-all duration-200 ${
                          status === "yes"
                            ? "border-status-yes/40 bg-status-yes/10 text-status-yes"
                            : status === "no"
                              ? "border-status-no/40 bg-status-no/10 text-status-no"
                              : "border-border/70 bg-secondary/70 text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[13px] font-bold tracking-tight">
                            {task.name}
                          </h4>

                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${
                              status === "yes"
                                ? "border-status-yes/25 bg-status-yes/10 text-status-yes"
                                : status === "no"
                                  ? "border-status-no/25 bg-status-no/10 text-status-no"
                                  : "border-border/60 bg-secondary/60 text-muted-foreground"
                            }`}
                          >
                            {status === "unrecorded" ? "Not recorded" : status}
                          </span>
                        </div>

                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
                        className={`min-w-20 rounded-lg text-xs transition-all duration-200 ${
                          status === "no"
                            ? "border-status-no bg-status-no/10 text-status-no shadow-sm hover:bg-status-no/15 hover:text-status-no"
                            : "border-border/70 bg-background/40 text-muted-foreground hover:border-status-no/40 hover:bg-status-no/5 hover:text-status-no"
                        }`}
                      >
                        <X className="h-3.5 w-3.5" /> No
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleEntry(task.id, true)}
                        aria-pressed={status === "yes"}
                        disabled={isPending}
                        className={`min-w-20 rounded-lg text-xs transition-all duration-200 ${
                          status === "yes"
                            ? "border-status-yes bg-status-yes/10 text-status-yes shadow-sm hover:bg-status-yes/15 hover:text-status-yes"
                            : "border-border/70 bg-background/40 text-muted-foreground hover:border-status-yes/40 hover:bg-status-yes/5 hover:text-status-yes"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" /> Yes
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {recorded === active.length && active.length > 0 && (
          <div className="animate-fade-up overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-5 text-center shadow-sm">
            <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>

            <p className="text-sm font-bold text-primary">
              Today is fully recorded.
            </p>

            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              Your ledger is complete for the day.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
