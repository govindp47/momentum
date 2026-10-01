import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Pencil,
  Plus,
} from "lucide-react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  iconMap,
  getTaskIcon,
  type CommitmentIcon,
} from "@/lib/lifeledger";
import {
  useLedgerAllTasks,
  useCreateTask,
  useUpdateTask,
  useArchiveTask,
  useRestoreTask,
} from "@/hooks/queries/use-ledger";
import type { TaskResponse } from "@/types/ledger";
import { ApiError } from "@/api/client";

export const Route = createFileRoute("/ledger/commitments")({
  head: () => ({
    meta: [
      { title: "Commitments — LifeLedger" },
      {
        name: "description",
        content: "Create, edit, archive, and restore LifeLedger commitments.",
      },
      { property: "og:title", content: "Commitments — LifeLedger" },
      {
        property: "og:description",
        content: "Create, edit, archive, and restore LifeLedger commitments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommitmentsPage,
});

const iconChoices: { value: CommitmentIcon; label: string }[] = [
  { value: "exercise", label: "Exercise" },
  { value: "learning", label: "Learning" },
  { value: "reading", label: "Reading" },
  { value: "work", label: "Work" },
  { value: "social", label: "Social" },
  { value: "project", label: "Project" },
];

const iconAccent: Record<
  CommitmentIcon,
  { icon: string; background: string; border: string }
> = {
  exercise: {
    icon: "text-orange-500",
    background: "bg-orange-500/10",
    border: "border-orange-500/25",
  },
  learning: {
    icon: "text-blue-500",
    background: "bg-blue-500/10",
    border: "border-blue-500/25",
  },
  reading: {
    icon: "text-violet-500",
    background: "bg-violet-500/10",
    border: "border-violet-500/25",
  },
  work: {
    icon: "text-amber-500",
    background: "bg-amber-500/10",
    border: "border-amber-500/25",
  },
  social: {
    icon: "text-pink-500",
    background: "bg-pink-500/10",
    border: "border-pink-500/25",
  },
  project: {
    icon: "text-emerald-500",
    background: "bg-emerald-500/10",
    border: "border-emerald-500/25",
  },
};

function CommitmentsPage() {
  const {
    data: allTasks,
    isLoading,
    isError,
    error,
    refetch,
  } = useLedgerAllTasks();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const restoreTask = useRestoreTask();

  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeTasks = (allTasks ?? []).filter((task) => task.is_active);
  const archivedTasks = (allTasks ?? []).filter((task) => !task.is_active);
  const visible = showArchived ? archivedTasks : activeTasks;

  const openEditor = (task: TaskResponse | null) => {
    setEditing(task);
    setActionError(null);
    setOpen(true);
  };

  const handleArchive = (task: TaskResponse) => {
    setActionError(null);

    archiveTask.mutate(task.name, {
      onError: (err) => {
        setActionError(
          err instanceof ApiError
            ? err.message
            : "Failed to archive commitment.",
        );
      },
    });
  };

  const handleRestore = (task: TaskResponse) => {
    setActionError(null);

    restoreTask.mutate(task.id, {
      onError: (err) => {
        setActionError(
          err instanceof ApiError
            ? err.message
            : "Failed to restore commitment.",
        );
      },
    });
  };

  const handleSave = (value: {
    name: string;
    cutoff_message: string;
  }) => {
    setActionError(null);

    if (editing) {
      updateTask.mutate(
        { taskName: editing.name, payload: value },
        {
          onSuccess: () => setOpen(false),
          onError: (err) => {
            setActionError(
              err instanceof ApiError
                ? err.message
                : "Failed to update commitment.",
            );
          },
        },
      );
    } else {
      createTask.mutate(value, {
        onSuccess: () => setOpen(false),
        onError: (err) => {
          setActionError(
            err instanceof ApiError
              ? err.message
              : "Failed to create commitment.",
          );
        },
      });
    }
  };

  if (isLoading) {
    return (
      <AppShell subApp="ledger">
        <div className="mx-auto w-full max-w-5xl space-y-7 md:space-y-8">
          <PageIntro
            eyebrow="LOADING…"
            title="Keep the promises clear."
            description="Each commitment begins on its creation date."
          />

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
        : "Failed to load commitments.";

    return (
      <AppShell subApp="ledger">
        <div className="mx-auto w-full max-w-5xl">
          <div className="overflow-hidden rounded-xl border border-status-no/30 bg-status-no/5 p-5 shadow-sm">
            <p className="text-sm font-semibold text-status-no">
              Could not load commitments
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
        {/* ── Page introduction ───────────────────────────────────────── */}
        <section className="animate-fade-up">
          <PageIntro
            eyebrow={`${activeTasks.length} ACTIVE`}
            title="Keep the promises clear."
            description="Each commitment begins on its creation date. Archiving removes it from future daily check-ins without changing its history."
            action={
              <Button
                onClick={() => openEditor(null)}
                className="rounded-lg shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New commitment
              </Button>
            }
          />
        </section>

        {/* ── Action error ────────────────────────────────────────────── */}
        {actionError && (
          <div className="animate-fade-up overflow-hidden rounded-xl border border-status-no/30 bg-status-no/5 p-4 shadow-sm">
            <p className="text-xs font-medium text-status-no">{actionError}</p>
          </div>
        )}

        {/* ── Commitment status tabs ──────────────────────────────────── */}
        <div
          className="flex overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm"
          role="tablist"
          aria-label="Commitment status"
        >
          <button
            role="tab"
            aria-selected={!showArchived}
            onClick={() => setShowArchived(false)}
            className={`relative flex-1 px-4 py-3 text-xs font-bold transition-colors sm:flex-none ${
              !showArchived
                ? "text-primary"
                : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
            }`}
          >
            Active
            <span
              className={`ml-1.5 ${
                !showArchived
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              ({activeTasks.length})
            </span>

            {!showArchived && (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>

          <button
            role="tab"
            aria-selected={showArchived}
            onClick={() => setShowArchived(true)}
            className={`relative flex-1 px-4 py-3 text-xs font-bold transition-colors sm:flex-none ${
              showArchived
                ? "text-primary"
                : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
            }`}
          >
            Archived
            <span
              className={`ml-1.5 ${
                showArchived
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              ({archivedTasks.length})
            </span>

            {showArchived && (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        </div>

        {/* ── Commitments ─────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
          {visible.length ? (
            visible.map((task, index) => {
              const taskIcon = getTaskIcon(task.name);
              const Icon = iconMap[taskIcon];
              const accent = iconAccent[taskIcon];

              const isArchivePending =
                archiveTask.isPending &&
                archiveTask.variables === task.name;

              const isRestorePending =
                restoreTask.isPending &&
                restoreTask.variables === task.id;

              return (
                <article
                  key={task.id}
                  className={`group grid gap-4 p-4 transition-colors duration-200 hover:bg-accent/20 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5 ${
                    index < visible.length - 1
                      ? "border-b border-border/70"
                      : ""
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-transform duration-200 group-hover:scale-[1.03] ${accent.background} ${accent.border}`}
                    >
                      <Icon className={`h-4 w-4 ${accent.icon}`} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[13px] font-bold tracking-tight">
                          {task.name}
                        </h3>

                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${
                            task.is_active
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-border/60 bg-secondary/60 text-muted-foreground"
                          }`}
                        >
                          {task.is_active ? "Active" : "Archived"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {task.cutoff_message}
                      </p>

                      <p className="mt-2.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                        <CalendarPlus className="h-3 w-3" />

                        Tracking since{" "}
                        {new Date(
                          `${task.created_at.slice(0, 10)}T12:00:00`,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:flex">
                    {task.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditor(task)}
                        className="rounded-lg border-border/70 bg-background/40 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isArchivePending || isRestorePending}
                      onClick={() =>
                        task.is_active
                          ? handleArchive(task)
                          : handleRestore(task)
                      }
                      className="rounded-lg border-border/70 bg-background/40 text-xs"
                    >
                      {task.is_active ? (
                        <Archive className="h-3.5 w-3.5" />
                      ) : (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      )}

                      {task.is_active ? "Archive" : "Restore"}
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="p-10 text-center md:p-12">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-secondary/70 text-muted-foreground">
                <Archive className="h-4 w-4" />
              </div>

              <h3 className="mt-4 text-sm font-bold tracking-tight">
                {showArchived
                  ? "No archived commitments"
                  : "No active commitments"}
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {showArchived
                  ? "Commitments you archive will appear here with their history preserved."
                  : "Create a commitment to start tracking your daily habits."}
              </p>

              {!showArchived && (
                <Button
                  size="sm"
                  className="mt-4 rounded-lg"
                  onClick={() => openEditor(null)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New commitment
                </Button>
              )}
            </div>
          )}
        </section>

        <CommitmentDialog
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setActionError(null);
            setOpen(nextOpen);
          }}
          task={editing}
          isSaving={createTask.isPending || updateTask.isPending}
          onSave={handleSave}
          errorMessage={actionError}
        />
      </div>
    </AppShell>
  );
}

function CommitmentDialog({
  open,
  onOpenChange,
  task,
  isSaving,
  onSave,
  errorMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskResponse | null;
  isSaving: boolean;
  onSave: (value: {
    name: string;
    cutoff_message: string;
  }) => void;
  errorMessage: string | null;
}) {
  const [name, setName] = useState("");
  const [cutoffMessage, setCutoffMessage] = useState("");
  const [icon, setIcon] = useState<CommitmentIcon>("project");

  const initialize = (nextOpen: boolean) => {
    if (nextOpen) {
      setName(task?.name ?? "");
      setCutoffMessage(task?.cutoff_message ?? "");
      setIcon(task ? getTaskIcon(task.name) : "project");
    }

    onOpenChange(nextOpen);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !cutoffMessage.trim()) return;

    onSave({
      name: name.trim(),
      cutoff_message: cutoffMessage.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={initialize}>
      <DialogContent className="rounded-xl border-border/70 bg-card shadow-lg sm:max-w-lg">
        <form onSubmit={submit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight">
              {task ? "Edit commitment" : "New commitment"}
            </DialogTitle>

            <DialogDescription className="text-xs leading-relaxed">
              Define the minimum that counts as complete. Keep it concrete and
              easy to judge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="commit-name"
                className="text-[11px] font-bold uppercase tracking-[0.06em]"
              >
                Name
              </Label>

              <Input
                id="commit-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Morning walk"
                className="h-10 rounded-lg border-border/70 bg-background/50 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="commit-cutoff"
                className="text-[11px] font-bold uppercase tracking-[0.06em]"
              >
                Minimum definition
              </Label>

              <Input
                id="commit-cutoff"
                value={cutoffMessage}
                onChange={(event) => setCutoffMessage(event.target.value)}
                placeholder="e.g. Walk outside for at least 20 minutes"
                className="h-10 rounded-lg border-border/70 bg-background/50 text-sm"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em]">
                Icon
              </legend>

              <p className="mb-3 text-[10px] text-muted-foreground">
                Used to visually identify this commitment.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {iconChoices.map((choice) => {
                  const Icon = iconMap[choice.value];
                  const accent = iconAccent[choice.value];
                  const selected = icon === choice.value;

                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setIcon(choice.value)}
                      className={`flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg border text-[10px] font-semibold transition-all duration-200 ${
                        selected
                          ? `${accent.border} ${accent.background} ${accent.icon} shadow-sm`
                          : "border-border/70 bg-background/30 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {errorMessage && (
              <div className="rounded-lg border border-status-no/30 bg-status-no/5 px-3 py-2">
                <p className="text-xs font-medium text-status-no">
                  {errorMessage}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-lg"
            >
              {isSaving
                ? "Saving…"
                : task
                  ? "Save changes"
                  : "Create commitment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}