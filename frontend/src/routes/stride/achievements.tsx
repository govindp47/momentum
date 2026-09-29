import { createFileRoute } from "@tanstack/react-router";
import { Award, Check, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/stride/page-header";
import { achievementIcons } from "@/components/stride/icons";
import { useAchievements } from "@/hooks/queries/use-stride";
import type { AchievementResponse } from "@/types/stride";

export const Route = createFileRoute("/stride/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Stride" },
      {
        name: "description",
        content:
          "Celebrate earned milestones and see what is within reach in Stride.",
      },
    ],
  }),
  component: StrideAchievementsPage,
});

function StrideAchievementsPage() {
  const [tab, setTab] = useState<"earned" | "progress">("earned");
  const [selected, setSelected] = useState<AchievementResponse | null>(null);

  const { data: achievements, isLoading, error } = useAchievements();

  const items =
    achievements?.filter((a) =>
      tab === "earned" ? a.is_unlocked : !a.is_unlocked,
    ) ?? [];

  // Latest earned achievement (for the hero card)
  const latestEarned = achievements?.find((a) => a.is_unlocked);

  return (
    <AppShell headerTitle="Achievements">
      <div className="animate-fade-up space-y-8 pb-12">
        <PageHeader
          eyebrow="Quiet proof"
          title="Achievements"
          description="Markers of consistency and completion, earned through real progress."
          action={
            <div className="flex rounded-xl border border-border bg-card/60 p-1">
              <Button
                size="sm"
                variant={tab === "earned" ? "secondary" : "ghost"}
                onClick={() => setTab("earned")}
              >
                Earned
              </Button>
              <Button
                size="sm"
                variant={tab === "progress" ? "secondary" : "ghost"}
                onClick={() => setTab("progress")}
              >
                In progress
              </Button>
            </div>
          }
        />

        {/* Latest earned — hero card */}
        {tab === "earned" && latestEarned && (
          <section className="glass-strong overflow-hidden rounded-xl p-6 sm:p-8">
            <div className="grid gap-7 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex size-28 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-glow">
                <Award size={42} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Latest distinction
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  {latestEarned.title}
                </h2>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                  {latestEarned.description}
                </p>
                {latestEarned.unlocked_at && (
                  <div className="mt-5 flex items-center gap-2 text-xs text-primary">
                    <Check size={14} />
                    Earned{" "}
                    {new Date(latestEarned.unlocked_at).toLocaleDateString(
                      undefined,
                      { month: "long", day: "numeric", year: "numeric" },
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Achievement grid */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <Skeleton key={k} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Unable to load achievements. Please try again.
            </p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => {
              const Icon = achievementIcons[a.key] ?? Sparkles;
              return (
                <button
                  key={a.key}
                  onClick={() => setSelected(a)}
                  className="journey-card glass rounded-xl p-5 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex size-11 items-center justify-center rounded-xl ${
                        a.is_unlocked
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    {a.is_unlocked ? (
                      <Check size={16} className="text-primary" />
                    ) : (
                      <Lock size={15} className="text-muted-foreground" />
                    )}
                  </div>
                  <h2 className="mt-5 text-lg font-semibold">{a.title}</h2>
                  <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
                    {a.description}
                  </p>
                  {a.journey_name && (
                    <p className="mt-2 text-xs text-primary">
                      {a.journey_name}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-xl p-8 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {tab === "earned" ? <Award size={20} /> : <Sparkles size={20} />}
            </div>
            <p className="mt-4 text-sm font-semibold">
              {tab === "earned"
                ? "No achievements earned yet"
                : "All achievements earned!"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {tab === "earned"
                ? "Keep progressing on your journeys to unlock achievements."
                : "Check back as you continue your journey."}
            </p>
          </div>
        )}
      </div>

      {/* Achievement detail dialog */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelected(null)}
      >
        <DialogContent className="text-center">
          <DialogHeader>
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Award size={28} />
            </div>
            <DialogTitle className="pt-3 text-center text-2xl">
              {selected?.title}
            </DialogTitle>
            <DialogDescription className="text-center">
              {selected?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-card/60 p-4 text-sm">
            {selected?.is_unlocked && selected.unlocked_at
              ? `Earned ${new Date(selected.unlocked_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
              : "Not yet earned — keep going!"}
          </div>
          {selected?.journey_name && (
            <p className="text-xs text-muted-foreground">
              Journey: {selected.journey_name}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
