import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageIntro } from "@/components/app-shell";
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        <section>
          <PageIntro
            eyebrow={`STEP ${step} OF 3`}
            title="Create a journey"
            description="Give your next chapter a clear shape. You can change everything later."
          />
        </section>

        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-5 flex items-center gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex flex-1 items-center gap-2">
                <div
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    n <= step ? "bg-primary" : "bg-border/70"
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between px-1">
            <span className="text-[12px] font-semibold text-muted-foreground">
              {step === 1 && "Define the destination"}
              {step === 2 && "Choose how to measure it"}
              {step === 3 && "Shape the path"}
            </span>
            <span className="text-[12px] font-medium text-muted-foreground">
              {step}/3
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
            <div className="p-5 md:p-6">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                        <Target className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                          The destination
                        </p>
                        <p className="text-xs font-semibold">
                          What are you moving toward?
                        </p>
                      </div>
                    </div>

                    <label
                      htmlFor="journey-name"
                      className="mb-2 block text-[11px] font-semibold text-muted-foreground"
                    >
                      Journey name
                    </label>
                    <Input
                      id="journey-name"
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Run 500 km"
                      className="h-10 rounded-lg border-border/70 bg-background/40 text-sm"
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Keep it clear and motivating.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="journey-description"
                      className="mb-2 block text-[11px] font-semibold text-muted-foreground"
                    >
                      Why this matters
                    </label>
                    <Textarea
                      id="journey-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the change you want to make…"
                      className="min-h-28 resize-none rounded-lg border-border/70 bg-background/40 text-xs leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10">
                        <Target className="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                          Measurement
                        </p>
                        <p className="text-xs font-semibold">
                          How will progress be counted?
                        </p>
                      </div>
                    </div>

                    <label className="mb-2 block text-[11px] font-semibold text-muted-foreground">
                      Tracking method
                    </label>

                    <Select
                      value={method}
                      onValueChange={(v) => setMethod(v as TrackingMethod)}
                    >
                      <SelectTrigger className="h-10 rounded-lg border-border/70 bg-background/40 text-s">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/70 bg-card">
                        {TRACKING_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="rounded-lg text-s"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <p className="mt-2 rounded-lg border border-border/60 bg-background/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                      {
                        TRACKING_OPTIONS.find((o) => o.value === method)
                          ?.description
                      }
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="journey-target"
                        className="mb-2 block text-[11px] font-semibold text-muted-foreground"
                      >
                        Target
                      </label>
                      <Input
                        id="journey-target"
                        type="number"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="h-10 rounded-lg border-border/70 bg-background/40 text-xs"
                        min="1"
                      />
                    </div>

                    {method !== "milestone" && (
                      <div>
                        <label
                          htmlFor="journey-unit"
                          className="mb-2 block text-[11px] font-semibold text-muted-foreground"
                        >
                          Unit
                        </label>
                        <Input
                          id="journey-unit"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          placeholder="km, books, hours…"
                          className="h-10 rounded-lg border-border/70 bg-background/40 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="journey-target-date"
                      className="mb-2 block text-[11px] font-semibold text-muted-foreground"
                    >
                      Target date
                      <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </label>
                    <Input
                      id="journey-target-date"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="h-10 rounded-lg border-border/70 bg-background/40 text-xs"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
                        <Flag className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                          Milestones
                        </p>
                        <h2 className="mt-0.5 text-base font-bold tracking-tight">
                          Milestone path
                        </h2>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          Break the journey into visible markers. Optional.
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMilestones([...milestones, ""])}
                      className="h-8 shrink-0 rounded-lg text-[12px]"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  <div className="mt-6 space-y-2.5">
                    {milestones.length > 0 ? (
                      milestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-[9px] font-bold text-violet-500">
                            {i + 1}
                          </div>

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
                            className="h-9 rounded-lg border-border/70 bg-background/40 text-xs"
                          />

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setMilestones(
                                milestones.filter((_, n) => n !== i),
                              )
                            }
                            aria-label={`Remove milestone ${i + 1}`}
                            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-status-no/10 hover:text-status-no"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/70 bg-background/20 p-5 text-center">
                        <p className="text-[10px] font-medium text-muted-foreground">
                          No milestones added.
                        </p>
                        <button
                          type="button"
                          onClick={() => setMilestones([""])}
                          className="mt-2 text-[10px] font-semibold text-primary hover:underline"
                        >
                          Add your first milestone
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                        <Check className="h-5 w-5 text-emerald-500" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-s font-semibold">Ready to begin</p>
                        <p className="text-[12px] leading-relaxed text-muted-foreground">
                          {name || "Your journey"} · {target}
                          {unit ? ` ${unit}` : ""} · target {targetDate}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 bg-background/20 px-5 py-4 md:px-6">
              <Button
                variant="ghost"
                disabled={step === 1}
                onClick={() => setStep(step - 1)}
                className="h-8 rounded-lg px-2.5 text-[12px]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              {step < 3 ? (
                <Button
                  disabled={step === 1 && !canContinue}
                  onClick={() => setStep(step + 1)}
                  className="h-8 rounded-lg px-3 text-[12px] shadow-sm"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={createJourney.isPending}
                  className="h-8 rounded-lg px-3 text-[12px] shadow-sm"
                >
                  {createJourney.isPending ? "Creating…" : "Create journey"}
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-emerald-500" />
            You can edit your journey anytime
          </div>
        </div>
      </div>
    </AppShell>
  );
}
