import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/stride/page-header";
import { useCreateJourney, todayLocalDate } from "@/hooks/queries/use-stride";
import type { TrackingMethod } from "@/types/stride";

export const Route = createFileRoute("/stride/journeys/new")({
  head: () => ({
    meta: [
      { title: "New journey — Stride" },
      {
        name: "description",
        content: "Create a meaningful new personal journey in Stride.",
      },
    ],
  }),
  component: NewJourneyPage,
});

const TRACKING_OPTIONS: Array<{
  value: TrackingMethod;
  label: string;
  description: string;
}> = [
  {
    value: "quantity",
    label: "Quantity",
    description: "Track a measured amount (km, pages, reps…)",
  },
  {
    value: "count",
    label: "Count",
    description: "Track discrete items (books, sessions, tasks…)",
  },
  {
    value: "duration",
    label: "Duration",
    description: "Track time spent (hours, minutes…)",
  },
  {
    value: "milestone",
    label: "Milestones",
    description: "Progress through defined stages",
  },
];

function NewJourneyPage() {
  const navigate = useNavigate();
  const createJourney = useCreateJourney();

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 fields
  const [method, setMethod] = useState<TrackingMethod>("quantity");
  const [target, setTarget] = useState("100");
  const [unit, setUnit] = useState("km");
  const [targetDate, setTargetDate] = useState(() => {
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, "0");
    const d = String(next.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  // Step 3 fields
  const [milestones, setMilestones] = useState<string[]>([
    "First quarter",
    "Halfway",
    "Finish line",
  ]);

  const canContinue = name.trim().length >= 2;

  const handleSave = () => {
    if (!canContinue) return;

    const targetValue = Number(target);
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      toast.error("Target must be a positive number.");
      return;
    }

    const milestoneNames = milestones.filter((m) => m.trim().length > 0);

    createJourney.mutate(
      {
        name: name.trim(),
        description: description.trim() || "A meaningful journey in progress.",
        tracking_method: method,
        target_value: targetValue,
        unit: unit.trim() || null,
        start_date: todayLocalDate(),
        target_date: targetDate || null,
        milestone_names: milestoneNames.length > 0 ? milestoneNames : null,
      },
      {
        onSuccess: (created) => {
          toast.success("Journey created!");
          void navigate({
            to: "/stride/journeys/$journeyId",
            params: { journeyId: String(created.id) },
          });
        },
        onError: () => {
          toast.error("Failed to create journey. Please try again.");
        },
      },
    );
  };

  return (
    <AppShell headerTitle="New journey">
      <div className="animate-fade-up pb-12">
        <PageHeader
          eyebrow={`Step ${step} of 3`}
          title="Create a journey"
          description="Give your next chapter a clear shape. You can change everything later."
        />

        <div className="mx-auto mt-8 max-w-2xl">
          {/* Progress steps */}
          <div className="mb-7 flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>

          <div className="glass-strong rounded-xl p-5 sm:p-7">
            {/* Step 1: Name & description */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs text-muted-foreground">
                    Journey name
                  </label>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Run 500 km"
                    className="h-12 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs text-muted-foreground">
                    Why this matters
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the change you want to make…"
                    className="min-h-32 rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Tracking method + target */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs text-muted-foreground">
                    Tracking method
                  </label>
                  <Select
                    value={method}
                    onValueChange={(v) => setMethod(v as TrackingMethod)}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRACKING_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {
                      TRACKING_OPTIONS.find((o) => o.value === method)
                        ?.description
                    }
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs text-muted-foreground">
                      Target
                    </label>
                    <Input
                      type="number"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="h-12 rounded-xl"
                      min="1"
                    />
                  </div>
                  {method !== "milestone" && (
                    <div>
                      <label className="mb-2 block text-xs text-muted-foreground">
                        Unit
                      </label>
                      <Input
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="km, books, hours…"
                        className="h-12 rounded-xl"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs text-muted-foreground">
                    Target date (optional)
                  </label>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Milestones */}
            {step === 3 && (
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Milestone path</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Break the journey into visible markers. (optional)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMilestones([...milestones, ""])}
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </div>

                <div className="mt-5 space-y-3">
                  {milestones.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={m}
                        onChange={(e) =>
                          setMilestones(
                            milestones.map((x, n) =>
                              n === i ? e.target.value : x,
                            ),
                          )
                        }
                        placeholder={`Milestone ${i + 1}`}
                        className="h-11 rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setMilestones(milestones.filter((_, n) => n !== i))
                        }
                        aria-label="Remove milestone"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="mt-6 rounded-xl border border-border bg-card/60 p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-primary" />
                    Ready to begin
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {name} · {target}
                    {unit ? ` ${unit}` : ""} · target {targetDate}
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <Button
                variant="ghost"
                disabled={step === 1}
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={16} />
                Back
              </Button>
              {step < 3 ? (
                <Button
                  disabled={step === 1 && !canContinue}
                  onClick={() => setStep(step + 1)}
                >
                  Continue
                  <ArrowRight size={16} />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={createJourney.isPending}>
                  {createJourney.isPending ? "Creating…" : "Create journey"}
                  <Check size={16} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
