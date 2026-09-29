import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Edit3,
  History as HistoryIcon,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
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
import { PageHeader, EmptyState } from "@/components/stride/page-header";
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
  // Fetch progress for selected journey or all journeys
  const selectedId =
    filterJourneyId !== "all" ? parseInt(filterJourneyId, 10) : undefined;

  // For "all journeys" view, we need to fetch per-journey. We'll show the
  // journey-level filter or use the selected journey's history.
  const { data: progressEvents, isLoading } = useProgressHistory(
    selectedId ?? 0,
    { limit: 200 },
  );

  // For "all" filter: aggregate history across all active journeys
  // (up to 20 events per journey)
  const { data: allJourneyProgress, isLoading: allLoading } = useAllProgress(
    filterJourneyId === "all" ? (journeys?.map((j) => j.id) ?? []) : [],
  );

  const updateEvent = useUpdateProgressEvent();
  const deleteEvent = useDeleteProgressEvent();

  const events =
    filterJourneyId === "all" ? allJourneyProgress : (progressEvents ?? []);

  const openEdit = (e: ProgressEventResponse) => {
    setEditing(e);
    setEditAmount(String(e.value ?? ""));
    setEditNote(e.note ?? "");
  };

  const saveEdit = () => {
    if (!editing) return;
    const journeyId = editing.journey_id;
    updateEvent.mutate(
      {
        eventId: editing.id,
        journeyId,
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

  const handleDelete = (e: ProgressEventResponse) => {
    deleteEvent.mutate(
      { eventId: e.id, journeyId: e.journey_id },
      {
        onSuccess: () => toast.success("Entry deleted"),
        onError: () => toast.error("Failed to delete entry"),
      },
    );
  };

  return (
    <AppShell headerTitle="History">
      <div className="animate-fade-up space-y-8 pb-12">
        <PageHeader
          eyebrow="Every step counts"
          title="History"
          description="A complete timeline of the progress you have recorded."
          action={
            <Select value={filterJourneyId} onValueChange={setFilterJourneyId}>
              <SelectTrigger className="w-48 rounded-xl" id="history-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All journeys</SelectItem>
                {(journeys ?? []).map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {isLoading || allLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((k) => (
              <Skeleton key={k} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : events.length > 0 ? (
          <EventList
            events={events}
            journeys={journeys ?? []}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ) : (
          <EmptyState
            icon={<HistoryIcon size={20} />}
            title="No progress yet"
            body="Your recorded steps will appear here in chronological order."
          />
        )}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit progress entry</DialogTitle>
            <DialogDescription>
              Correct the amount or add more context.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              inputMode="decimal"
              className="h-11 rounded-xl"
              placeholder="Amount"
            />
            <Textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="min-h-24 rounded-xl"
              placeholder="Note (optional)"
            />
            <Button onClick={saveEdit} disabled={updateEvent.isPending}>
              {updateEvent.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
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
  onEdit: (e: ProgressEventResponse) => void;
  onDelete: (e: ProgressEventResponse) => void;
}) {
  // Group by date
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  let lastDate = "";

  return (
    <div className="space-y-3">
      {sorted.map((e) => {
        const j = journeys.find((jj) => jj.id === e.journey_id);
        const Icon = j ? resolveJourneyIcon(j.tracking_method) : HistoryIcon;
        const eventDate = new Date(e.occurred_at).toDateString();
        const showDateLabel = eventDate !== lastDate;
        lastDate = eventDate;

        return (
          <div key={e.id}>
            {showDateLabel && (
              <div className="mb-2 mt-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <CalendarDays size={13} />
                {new Date(e.occurred_at).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            )}
            <div className="glass grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl p-4 sm:p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold">
                    +{formatValue(e.value ?? 0)}
                    {j?.unit ? ` ${j.unit}` : ""}
                  </span>
                  {j && (
                    <span className="text-xs text-muted-foreground">
                      on {j.name}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {e.note ?? "Progress update"}
                </p>
              </div>
              <div className="flex shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit entry"
                  onClick={() => onEdit(e)}
                >
                  <Edit3 size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete entry"
                  onClick={() => onDelete(e)}
                >
                  <Trash2 size={15} />
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
  // We can only call hooks at the top level, so we pre-fetch up to 20 journeys.
  // For a production app this would use a backend aggregate endpoint.
  // This is a frontend-only aggregation over individual journey progress hooks.
  // We cap at 10 journeys to avoid excessive requests.
  const ids = journeyIds.slice(0, 10);

  // Each hook call is stable across renders (journeyId changes don't add hooks).
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

  const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9].slice(0, ids.length);
  const isLoading = queries.some((q) => q.isLoading);

  const merged = queries
    .flatMap((q) => q.data ?? [])
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );

  return { data: merged, isLoading };
}
