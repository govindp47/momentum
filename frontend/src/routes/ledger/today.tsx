import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Sparkles, X } from "lucide-react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getCommitmentCategoryMetadata } from "@/lib/commitment-categories";
import {
  useLedgerToday,
  useRecordEntries,
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
  const [draftSelections, setDraftSelections] = useState<
    Record<number, boolean>
  >({});
  const {
    data: entries,
    isLoading,
    isError,
    error,
    refetch,
  } = useLedgerToday(today);
  const recordEntries = useRecordEntries(today);

  const active = entries ?? [];
  const getSelection = (taskId: number, persisted: boolean | undefined) =>
    draftSelections[taskId] ?? persisted;
  const selected = active.filter(
    (pair) => getSelection(pair.task.id, pair.entry?.completed) !== undefined,
  ).length;
  const completed = active.filter(
    (pair) => getSelection(pair.task.id, pair.entry?.completed) === true,
  ).length;
  const allSelected = active.length > 0 && selected === active.length;
  const hasChanges = active.some(
    (pair) => draftSelections[pair.task.id] !== undefined,
  );
  const isFullyRecorded =
    active.length > 0 &&
    active.every((pair) => pair.entry !== null) &&
    !hasChanges;

  const handleSelection = (
    taskId: number,
    persisted: boolean | undefined,
    completed: boolean,
  ) => {
    recordEntries.reset();
    setDraftSelections((current) => {
      const next = { ...current };

      if (persisted === completed) {
        delete next[taskId];
      } else {
        next[taskId] = completed;
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allSelected) return;

    const decisions: Array<{ task_id: number; completed: boolean }> = [];

    for (const pair of active) {
      const selection = getSelection(pair.task.id, pair.entry?.completed);

      if (selection === undefined) return;

      decisions.push({ task_id: pair.task.id, completed: selection });
    }

    try {
      await recordEntries.mutateAsync({ date: today, entries: decisions });
      setDraftSelections({});
    } catch {
      // The mutation exposes the error below and keeps all draft choices for retry.
    }
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

            <div className="flex w-full shrink-0 overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm lg:w-auto">
              <div className="min-w-20 border-r border-border/70 px-4 py-1.5 text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Selected
                </p>

                <p className="text-xl font-bold tracking-tight">
                  {selected}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">
                    / {active.length}
                  </span>
                </p>
              </div>

              <div className="min-w-20 px-4 py-1.5 text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Completed
                </p>

                <p className="text-xl font-bold tracking-tight text-primary">
                  {completed}
                </p>
              </div>
            </div>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full border border-border/50 bg-secondary/70"
            aria-label={`${selected} of ${active.length} selected`}
          >
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_10px_color-mix(in_oklch,var(--primary)_35%,transparent)] transition-all duration-500"
              style={{
                width: `${active.length ? (selected / active.length) * 100 : 0}%`,
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
                  Choose yes or no for each commitment, then submit them
                  together.
                </p>
              </div>

              <span className="rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[12px] font-semibold text-muted-foreground shadow-sm">
                {active.length - selected} remaining
              </span>
            </div>

            <div className="overflow-hidden rounded-4xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
              {active.map((pair, index) => {
                const { task, entry } = pair;

                const selection = getSelection(task.id, entry?.completed);
                const status: "yes" | "no" | "unselected" =
                  selection === undefined
                    ? "unselected"
                    : selection
                      ? "yes"
                      : "no";

                const category = getCommitmentCategoryMetadata(task.category);
                const Icon = category.icon;

                return (
                  <article
                    key={task.id}
                    className={`group relative grid gap-4 p-3 transition-all duration-200 hover:bg-accent/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:p-4 ${
                      index < active.length - 1
                        ? "border-b border-border/70"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div
                        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl border shadow-sm transition-all duration-200 ${category.backgroundClass} ${category.borderClass}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${category.iconClass}`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[13px] font-bold tracking-tight">
                            {task.name}
                          </h4>

                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${category.backgroundClass} ${category.borderClass} ${category.badgeTextClass}`}
                          >
                            {category.label}
                          </span>

                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${
                              status === "yes"
                                ? "border-status-yes/25 bg-status-yes/10 text-status-yes"
                                : status === "no"
                                  ? "border-status-no/25 bg-status-no/10 text-status-no"
                                  : "border-border/60 bg-secondary/60 text-muted-foreground"
                            }`}
                          >
                            {status === "unselected" ? "Not selected" : status}
                          </span>
                        </div>

                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {task.cutoff_message}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:flex">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleSelection(task.id, entry?.completed, false)
                        }
                        aria-pressed={status === "no"}
                        disabled={recordEntries.isPending}
                        className={`min-w-16 rounded-4xl text-xs transition-all duration-200 ${
                          status === "no"
                            ? "border-status-no bg-status-no/10 text-status-no shadow-sm hover:bg-status-no/15 hover:text-status-no"
                            : "border-border/70 bg-background/40 text-muted-foreground hover:border-status-no/40 hover:bg-status-no/5 hover:text-status-no"
                        }`}
                      >
                        <X className="h-3.5 w-3.5" /> No
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleSelection(task.id, entry?.completed, true)
                        }
                        aria-pressed={status === "yes"}
                        disabled={recordEntries.isPending}
                        className={`min-w-16 rounded-4xl text-xs transition-all duration-200 ${
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

            {allSelected && !isFullyRecorded && (
              <div className="mt-8 text-center">
                <p className="text-xs text-muted-foreground">
                  All commitments are selected. Submit once to record the
                  complete day.
                </p>

                <Button
                  type="button"
                  className="mt-3 rounded-4xl"
                  disabled={recordEntries.isPending}
                  onClick={() => void handleSubmit()}
                >
                  <Check className="h-4 w-4" />
                  {recordEntries.isPending
                    ? "Submitting…"
                    : "Submit today's entries"}
                </Button>

                {recordEntries.isError && (
                  <p
                    className="mt-3 text-xs font-medium text-status-no"
                    role="alert"
                  >
                    {recordEntries.error.message}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {isFullyRecorded && (
          <div className="animate-fade-up overflow-hidden p-2 text-center">
            <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
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
