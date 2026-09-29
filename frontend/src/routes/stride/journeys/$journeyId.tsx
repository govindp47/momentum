import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  Check,
  Edit3,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
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
      <AppShell headerTitle="Journey">
        <div className="glass rounded-xl p-10 text-center">
          <h1 className="text-2xl font-bold">Invalid journey</h1>
          <Button asChild className="mt-5">
            <Link to="/stride/journeys">Back to journeys</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (journeyLoading) {
    return (
      <AppShell headerTitle="Journey">
        <div className="space-y-6 pb-12">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (journeyError || !journey) {
    return (
      <AppShell headerTitle="Journey">
        <div className="glass rounded-xl p-10 text-center">
          <h1 className="text-2xl font-bold">Journey not found</h1>
          <Button asChild className="mt-5">
            <Link to="/stride/journeys">Back to journeys</Link>
          </Button>
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

  return (
    <AppShell headerTitle={journey.name}>
      <div className="animate-fade-up space-y-10 pb-12">
        {/* Back link */}
        <Link
          to="/stride/journeys"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          All journeys
        </Link>

        {/* Journey header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon size={23} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground capitalize">
                {journey.status} journey
              </p>
              <h1 className="mt-1 truncate text-3xl font-bold tracking-tight sm:text-4xl">
                {journey.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {journey.description}
              </p>
            </div>
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Journey options">
                <MoreHorizontal size={17} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={openEdit}>
                <Edit3 className="mr-2 h-4 w-4" />
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
                  <Pause className="mr-2 h-4 w-4" />
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
                  <Play className="mr-2 h-4 w-4" />
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
                  <Check className="mr-2 h-4 w-4" />
                  Mark complete
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
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
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Progress overview + pace */}
        <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
          {/* Progress card */}
          <div className="glass-strong rounded-xl p-6 sm:p-7">
            <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
              {/* Circle progress */}
              <div className="relative flex size-36 items-center justify-center rounded-full border-[10px] border-border">
                <div className="text-center">
                  <div className="text-4xl font-bold">{percentage}%</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    COMPLETE
                  </div>
                </div>
              </div>

              <div>
                <div className="text-3xl font-bold">
                  {formatValue(currentValue)}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    / {formatValue(journey.target_value)}
                    {journey.unit ? ` ${journey.unit}` : ""}
                  </span>
                </div>
                <Progress value={percentage} className="mt-5" />
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatValue(
                    Math.max(0, journey.target_value - currentValue),
                  )}
                  {journey.unit ? ` ${journey.unit}` : ""} remaining
                  {journey.target_date
                    ? ` · target ${new Date(journey.target_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                </p>

                {/* Action buttons */}
                {journey.accepts_progress && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button onClick={() => setLogOpen(true)}>
                      <Plus size={16} />
                      Log progress
                    </Button>
                    {journey.is_active && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          pauseJourney.mutate(journey.id, {
                            onSuccess: () => toast.success("Journey paused"),
                          })
                        }
                      >
                        <Pause size={16} />
                        Pause
                      </Button>
                    )}
                    {journey.is_paused && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          resumeJourney.mutate(journey.id, {
                            onSuccess: () => toast.success("Journey resumed"),
                          })
                        }
                      >
                        <Play size={16} />
                        Resume
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Side stats */}
          <div className="space-y-4">
            <div className="glass rounded-xl p-6">
              <TrendingUp className="text-primary" size={20} />
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Streak
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {stats?.streak.current_streak ?? "–"} days
              </h2>
              <p className="mt-3 text-xs text-muted-foreground">
                Best: {stats?.streak.longest_streak ?? "–"} days ·{" "}
                {stats?.streak.active_days ?? "–"} active days
              </p>
            </div>

            <div className="glass rounded-xl p-6">
              <CalendarDays className="text-primary" size={20} />
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Time in motion
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {stats?.pace.days_elapsed ?? "–"} days
              </h2>
              <p className="mt-3 text-xs text-muted-foreground">
                Started{" "}
                {journey.start_date
                  ? new Date(
                      journey.start_date + "T00:00:00",
                    ).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Milestones + Activity */}
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Milestones */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-2xl font-bold">Milestone path</h2>
            {milestonesLoading ? (
              <div className="mt-6 space-y-4">
                {[1, 2, 3].map((k) => (
                  <Skeleton key={k} className="h-7 w-full" />
                ))}
              </div>
            ) : milestones && milestones.length > 0 ? (
              <div className="mt-6 space-y-0">
                {milestones.map((m, i) => (
                  <div key={m.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() =>
                          handleToggleMilestone(m.id, m.is_completed)
                        }
                        aria-label={
                          m.is_completed
                            ? `Reopen milestone: ${m.name}`
                            : `Complete milestone: ${m.name}`
                        }
                        className={`flex size-7 items-center justify-center rounded-full border transition-colors ${
                          m.is_completed
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {m.is_completed ? (
                          <Check size={13} />
                        ) : (
                          <span className="text-[10px]">{i + 1}</span>
                        )}
                      </button>
                      {i < milestones.length - 1 && (
                        <div
                          className={`h-10 w-px ${m.is_completed ? "bg-primary/35" : "bg-border"}`}
                        />
                      )}
                    </div>
                    <div className="pt-1">
                      <div className="text-sm">{m.name}</div>
                      {m.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {m.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                No milestones added yet.
              </p>
            )}
          </div>

          {/* Recent activity */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Recent activity</h2>
              <MoreHorizontal className="text-muted-foreground" size={18} />
            </div>
            <div className="mt-5 space-y-4">
              {progressHistory && progressHistory.length > 0 ? (
                progressHistory.slice(0, 6).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between border-b border-border pb-4 last:border-0"
                  >
                    <div>
                      <div className="text-sm">
                        +{formatValue(e.value ?? 0)}
                        {journey.unit ? ` ${journey.unit}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {e.note ?? "Progress update"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <time className="text-[10px] text-muted-foreground">
                        {new Date(e.occurred_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
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
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No progress recorded yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Progress dialog */}
      <ProgressDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        journeyId={journey.id}
      />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit journey</DialogTitle>
            <DialogDescription>
              Refine the name and purpose of this journey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="Journey name"
            />
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="min-h-28 rounded-xl"
              placeholder="Description"
            />
            <Button onClick={saveEdit} disabled={updateJourney.isPending}>
              {updateJourney.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
