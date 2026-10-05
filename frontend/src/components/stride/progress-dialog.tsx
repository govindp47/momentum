/**
 * ProgressDialog — log a progress event for a Stride journey.
 *
 * Workflow:
 * - Select journey
 * - Enter amount with quick-pick buttons
 * - Add optional note
 * - Submit → success state → closes
 *
 * Uses Momentum UI primitives and the real useLogProgress mutation hook.
 * No local store; all persistence goes through the Stride API.
 */

import { Activity, Check, TimerReset } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJourneys, useLogProgress } from "@/hooks/queries/use-stride";
import type { JourneyResponse } from "@/types/stride";

interface ProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this journey when the dialog opens. */
  journeyId?: number;
  /** Pre-filtered list of journeys. If omitted, we fetch active+paused. */
  journeys?: JourneyResponse[];
}

export function ProgressDialog({
  open,
  onOpenChange,
  journeyId,
  journeys: journeysProp,
}: ProgressDialogProps) {
  const { data: fetchedJourneys } = useJourneys();
  const logProgress = useLogProgress();

  const allJourneys = journeysProp ?? fetchedJourneys ?? [];
  const eligibleJourneys = allJourneys.filter(
    (j) => j.is_active || j.is_paused,
  );

  const [selectedId, setSelectedId] = useState<string>(
    journeyId ? String(journeyId) : "",
  );
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedId(
        journeyId
          ? String(journeyId)
          : eligibleJourneys[0]?.id
            ? String(eligibleJourneys[0].id)
            : "",
      );
      setAmount("1");
      setNote("");
      setDone(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, journeyId]);

  const selectedJourney = eligibleJourneys.find(
    (j) => String(j.id) === selectedId,
  );

  const handleSubmit = () => {
    const value = Number(amount);

    if (!selectedJourney || !Number.isFinite(value) || value <= 0) {
      toast.error("Enter a progress amount greater than zero.");
      return;
    }

    logProgress.mutate(
      {
        journeyId: selectedJourney.id,
        payload: { value, note: note.trim() || null },
      },
      {
        onSuccess: () => {
          setDone(true);
          toast.success(`Progress added to ${selectedJourney.name}`);
          window.setTimeout(() => onOpenChange(false), 1000);
        },
        onError: () => {
          toast.error("Failed to log progress. Please try again.");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-hidden sm:w-full">
        {done ? (
          <div className="flex min-h-64 min-w-0 flex-col items-center justify-center text-center">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check size={28} />
            </div>

            <DialogTitle className="mt-5 max-w-full text-2xl">
              Progress recorded
            </DialogTitle>

            <DialogDescription className="mt-2 max-w-full break-words">
              Your journey moved forward by {amount}
              {selectedJourney?.unit ? ` ${selectedJourney.unit}` : ""}.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                A meaningful step
              </p>
              <DialogTitle className="text-2xl">Log progress</DialogTitle>
              <DialogDescription>
                Add an update to one of your journeys.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 min-w-0 space-y-4">
              {/* Journey selector */}
              <div className="min-w-0">
                <label className="mb-2 block text-xs text-muted-foreground">
                  Journey
                </label>

                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="h-11 w-full min-w-0 rounded-xl">
                    <SelectValue placeholder="Select a journey…" />
                  </SelectTrigger>

                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    {eligibleJourneys.map((j) => (
                      <SelectItem
                        key={j.id}
                        value={String(j.id)}
                        className="max-w-full"
                      >
                        <span className="truncate">{j.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount input */}
              <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card/60 p-5">
                <label
                  htmlFor="progress-amount"
                  className="text-xs text-muted-foreground"
                >
                  Amount
                </label>

                <div className="mt-2 flex min-w-0 items-end gap-2">
                  <input
                    id="progress-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-5xl font-bold text-foreground outline-none"
                  />

                  {selectedJourney?.unit && (
                    <span className="mb-2 max-w-[40%] shrink-0 truncate text-sm text-muted-foreground">
                      {selectedJourney.unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick-pick buttons */}
              <div className="flex min-w-0 gap-2">
                {[1, 5, 10].map((v) => (
                  <Button
                    key={v}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(String(v))}
                  >
                    +{v}
                  </Button>
                ))}
              </div>

              {/* Note */}
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                className="min-h-20 w-full min-w-0 resize-none rounded-xl"
              />

              <div className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
                <TimerReset size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  This update counts toward your current rhythm.
                </span>
              </div>

              <Button
                className="w-full min-w-0"
                onClick={handleSubmit}
                disabled={logProgress.isPending || !selectedJourney}
              >
                <Activity size={17} />
                {logProgress.isPending ? "Recording…" : "Record progress"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
