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
import { iconMap, getTaskIcon, type CommitmentIcon } from "@/lib/lifeledger";
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

  const activeTasks = (allTasks ?? []).filter((t) => t.is_active);
  const archivedTasks = (allTasks ?? []).filter((t) => !t.is_active);
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

  const handleSave = (value: { name: string; cutoff_message: string }) => {
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
      <AppShell headerTitle="Commitments">
        <div className="mx-auto max-w-6xl space-y-8">
          <PageIntro
            eyebrow="LOADING…"
            title="Keep the promises clear."
            description="Each commitment begins on its creation date."
          />
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading commitments…
          </div>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : "Failed to load commitments.";
    return (
      <AppShell headerTitle="Commitments">
        <div className="mx-auto max-w-6xl">
          <div className="border border-status-no/40 bg-status-no/10 p-6">
            <p className="text-sm font-semibold text-status-no">
              Could not load commitments
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
    <AppShell headerTitle="Commitments">
      <div className="mx-auto max-w-6xl space-y-8">
        <PageIntro
          eyebrow={`${activeTasks.length} ACTIVE`}
          title="Keep the promises clear."
          description="Each commitment begins on its creation date. Archiving removes it from future daily check-ins without changing its history."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus /> New commitment
            </Button>
          }
        />

        {actionError && (
          <div className="border border-status-no/40 bg-status-no/10 p-4">
            <p className="text-xs text-status-no">{actionError}</p>
          </div>
        )}

        <div
          className="flex border-b border-border"
          role="tablist"
          aria-label="Commitment status"
        >
          <button
            role="tab"
            aria-selected={!showArchived}
            onClick={() => setShowArchived(false)}
            className={`h-10 border-b px-4 text-sm font-medium transition-colors ${!showArchived ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Active ({activeTasks.length})
          </button>
          <button
            role="tab"
            aria-selected={showArchived}
            onClick={() => setShowArchived(true)}
            className={`h-10 border-b px-4 text-sm font-medium transition-colors ${showArchived ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Archived ({archivedTasks.length})
          </button>
        </div>

        <section className="border border-border bg-card">
          {visible.length ? (
            visible.map((task, index) => {
              const Icon = iconMap[getTaskIcon(task.name)];
              const isArchivePending =
                archiveTask.isPending && archiveTask.variables === task.name;
              const isRestorePending =
                restoreTask.isPending && restoreTask.variables === task.id;
              return (
                <article
                  key={task.id}
                  className={`grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6 ${index < visible.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{task.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {task.cutoff_message}
                      </p>
                      <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
                        <CalendarPlus className="h-3 w-3" /> Tracking since{" "}
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
                        onClick={() => openEditor(task)}
                      >
                        <Pencil /> Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={isArchivePending || isRestorePending}
                      onClick={() =>
                        task.is_active
                          ? handleArchive(task)
                          : handleRestore(task)
                      }
                    >
                      {task.is_active ? <Archive /> : <ArchiveRestore />}
                      {task.is_active ? "Archive" : "Restore"}
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <Archive className="mx-auto h-5 w-5 text-muted-foreground" />
              <h3 className="mt-4 text-sm font-semibold">
                {showArchived
                  ? "No archived commitments"
                  : "No active commitments"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {showArchived
                  ? "Commitments you archive will appear here with their history preserved."
                  : "Create a commitment to start tracking your daily habits."}
              </p>
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
  onSave: (value: { name: string; cutoff_message: string }) => void;
  errorMessage: string | null;
}) {
  const [name, setName] = useState("");
  const [cutoffMessage, setCutoffMessage] = useState("");
  // Icon is UI-only; we track it locally for display in the dialog only
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
    onSave({ name: name.trim(), cutoff_message: cutoffMessage.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={initialize}>
      <DialogContent className="rounded-none border-border bg-card sm:rounded-none">
        <form onSubmit={submit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>
              {task ? "Edit commitment" : "New commitment"}
            </DialogTitle>
            <DialogDescription>
              Define the minimum that counts as complete. Keep it concrete and
              easy to judge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="commit-name">Name</Label>
              <Input
                id="commit-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Morning walk"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commit-cutoff">Minimum definition</Label>
              <Input
                id="commit-cutoff"
                value={cutoffMessage}
                onChange={(event) => setCutoffMessage(event.target.value)}
                placeholder="e.g. Walk outside for at least 20 minutes"
              />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                Icon (display only)
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {iconChoices.map((choice) => {
                  const Icon = iconMap[choice.value];
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setIcon(choice.value)}
                      className={`flex h-16 flex-col items-center justify-center gap-1 border text-xs transition-colors ${icon === choice.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                    >
                      <Icon className="h-4 w-4" />
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {errorMessage && (
              <p className="text-xs text-status-no">{errorMessage}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
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
