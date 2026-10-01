import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Edit3,
  History as HistoryIcon,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/stride/page-header";
import { resolveJourneyIcon } from "@/components/stride/icons";
import { formatValue } from "@/components/stride/journey-card";
import {
  useJourneys,
  useProgressHistory,
  useUpdateProgressEvent,
  useDeleteProgressEvent,
} from "@/hooks/queries/use-stride";
import type { ProgressEventResponse } from "@/types/stride";

export const Route = createFileRoute("/stride/history")({
  head: () => ({
    meta: [
      { title: "History — Stride" },
      {
        name: "description",
        content: "Review and edit your complete Stride progress history.",
      },
    ],
  }),
  component: StrideHistoryPage,
});

function StrideHistoryPage() {
  const [filterJourneyId, setFilterJourneyId] = useState<string>("all");
  const [editing, setEditing] = useState<ProgressEventResponse | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  const { data: journeys } = useJourneys();

  const selectedId =
    filterJourneyId !== "all" ? parseInt(filterJourneyId, 10) : undefined;

  const { data: progressEvents, isLoading } = useProgressHistory(
    selectedId ?? 0,
    { limit: 200 },
  );

  const { data: allJourneyProgress, isLoading: allLoading } = useAllProgress(
    filterJourneyId === "all" ? (journeys?.map((j) => j.id) ?? []) : [],
  );

  const updateEvent = useUpdateProgressEvent();
  const deleteEvent = useDeleteProgressEvent();

  const events =
    filterJourneyId === "all" ? allJourneyProgress : (progressEvents ?? []);

  const openEdit = (event: ProgressEventResponse) => {
    setEditing(event);
    setEditAmount(String(event.value ?? ""));
    setEditNote(event.note ?? "");
  };

  const saveEdit = () => {
    if (!editing) return;

    updateEvent.mutate(
      {
        eventId: editing.id,
        journeyId: editing.journey_id,
        payload: {
          value: Number(editAmount) || null,
          note: editNote.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setEditing(null);
          toast.success("Progress entry updated");
        },
        onError: () => toast.error("Failed to update entry"),
      },
    );
  };

  const handleDelete = (event: ProgressEventResponse) => {
    deleteEvent.mutate(
      { eventId: event.id, journeyId: event.journey_id },
      {
        onSuccess: () => toast.success("Entry deleted"),
        onError: () => toast.error("Failed to delete entry"),
      },
    );
  };

  return (
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        <PageIntro
          eyebrow="LOOKING BACK"
          title="See the path you’ve taken."
          description="Every recorded step becomes part of the story."
        />

        <div className="flex justify-end">
          <div className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-card/80 p-1.5 shadow-sm backdrop-blur-sm sm:w-auto">
            <HistoryIcon className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Select
              value={filterJourneyId}
              onValueChange={setFilterJourneyId}
            >
              <SelectTrigger
                className="h-8 w-full border-0 bg-transparent px-2 text-xs font-medium shadow-none focus:ring-0 sm:w-48"
                id="history-filter"
              >
                <SelectValue placeholder="Select journey" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All journeys</SelectItem>
                {(journeys ?? []).map((journey) => (
                  <SelectItem key={journey.id} value={String(journey.id)}>
                    {journey.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading || allLoading ? (
          <HistorySkeleton />
        ) : events.length > 0 ? (
          <EventList
            events={events}
            journeys={journeys ?? []}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ) : (
          <div className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
            <EmptyState
              icon={<HistoryIcon size={20} />}
              title="No progress yet"
              body="Your recorded steps will appear here in chronological order."
            />
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="rounded-xl border-border/70 bg-card shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Edit progress entry</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Correct the amount or add more context to this progress update.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-progress-amount"
                className="text-xs font-medium text-muted-foreground"
              >
                Amount
              </label>
              <Input
                id="edit-progress-amount"
                value={editAmount}
                onChange={(event) => setEditAmount(event.target.value)}
                inputMode="decimal"
                className="h-10 rounded-lg border-border/70 bg-background/60 text-sm"
                placeholder="Amount"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-progress-note"
                className="text-xs font-medium text-muted-foreground"
              >
                Note
              </label>
              <Textarea
                id="edit-progress-note"
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                className="min-h-24 rounded-lg border-border/70 bg-background/60 text-sm"
                placeholder="Note (optional)"
              />
            </div>

            <Button
              onClick={saveEdit}
              disabled={updateEvent.isPending}
              className="h-9 w-full rounded-lg text-xs font-semibold"
            >
              {updateEvent.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((group) => (
        <div key={group} className="space-y-2.5">
          <Skeleton className="h-3 w-32 rounded-full" />

          {[1, 2].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm backdrop-blur-sm"
            >
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40 rounded-full" />
                <Skeleton className="h-3 w-56 max-w-full rounded-full" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="size-8 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EventList({
  events,
  journeys,
  onEdit,
  onDelete,
}: {
  events: ProgressEventResponse[];
  journeys: import("@/types/stride").JourneyResponse[];
  onEdit: (event: ProgressEventResponse) => void;
  onDelete: (event: ProgressEventResponse) => void;
}) {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  let lastDate = "";

  return (
    <div className="space-y-5">
      {sorted.map((event) => {
        const journey = journeys.find(
          (candidate) => candidate.id === event.journey_id,
        );

        const Icon = journey
          ? resolveJourneyIcon(journey.tracking_method)
          : HistoryIcon;

        const eventDate = new Date(event.occurred_at).toDateString();
        const showDateLabel = eventDate !== lastDate;
        lastDate = eventDate;

        return (
          <div key={event.id}>
            {showDateLabel && (
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <div className="flex size-6 items-center justify-center rounded-md bg-sky-500/10 text-sky-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {new Date(event.occurred_at).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}

            <div className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm backdrop-blur-sm transition-colors hover:bg-card sm:gap-4 sm:p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-500">
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold tracking-tight">
                    +{formatValue(event.value ?? 0)}
                    {journey?.unit ? ` ${journey.unit}` : ""}
                  </span>

                  {journey && (
                    <span className="truncate text-xs text-muted-foreground">
                      {journey.name}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {event.note ?? "Progress update"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit entry"
                  onClick={() => onEdit(event)}
                  className="size-8 rounded-lg text-muted-foreground transition-colors hover:bg-sky-500/10 hover:text-sky-500"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete entry"
                  onClick={() => onDelete(event)}
                  className="size-8 rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Fetch progress history for multiple journeys and merge them.
 * Returns merged+sorted events, and combined loading state.
 */
function useAllProgress(journeyIds: number[]) {
  const ids = journeyIds.slice(0, 10);

  const q0 = useProgressHistory(ids[0] ?? 0, { limit: 50 });
  const q1 = useProgressHistory(ids[1] ?? 0, { limit: 50 });
  const q2 = useProgressHistory(ids[2] ?? 0, { limit: 50 });
  const q3 = useProgressHistory(ids[3] ?? 0, { limit: 50 });
  const q4 = useProgressHistory(ids[4] ?? 0, { limit: 50 });
  const q5 = useProgressHistory(ids[5] ?? 0, { limit: 50 });
  const q6 = useProgressHistory(ids[6] ?? 0, { limit: 50 });
  const q7 = useProgressHistory(ids[7] ?? 0, { limit: 50 });
  const q8 = useProgressHistory(ids[8] ?? 0, { limit: 50 });
  const q9 = useProgressHistory(ids[9] ?? 0, { limit: 50 });

  const queries = [
    q0,
    q1,
    q2,
    q3,
    q4,
    q5,
    q6,
    q7,
    q8,
    q9,
  ].slice(0, ids.length);

  const isLoading = queries.some((query) => query.isLoading);

  const merged = queries
    .flatMap((query) => query.data ?? [])
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() -
        new Date(a.occurred_at).getTime(),
    );

  return { data: merged, isLoading };
}