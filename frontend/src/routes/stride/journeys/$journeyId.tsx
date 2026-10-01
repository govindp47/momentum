import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Check,
  Edit3,
  Flame,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressDialog } from "@/components/stride/progress-dialog";
import { resolveJourneyIcon } from "@/components/stride/icons";
import { formatValue } from "@/components/stride/journey-card";
import {
  useJourney,
  useJourneyMilestones,
  useProgressHistory,
  useJourneyStats,
  usePauseJourney,
  useResumeJourney,
  useCompleteJourney,
  useArchiveJourney,
  useUpdateJourney,
  useCompleteMilestone,
  useReopenMilestone,
  useDeleteProgressEvent,
} from "@/hooks/queries/use-stride";
import { formatPercentage } from "@/lib/utils";

export const Route = createFileRoute("/stride/journeys/$journeyId")({
  head: () => ({
    meta: [
      { title: "Journey detail — Stride" },
      {
        name: "description",
        content:
          "Review progress, milestones, pace, and activity for a Stride journey.",
      },
    ],
  }),
  component: JourneyDetailPage,
});

function JourneyDetailPage() {
  const { journeyId: journeyIdStr } = Route.useParams();
  const journeyId = parseInt(journeyIdStr, 10);
  const navigate = useNavigate();

  const {
    data: journey,
    isLoading: journeyLoading,
    error: journeyError,
  } = useJourney(journeyId);
  const { data: milestones, isLoading: milestonesLoading } =
    useJourneyMilestones(journeyId);
  const { data: progressHistory } = useProgressHistory(journeyId, { limit: 8 });
  const { data: stats } = useJourneyStats(journeyId);

  const pauseJourney = usePauseJourney();
  const resumeJourney = useResumeJourney();
  const completeJourney = useCompleteJourney();
  const archiveJourney = useArchiveJourney();
  const updateJourney = useUpdateJourney();
  const completeMilestone = useCompleteMilestone();
  const reopenMilestone = useReopenMilestone();
  const deleteProgressEvent = useDeleteProgressEvent();

  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  if (!Number.isFinite(journeyId) || journeyId <= 0) {
    return (
      <AppShell subApp="stride">
        <div className="mx-auto w-full max-w-5xl animate-fade-up pb-12">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-10 text-center shadow-sm backdrop-blur-sm">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-status-no/25 bg-status-no/10">
              <Target className="h-4 w-4 text-status-no" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight">
              Invalid journey
            </h1>
            <Button asChild className="mt-5 rounded-lg">
              <Link to="/stride/journeys">Back to journeys</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (journeyLoading) {
    return (
      <AppShell subApp="stride">
        <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-5 pb-12">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <div className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-8 w-64 rounded-lg" />
                <Skeleton className="h-4 w-full max-w-xl rounded" />
              </div>
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (journeyError || !journey) {
    return (
      <AppShell subApp="stride">
        <div className="mx-auto w-full max-w-5xl animate-fade-up pb-12">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-10 text-center shadow-sm backdrop-blur-sm">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10">
              <Target className="h-4 w-4 text-sky-500" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight">
              Journey not found
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              This journey may have been removed or is no longer available.
            </p>
            <Button asChild className="mt-5 rounded-lg">
              <Link to="/stride/journeys">Back to journeys</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const Icon = resolveJourneyIcon(journey.tracking_method);
  const percentage =
    stats?.progress.percentage ?? (journey.is_completed ? 100 : 0);
  const currentValue = stats?.progress.current_value ?? 0;

  const openEdit = () => {
    setEditName(journey.name);
    setEditDescription(journey.description);
    setEditOpen(true);
  };

  const saveEdit = () => {
    updateJourney.mutate(
      {
        journeyId: journey.id,
        payload: {
          name: editName.trim() || null,
          description: editDescription.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast.success("Journey updated");
        },
        onError: () => toast.error("Failed to update journey"),
      },
    );
  };

  const handleToggleMilestone = (milestoneId: number, isCompleted: boolean) => {
    if (isCompleted) {
      reopenMilestone.mutate(
        { journeyId: journey.id, milestoneId },
        { onError: () => toast.error("Failed to reopen milestone") },
      );
    } else {
      completeMilestone.mutate(
        { journeyId: journey.id, milestoneId, payload: {} },
        {
          onSuccess: () => toast.success("Milestone completed!"),
          onError: () => toast.error("Failed to complete milestone"),
        },
      );
    }
  };

  const formattedTargetDate = journey.target_date
    ? new Date(journey.target_date + "T00:00:00").toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        },
      )
    : null;

  const formattedStartDate = journey.start_date
    ? new Date(journey.start_date + "T00:00:00").toLocaleDateString(
        undefined,
        {
          month: "long",
          day: "numeric",
          year: "numeric",
        },
      )
    : "—";

  return (
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        <Link
          to="/stride/journeys"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All journeys
        </Link>

        <header className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                <Icon className="h-5 w-5 text-violet-500" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {journey.status} journey
                  </p>
                  {journey.is_completed && (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-500">
                      Completed
                    </span>
                  )}
                  {journey.is_paused && (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-500">
                      Paused
                    </span>
                  )}
                </div>

                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight md:text-3xl">
                  {journey.name}
                </h1>

                {journey.description && (
                  <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    {journey.description}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Journey options"
                  className="h-8 w-8 shrink-0 rounded-lg"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="rounded-xl border-border/70 bg-card/95 shadow-lg backdrop-blur-sm"
              >
                <DropdownMenuItem onSelect={openEdit}>
                  <Edit3 className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {journey.is_active && (
                  <DropdownMenuItem
                    onSelect={() =>
                      pauseJourney.mutate(journey.id, {
                        onSuccess: () => toast.success("Journey paused"),
                        onError: () => toast.error("Failed to pause"),
                      })
                    }
                  >
                    <Pause className="mr-2 h-3.5 w-3.5" />
                    Pause
                  </DropdownMenuItem>
                )}

                {journey.is_paused && (
                  <DropdownMenuItem
                    onSelect={() =>
                      resumeJourney.mutate(journey.id, {
                        onSuccess: () => toast.success("Journey resumed"),
                        onError: () => toast.error("Failed to resume"),
                      })
                    }
                  >
                    <Play className="mr-2 h-3.5 w-3.5" />
                    Resume
                  </DropdownMenuItem>
                )}

                {(journey.is_active || journey.is_paused) && (
                  <DropdownMenuItem
                    onSelect={() =>
                      completeJourney.mutate(journey.id, {
                        onSuccess: () => toast.success("Journey completed!"),
                        onError: () => toast.error("Failed to complete"),
                      })
                    }
                  >
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Mark complete
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() =>
                    archiveJourney.mutate(journey.id, {
                      onSuccess: () => {
                        toast.success("Journey archived");
                        void navigate({ to: "/stride/journeys" });
                      },
                      onError: () => toast.error("Failed to archive"),
                    })
                  }
                >
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.8fr)]">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="grid gap-7 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
                <div
                  className="absolute inset-0 rounded-full p-[9px]"
                  style={{
                    background: `conic-gradient(
                      var(--primary) ${percentage}%,
                      color-mix(in oklch, var(--border) 70%, transparent) ${percentage}% 100%
                    )`,
                  }}
                >
                  <div className="h-full w-full rounded-full bg-card" />
                </div>

                <div className="relative z-10 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl font-bold tracking-tight sm:text-3xl">
                    {formatPercentage(percentage)}
                  </div>
                  <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Complete
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-2xl font-bold tracking-tight md:text-3xl">
                  {formatValue(currentValue)}{" "}
                  <span className="text-sm font-normal text-muted-foreground md:text-base">
                    / {formatValue(journey.target_value)}
                    {journey.unit ? ` ${journey.unit}` : ""}
                  </span>
                </div>

                <Progress
                  value={percentage}
                  className="mt-4 h-1.5 bg-secondary"
                />

                <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                  {formatValue(
                    Math.max(0, journey.target_value - currentValue),
                  )}
                  {journey.unit ? ` ${journey.unit}` : ""} remaining
                  {formattedTargetDate ? ` · target ${formattedTargetDate}` : ""}
                </p>

                {journey.accepts_progress && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      onClick={() => setLogOpen(true)}
                      className="h-8 rounded-lg text-[10px] shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Log progress
                    </Button>

                    {journey.is_active && (
                      <Button
                        variant="outline"
                        className="h-8 rounded-lg text-[10px]"
                        onClick={() =>
                          pauseJourney.mutate(journey.id, {
                            onSuccess: () => toast.success("Journey paused"),
                            onError: () => toast.error("Failed to pause"),
                          })
                        }
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}

                    {journey.is_paused && (
                      <Button
                        variant="outline"
                        className="h-8 rounded-lg text-[10px]"
                        onClick={() =>
                          resumeJourney.mutate(journey.id, {
                            onSuccess: () => toast.success("Journey resumed"),
                            onError: () => toast.error("Failed to resume"),
                          })
                        }
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <DetailStatCard
              icon={Flame}
              label="Current streak"
              value={`${stats?.streak.current_streak ?? "–"} days`}
              note={`Best: ${stats?.streak.longest_streak ?? "–"} days · ${stats?.streak.active_days ?? "–"} active days`}
              iconClass="text-orange-500"
              iconBgClass="bg-orange-500/10"
              borderClass="border-orange-500/20"
            />

            <DetailStatCard
              icon={CalendarDays}
              label="Time in motion"
              value={`${stats?.pace.days_elapsed ?? "–"} days`}
              note={`Started ${formattedStartDate}`}
              iconClass="text-sky-500"
              iconBgClass="bg-sky-500/10"
              borderClass="border-sky-500/20"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Up next
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
                  Milestone path
                </h2>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                <Target className="h-4 w-4 text-violet-500" />
              </div>
            </div>

            {milestonesLoading ? (
              <div className="mt-7 space-y-4">
                {[1, 2, 3].map((k) => (
                  <Skeleton key={k} className="h-7 w-full rounded-lg" />
                ))}
              </div>
            ) : milestones && milestones.length > 0 ? (
              <div className="mt-7 space-y-0">
                {milestones.map((m, i) => (
                  <div key={m.id} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleMilestone(m.id, m.is_completed)
                        }
                        aria-label={
                          m.is_completed
                            ? `Reopen milestone: ${m.name}`
                            : `Complete milestone: ${m.name}`
                        }
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          m.is_completed
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                            : "border-border/70 bg-secondary/70 text-muted-foreground hover:border-violet-500/40 hover:bg-violet-500/5"
                        }`}
                      >
                        {m.is_completed ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span className="text-[10px] font-bold">{i + 1}</span>
                        )}
                      </button>

                      {i < milestones.length - 1 && (
                        <div
                          className={`h-10 w-px ${
                            m.is_completed
                              ? "bg-emerald-500/30"
                              : "bg-border/70"
                          }`}
                        />
                      )}
                    </div>

                    <div className="min-w-0 pt-1">
                      <div
                        className={`text-xs ${
                          m.is_completed
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground"
                        }`}
                      >
                        {m.name}
                      </div>

                      {m.description && (
                        <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                          {m.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-lg border border-border/60 bg-background/20 p-4 text-xs text-muted-foreground">
                No milestones added yet.
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Timeline
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
                  Recent activity
                </h2>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="mt-6 space-y-0">
              {progressHistory && progressHistory.length > 0 ? (
                progressHistory.slice(0, 6).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 border-b border-border/50 py-3.5 first:pt-0 last:border-0 last:pb-0"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">
                        +{formatValue(e.value ?? 0)}
                        {journey.unit ? ` ${journey.unit}` : ""}
                      </div>

                      <div className="mt-1 truncate text-[10px] text-muted-foreground">
                        {e.note ?? "Progress update"}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <time className="text-[9px] text-muted-foreground">
                        {new Date(e.occurred_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive"
                        aria-label="Delete event"
                        onClick={() =>
                          deleteProgressEvent.mutate(
                            { eventId: e.id, journeyId: journey.id },
                            {
                              onSuccess: () => toast.success("Entry deleted"),
                              onError: () =>
                                toast.error("Failed to delete entry"),
                            },
                          )
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-border/60 bg-background/20 p-4 text-xs text-muted-foreground">
                  No progress recorded yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-[10px] text-muted-foreground">
          <Target className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span>
            Keep the journey visible, make the next step small, and keep
            moving.
          </span>
        </div>
      </div>

      <ProgressDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        journeyId={journey.id}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-xl border-border/70 bg-card shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Edit journey</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Refine the name and purpose of this journey.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-10 rounded-lg border-border/70 bg-background/50 text-xs"
              placeholder="Journey name"
            />

            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="min-h-28 rounded-lg border-border/70 bg-background/50 text-xs"
              placeholder="Description"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="h-8 rounded-lg text-[10px]"
              >
                Cancel
              </Button>

              <Button
                onClick={saveEdit}
                disabled={updateJourney.isPending}
                className="h-8 rounded-lg text-[10px]"
              >
                {updateJourney.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function DetailStatCard({
  icon: Icon,
  label,
  value,
  note,
  iconClass,
  iconBgClass,
  borderClass,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  note: string;
  iconClass: string;
  iconBgClass: string;
  borderClass: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border ${borderClass} bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{value}</h2>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
        >
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
        {note}
      </p>
    </div>
  );
}