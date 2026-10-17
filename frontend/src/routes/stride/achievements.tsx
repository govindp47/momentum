import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  Check,
  Flame,
  Lock,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FacetedStone } from "@/components/ui/faceted-stone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { achievementIcons } from "@/components/stride/icons";
import { useAchievements } from "@/hooks/queries/use-stride";
import { getStoneByIndex } from "@/lib/stones";
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

  const earnedCount = achievements?.filter((a) => a.is_unlocked).length ?? 0;
  const totalCount = achievements?.length ?? 0;
  const progressCount = Math.max(totalCount - earnedCount, 0);

  const latestEarned = achievements?.find((a) => a.is_unlocked);

  return (
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        <PageIntro
          eyebrow="QUIET PROOF"
          title="Achievements"
          description="Small markers of consistency, completion, and progress earned along the way."
          action={
            <div className="flex shrink-0 rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
              <button
                key="earned"
                type="button"
                onClick={() => setTab("earned")}
                aria-pressed={tab === "earned"}
                className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
                  tab === "earned"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                Earned
                {!isLoading && <span className="ml-1.5">{earnedCount}</span>}
              </button>
              <button
                key="progress"
                type="button"
                onClick={() => setTab("progress")}
                aria-pressed={tab === "progress"}
                className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
                  tab === "progress"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                In progress
                {!isLoading && <span className="ml-1.5">{progressCount}</span>}
              </button>
            </div>
          }
        />

        {tab === "earned" && latestEarned && (
          <section className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <AchievementBadge
                achievement={latestEarned}
                accentIndex={0}
                size="large"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Latest distinction
                  </p>

                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Earned
                  </span>
                </div>

                <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                  {latestEarned.title}
                </h2>

                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
                  {latestEarned.description}
                </p>

                {latestEarned.unlocked_at && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    Earned{" "}
                    {new Date(latestEarned.unlocked_at).toLocaleDateString(
                      undefined,
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </div>
                )}
              </div>

              <div className="hidden shrink-0 sm:block">
                <Award className="h-7 w-7 text-amber-500/60" />
              </div>
            </div>
          </section>
        )}

        {!isLoading && !error && achievements && achievements.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={Award}
              label="Earned"
              value={earnedCount}
              iconClass="text-amber-500"
              iconBgClass="bg-amber-500/10"
            />
            <SummaryCard
              icon={Target}
              label="Within reach"
              value={progressCount}
              iconClass="text-violet-500"
              iconBgClass="bg-violet-500/10"
            />
            <SummaryCard
              icon={Flame}
              label="Total available"
              value={totalCount}
              iconClass="text-orange-500"
              iconBgClass="bg-orange-500/10"
            />
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <Skeleton key={k} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border/70 bg-card/80 p-8 text-center shadow-sm backdrop-blur-sm">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Award className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">
              Unable to load achievements
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Please try again.
            </p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((a, index) => (
              <AchievementCard
                key={a.key}
                achievement={a}
                accentIndex={index}
                onClick={() => setSelected(a)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/70 bg-card/80 p-8 text-center shadow-sm backdrop-blur-sm">
            <div
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl ${
                tab === "earned"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-muted text-primary"
              }`}
            >
              {tab === "earned" ? (
                <Award className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>

            <p className="mt-3 text-sm font-semibold">
              {tab === "earned"
                ? "No achievements earned yet"
                : "All achievements earned!"}
            </p>

            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
              {tab === "earned"
                ? "Keep progressing on your journeys to unlock your first achievement."
                : "You've unlocked everything currently available. Keep moving forward."}
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelected(null)}
      >
        <DialogContent className="rounded-xl border-border/70 bg-card p-5 shadow-lg sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            {selected && (
              <AchievementBadge
                achievement={selected}
                accentIndex={
                  achievements?.findIndex((a) => a.key === selected.key) ?? 0
                }
                size="dialog"
              />
            )}

            <DialogTitle className="pt-2 text-center text-xl tracking-tight">
              {selected?.title}
            </DialogTitle>

            <DialogDescription className="text-center text-xs leading-5">
              {selected?.description}
            </DialogDescription>
          </DialogHeader>

          <div
            className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs ${
              selected?.is_unlocked
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                : "border-border/60 bg-secondary/30 text-muted-foreground"
            }`}
          >
            {selected?.is_unlocked ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                {selected.unlocked_at
                  ? `Earned ${new Date(selected.unlocked_at).toLocaleDateString(
                      undefined,
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}`
                  : "Achievement earned"}
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Not yet earned — keep going.
              </>
            )}
          </div>

          {selected?.journey_name && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Target className="h-3 w-3 text-primary" />
              Journey: {selected.journey_name}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function AchievementCard({
  achievement,
  accentIndex,
  onClick,
}: {
  achievement: AchievementResponse;
  accentIndex: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-border/70 bg-card/80 p-5 text-center shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="relative flex justify-center">
        <AchievementBadge
          achievement={achievement}
          accentIndex={accentIndex}
          size="small"
        />

        {achievement.is_unlocked && achievement.unlocked_at && (
          <div className="absolute right-0 top-0 rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-500">
            {new Date(achievement.unlocked_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </div>
        )}
      </div>

      <h2 className="mt-4 line-clamp-1 text-sm font-semibold tracking-tight">
        {achievement.title}
      </h2>

      <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-4.5 text-muted-foreground">
        {achievement.description}
      </p>

      <div className="mt-3 flex min-h-4 items-center justify-center gap-2">
        {achievement.journey_name ? (
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-medium text-muted-foreground">
            <Target className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">{achievement.journey_name}</span>
          </p>
        ) : null}
      </div>
    </button>
  );
}

function AchievementBadge({
  achievement,
  accentIndex,
  size,
}: {
  achievement: AchievementResponse;
  accentIndex: number;
  size: "small" | "large" | "dialog";
}) {
  const Icon = achievementIcons[achievement.key] ?? Sparkles;

  return (
    <FacetedStone
      stone={getStoneByIndex(accentIndex)}
      icon={Icon}
      size={size === "dialog" ? "medium" : size}
      active={achievement.is_unlocked}
    />
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  iconClass,
  iconBgClass,
}: {
  icon: typeof Award;
  label: string;
  value: number;
  iconClass: string;
  iconBgClass: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm backdrop-blur-sm">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
      >
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>

      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none tracking-tight">
          {value}
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}
