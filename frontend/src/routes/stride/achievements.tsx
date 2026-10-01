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

const achievementAccents = [
  {
    icon: "text-amber-300",
    background: "bg-amber-500/10",
    border: "border-amber-400/30",
    gradient: "from-yellow-200 via-amber-400 to-orange-600",
    glow: "shadow-amber-500/30",
    inner: "bg-amber-950/15 dark:bg-amber-950/35",
    facet: "bg-yellow-100/25",
  },
  {
    icon: "text-violet-300",
    background: "bg-violet-500/10",
    border: "border-violet-400/30",
    gradient: "from-fuchsia-300 via-violet-500 to-indigo-700",
    glow: "shadow-violet-500/30",
    inner: "bg-violet-950/15 dark:bg-violet-950/35",
    facet: "bg-violet-100/20",
  },
  {
    icon: "text-emerald-300",
    background: "bg-emerald-500/10",
    border: "border-emerald-400/30",
    gradient: "from-emerald-200 via-emerald-500 to-teal-700",
    glow: "shadow-emerald-500/30",
    inner: "bg-emerald-950/15 dark:bg-emerald-950/35",
    facet: "bg-emerald-100/20",
  },
  {
    icon: "text-sky-300",
    background: "bg-sky-500/10",
    border: "border-sky-400/30",
    gradient: "from-cyan-200 via-sky-500 to-blue-700",
    glow: "shadow-sky-500/30",
    inner: "bg-sky-950/15 dark:bg-sky-950/35",
    facet: "bg-sky-100/20",
  },
  {
    icon: "text-orange-300",
    background: "bg-orange-500/10",
    border: "border-orange-400/30",
    gradient: "from-yellow-200 via-orange-500 to-red-700",
    glow: "shadow-orange-500/30",
    inner: "bg-orange-950/15 dark:bg-orange-950/35",
    facet: "bg-orange-100/20",
  },
  {
    icon: "text-pink-300",
    background: "bg-pink-500/10",
    border: "border-pink-400/30",
    gradient: "from-pink-200 via-pink-500 to-rose-700",
    glow: "shadow-pink-500/30",
    inner: "bg-pink-950/15 dark:bg-pink-950/35",
    facet: "bg-pink-100/20",
  },
];

function getAchievementAccent(index: number) {
  return (
    achievementAccents[index % achievementAccents.length] ?? {
      icon: "text-amber-300",
      background: "bg-amber-500/10",
      border: "border-amber-400/30",
      gradient: "from-yellow-200 via-amber-400 to-orange-600",
      glow: "shadow-amber-500/30",
      inner: "bg-amber-950/15 dark:bg-amber-950/35",
      facet: "bg-yellow-100/25",
    }
  );
}

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
              <Button
                size="sm"
                variant={tab === "earned" ? "secondary" : "ghost"}
                className="h-8 rounded-lg px-3 text-xs"
                onClick={() => setTab("earned")}
              >
                Earned
                {!isLoading && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    {earnedCount}
                  </span>
                )}
              </Button>

              <Button
                size="sm"
                variant={tab === "progress" ? "secondary" : "ghost"}
                className="h-8 rounded-lg px-3 text-xs"
                onClick={() => setTab("progress")}
              >
                In progress
                {!isLoading && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    {progressCount}
                  </span>
                )}
              </Button>
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
                    {new Date(
                      latestEarned.unlocked_at,
                    ).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
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
                  : "bg-violet-500/10 text-violet-500"
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
                : "border-violet-500/20 bg-violet-500/5 text-muted-foreground"
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
                <Lock className="h-3.5 w-3.5 text-violet-500" />
                Not yet earned — keep going.
              </>
            )}
          </div>

          {selected?.journey_name && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Target className="h-3 w-3 text-violet-500" />
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
            <Target className="h-3 w-3 shrink-0 text-violet-500" />
            <span className="truncate">{achievement.journey_name}</span>
          </p>
        ) : null}
      </div>
    </button>
  );
}

/**
 * A faceted "power stone" style achievement badge.
 *
 * The shape intentionally uses an irregular gemstone silhouette rather
 * than a literal copy of any existing fictional artifact:
 * - broad faceted crown
 * - tapered lower point
 * - asymmetric polygon cuts
 * - multiple translucent facets
 * - luminous gradient
 * - small central emblem
 */
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
  const accent = getAchievementAccent(accentIndex);

  const dimensions = {
    small: "h-14 w-12",
    large: "h-24 w-20",
    dialog: "h-20 w-16",
  };

  const iconSizes = {
    small: "h-5 w-5",
    large: "h-8 w-8",
    dialog: "h-6 w-6",
  };

  const innerSizes = {
    small: "h-6 w-6",
    large: "h-10 w-10",
    dialog: "h-8 w-8",
  };

  const unlocked = achievement.is_unlocked;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${dimensions[size]} ${
        unlocked ? `drop-shadow-xl ${accent.glow} transition-[filter] duration-300` : "opacity-45 grayscale"
      }`}
      aria-hidden="true"
    >
      {/* =========================================================
          OUTER CRYSTAL
          ========================================================= */}
      <div
        className={`absolute inset-0 overflow-hidden ${
          unlocked
            ? `bg-gradient-to-br ${accent.gradient}`
            : "bg-muted-foreground/30"
        }`}
        style={{
          clipPath:
            "polygon(50% 0%, 68% 5%, 86% 17%, 96% 38%, 91% 68%, 78% 88%, 61% 98%, 50% 100%, 39% 98%, 22% 88%, 9% 68%, 4% 38%, 14% 17%, 32% 5%)",
        }}
      >
        {unlocked && (
          <>
            {/* =====================================================
                DEPTH LAYER 01 — OUTER GLASS SHELL
                ===================================================== */}
            <div
              className="absolute inset-[2%] bg-white/[0.035]"
              style={{
                clipPath:
                  "polygon(50% 0%, 69% 6%, 87% 18%, 95% 39%, 90% 68%, 77% 88%, 61% 98%, 50% 100%, 39% 98%, 23% 88%, 10% 68%, 5% 39%, 13% 18%, 31% 6%)",
              }}
            />

            {/* =====================================================
                DEPTH LAYER 02 — DARK INTERNAL WALL
                ===================================================== */}
            <div
              className="absolute inset-[5%] bg-black/[0.14]"
              style={{
                clipPath:
                  "polygon(50% 0%, 70% 7%, 88% 20%, 94% 40%, 88% 67%, 75% 86%, 60% 97%, 50% 100%, 40% 97%, 25% 86%, 12% 67%, 6% 40%, 12% 20%, 30% 7%)",
              }}
            />

            {/* =====================================================
                DEPTH LAYER 03 — INNER GLASS
                ===================================================== */}
            <div
              className={`absolute inset-[8%] ${accent.inner}`}
              style={{
                clipPath:
                  "polygon(50% 0%, 70% 10%, 87% 25%, 91% 42%, 84% 65%, 70% 84%, 57% 96%, 50% 100%, 43% 96%, 30% 84%, 16% 65%, 9% 42%, 13% 25%, 30% 10%)",
              }}
            />

            {/* =====================================================
                DEPTH LAYER 04 — INNER TRANSLUCENT SHELL
                ===================================================== */}
            <div
              className="absolute inset-[13%] bg-white/[0.055]"
              style={{
                clipPath:
                  "polygon(50% 0%, 71% 12%, 86% 28%, 88% 44%, 80% 64%, 67% 82%, 56% 94%, 50% 100%, 44% 94%, 33% 82%, 20% 64%, 12% 44%, 14% 28%, 29% 12%)",
              }}
            />

            {/* =====================================================
                DEEP CORE
                ===================================================== */}
            <div
              className="absolute inset-[20%] bg-black/[0.08]"
              style={{
                clipPath:
                  "polygon(50% 0%, 76% 18%, 90% 50%, 74% 82%, 50% 100%, 26% 82%, 10% 50%, 24% 18%)",
              }}
            />

            {/* =====================================================
                SOFT INTERNAL LIGHT VOLUME
                ===================================================== */}
            <div
              className="absolute inset-[18%] bg-white/[0.035] blur-[1px]"
              style={{
                clipPath:
                  "polygon(50% 4%, 76% 22%, 84% 50%, 69% 79%, 50% 94%, 31% 79%, 16% 50%, 24% 22%)",
              }}
            />

            {/* =====================================================
                PRIMARY CRYSTAL FACETS
                ===================================================== */}

            {/* Crown */}
            <div
              className="absolute inset-0 bg-white/[0.18]"
              style={{
                clipPath:
                  "polygon(50% 0%, 70% 7%, 61% 38%, 50% 32%, 39% 38%, 30% 7%)",
              }}
            />

            {/* Upper-left */}
            <div
              className="absolute inset-0 bg-white/[0.075]"
              style={{
                clipPath:
                  "polygon(30% 7%, 39% 38%, 17% 59%, 4% 38%, 14% 17%)",
              }}
            />

            {/* Upper-right */}
            <div
              className="absolute inset-0 bg-black/[0.075]"
              style={{
                clipPath:
                  "polygon(70% 7%, 86% 17%, 96% 38%, 83% 59%, 61% 38%)",
              }}
            />

            {/* Lower-left */}
            <div
              className="absolute inset-0 bg-black/[0.11]"
              style={{
                clipPath:
                  "polygon(17% 59%, 39% 38%, 50% 74%, 39% 98%, 22% 88%, 9% 68%)",
              }}
            />

            {/* Lower-right */}
            <div
              className="absolute inset-0 bg-white/[0.075]"
              style={{
                clipPath:
                  "polygon(83% 59%, 61% 38%, 50% 74%, 61% 98%, 78% 88%, 91% 68%)",
              }}
            />

            {/* Bottom core */}
            <div
              className="absolute inset-0 bg-black/[0.14]"
              style={{
                clipPath:
                  "polygon(50% 74%, 61% 98%, 50% 100%, 39% 98%)",
              }}
            />

            {/* =====================================================
                SECONDARY INTERNAL FACETS
                ===================================================== */}

            {/* Upper crystal window */}
            <div
              className="absolute inset-0 bg-white/[0.045]"
              style={{
                clipPath:
                  "polygon(50% 11%, 65% 21%, 57% 39%, 50% 32%, 43% 39%, 35% 21%)",
              }}
            />

            {/* Left inner plane */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath:
                  "polygon(17% 59%, 39% 38%, 43% 60%, 31% 72%)",
              }}
            />

            {/* Right inner plane */}
            <div
              className="absolute inset-0 bg-black/[0.045]"
              style={{
                clipPath:
                  "polygon(83% 59%, 61% 38%, 57% 60%, 69% 72%)",
              }}
            />

            {/* Deep lower-left plane */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath:
                  "polygon(31% 72%, 43% 60%, 50% 74%, 39% 86%)",
              }}
            />

            {/* Deep lower-right plane */}
            <div
              className="absolute inset-0 bg-black/[0.045]"
              style={{
                clipPath:
                  "polygon(69% 72%, 57% 60%, 50% 74%, 61% 86%)",
              }}
            />

            {/* =====================================================
                Z-AXIS / DEPTH PLANES
                ===================================================== */}

            {/* Left depth wall */}
            <div
              className="absolute inset-0 bg-white/[0.055]"
              style={{
                clipPath:
                  "polygon(4% 38%, 17% 59%, 39% 38%, 50% 32%, 39% 18%, 14% 17%)",
              }}
            />

            {/* Right depth wall */}
            <div
              className="absolute inset-0 bg-black/[0.075]"
              style={{
                clipPath:
                  "polygon(96% 38%, 83% 59%, 61% 38%, 50% 32%, 61% 18%, 86% 17%)",
              }}
            />

            {/* Central front plane */}
            <div
              className="absolute inset-0 bg-white/[0.045]"
              style={{
                clipPath:
                  "polygon(39% 38%, 50% 32%, 61% 38%, 50% 74%)",
              }}
            />

            {/* Rear plane */}
            <div
              className="absolute inset-0 bg-black/[0.055]"
              style={{
                clipPath:
                  "polygon(39% 38%, 50% 32%, 61% 38%, 50% 18%)",
              }}
            />

            {/* Lower depth left */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath:
                  "polygon(17% 59%, 39% 38%, 50% 74%, 39% 86%, 22% 88%)",
              }}
            />

            {/* Lower depth right */}
            <div
              className="absolute inset-0 bg-black/[0.04]"
              style={{
                clipPath:
                  "polygon(83% 59%, 61% 38%, 50% 74%, 61% 86%, 78% 88%)",
              }}
            />

            {/* =====================================================
                MICRO FACET NETWORK
                ===================================================== */}

            {/* Upper-left micro facet */}
            <div
              className="absolute inset-0 bg-white/[0.035]"
              style={{
                clipPath:
                  "polygon(22% 19%, 31% 10%, 39% 38%, 29% 32%)",
              }}
            />

            {/* Upper-right micro facet */}
            <div
              className="absolute inset-0 bg-black/[0.035]"
              style={{
                clipPath:
                  "polygon(78% 19%, 69% 10%, 61% 38%, 71% 32%)",
              }}
            />

            {/* Mid-left micro plane */}
            <div
              className="absolute inset-0 bg-white/[0.03]"
              style={{
                clipPath:
                  "polygon(10% 43%, 17% 59%, 29% 50%, 23% 38%)",
              }}
            />

            {/* Mid-right micro plane */}
            <div
              className="absolute inset-0 bg-black/[0.03]"
              style={{
                clipPath:
                  "polygon(90% 43%, 83% 59%, 71% 50%, 77% 38%)",
              }}
            />

            {/* Lower-left micro plane */}
            <div
              className="absolute inset-0 bg-white/[0.025]"
              style={{
                clipPath:
                  "polygon(22% 76%, 31% 72%, 39% 86%, 30% 84%)",
              }}
            />

            {/* Lower-right micro plane */}
            <div
              className="absolute inset-0 bg-black/[0.03]"
              style={{
                clipPath:
                  "polygon(78% 76%, 69% 72%, 61% 86%, 70% 84%)",
              }}
            />

            {/* =====================================================
                FINE CRYSTAL SEAMS
                ===================================================== */}

            {/* Main diagonal refraction */}
            <span
              className="absolute left-[23%] top-[24%] h-px w-[54%] bg-white/[0.28]"
              style={{ transform: "rotate(24deg)" }}
            />

            <span
              className="absolute left-[27%] top-[59%] h-px w-[46%] bg-white/[0.16]"
              style={{ transform: "rotate(-18deg)" }}
            />

            {/* Central vertical crystal seams */}
            <span
              className="absolute left-[39%] top-[31%] h-[45%] w-px bg-white/[0.16]"
              style={{ transform: "rotate(-10deg)" }}
            />

            <span
              className="absolute left-[59%] top-[31%] h-[45%] w-px bg-black/[0.13]"
              style={{ transform: "rotate(10deg)" }}
            />

            {/* Z-axis seams */}
            <span
              className="absolute left-[14%] top-[38%] h-[29%] w-px bg-white/[0.13]"
              style={{ transform: "rotate(-24deg)" }}
            />

            <span
              className="absolute right-[14%] top-[38%] h-[29%] w-px bg-black/[0.13]"
              style={{ transform: "rotate(24deg)" }}
            />

            <span
              className="absolute left-[32%] top-[12%] h-[24%] w-px bg-white/[0.13]"
              style={{ transform: "rotate(24deg)" }}
            />

            <span
              className="absolute right-[32%] top-[12%] h-[24%] w-px bg-black/[0.11]"
              style={{ transform: "rotate(-24deg)" }}
            />

            {/* Secondary hairline facets */}
            <span
              className="absolute left-[20%] top-[50%] h-px w-[15%] bg-white/[0.15]"
              style={{ transform: "rotate(38deg)" }}
            />

            <span
              className="absolute right-[20%] top-[50%] h-px w-[15%] bg-black/[0.12]"
              style={{ transform: "rotate(-38deg)" }}
            />

            <span
              className="absolute bottom-[21%] left-[30%] h-px w-[19%] bg-white/[0.11]"
              style={{ transform: "rotate(-28deg)" }}
            />

            <span
              className="absolute bottom-[21%] right-[30%] h-px w-[19%] bg-black/[0.11]"
              style={{ transform: "rotate(28deg)" }}
            />

            {/* Additional microscopic seams */}
            <span
              className="absolute left-[34%] top-[18%] h-px w-[10%] bg-white/[0.1]"
              style={{ transform: "rotate(52deg)" }}
            />

            <span
              className="absolute right-[34%] top-[18%] h-px w-[10%] bg-black/[0.09]"
              style={{ transform: "rotate(-52deg)" }}
            />

            <span
              className="absolute left-[18%] top-[63%] h-px w-[12%] bg-white/[0.08]"
              style={{ transform: "rotate(-16deg)" }}
            />

            <span
              className="absolute right-[18%] top-[63%] h-px w-[12%] bg-black/[0.08]"
              style={{ transform: "rotate(16deg)" }}
            />

            {/* =====================================================
                INNER REFRACTION WINDOWS
                ===================================================== */}

            <div
              className="absolute inset-[27%] rounded-[38%] border border-white/[0.08]"
              style={{
                transform: "rotate(45deg) skew(-5deg, -5deg)",
              }}
            />

            <div
              className="absolute inset-[34%] rounded-[30%] border border-white/[0.045]"
              style={{
                transform: "rotate(-18deg) skew(3deg, 3deg)",
              }}
            />

            {/* =====================================================
                LIGHT TRAPPED INSIDE THE CRYSTAL
                ===================================================== */}

            <span className="absolute left-[23%] top-[16%] h-[13%] w-[18%] rounded-full bg-white/[0.3] blur-[1.5px]" />

            <span className="absolute left-[31%] top-[24%] h-[7%] w-[9%] rounded-full bg-white/[0.12] blur-[1px]" />

            <span className="absolute right-[23%] top-[27%] h-[5%] w-[6%] rounded-full bg-white/[0.7] blur-[0.5px]" />

            <span className="absolute left-[21%] top-[53%] h-[4%] w-[4%] rounded-full bg-white/[0.4]" />

            <span className="absolute right-[25%] top-[62%] h-[3%] w-[3%] rounded-full bg-white/[0.3]" />

            {/* Deep internal glints */}
            <span className="absolute left-[42%] top-[43%] h-[3%] w-[3%] rounded-full bg-white/[0.3]" />

            <span className="absolute right-[40%] bottom-[27%] h-[3%] w-[3%] rounded-full bg-white/[0.22]" />

            {/* Very faint internal light beam */}
            <span
              className="absolute left-[36%] top-[15%] h-[58%] w-[9%] bg-white/[0.025] blur-[2px]"
              style={{
                transform: "rotate(18deg)",
              }}
            />

            {/* =====================================================
                INTERNAL CRYSTAL GLOW
                ===================================================== */}

            {/* Soft colored light trapped inside the crystal */}
            <div
              className={`absolute inset-[16%] rounded-full opacity-50 blur-[7px] ${accent.inner}`}
              style={{
                clipPath:
                  "polygon(50% 4%, 76% 22%, 86% 50%, 70% 79%, 50% 96%, 30% 79%, 14% 50%, 24% 22%)",
              }}
            />

            {/* Concentrated inner glow */}
            <div
              className={`absolute left-[28%] top-[27%] h-[46%] w-[44%] rounded-full opacity-30 blur-[5px] ${accent.inner}`}
              style={{
                transform: "rotate(-12deg)",
              }}
            />

            {/* =====================================================
                CRYSTAL EDGE BLOOM
                ===================================================== */}

            <div
              className={`absolute inset-[4%] opacity-30 blur-[2px] ${
                unlocked ? accent.inner : ""
              }`}
              style={{
                clipPath:
                  "polygon(50% 0%, 68% 5%, 86% 17%, 96% 38%, 91% 68%, 78% 88%, 61% 98%, 50% 100%, 39% 98%, 22% 88%, 9% 68%, 4% 38%, 14% 17%, 32% 5%)",
              }}
            />

            {/* =====================================================
                SPECULAR SHINE
                ===================================================== */}

            {/* Main diagonal glass reflection */}
            <span
              className="absolute left-[18%] top-[13%] h-[2px] w-[62%] rounded-full bg-white/30 blur-[0.5px]"
              style={{
                transform: "rotate(35deg)",
              }}
            />

            {/* Secondary reflection */}
            <span
              className="absolute left-[31%] top-[23%] h-px w-[34%] rounded-full bg-white/25"
              style={{
                transform: "rotate(35deg)",
              }}
            />

            {/* Bright crystal point */}
            <span className="absolute left-[24%] top-[18%] h-1.5 w-1.5 rounded-full bg-white/65 blur-[0.5px]" />

            <span className="absolute right-[25%] top-[31%] h-1 w-1 rounded-full bg-white/60" />

            {/* Tiny internal spark */}
            <span className="absolute left-[43%] top-[39%] h-1 w-1 rounded-full bg-white/50 blur-[0.5px]" />

            {/* =====================================================
                DIFFUSED LIGHT LEAKS
                ===================================================== */}

            <span
              className={`absolute -left-[8%] top-[34%] h-[30%] w-[28%] rounded-full opacity-25 blur-[8px] ${accent.inner}`}
            />

            <span
              className={`absolute -right-[8%] top-[42%] h-[24%] w-[24%] rounded-full opacity-20 blur-[9px] ${accent.inner}`}
            />

            {/* =====================================================
                FINAL GLASS GLINT
                ===================================================== */}

            <span
              className="absolute left-[19%] top-[11%] h-[7%] w-[7%] rounded-full bg-white/55 blur-[1px]"
              style={{
                transform: "rotate(-20deg)",
              }}
            />
          </>
        )}
      </div>

      {/* =========================================================
          RAISED CENTRAL EMBLEM
          ========================================================= */}
      <div
        className={`relative z-10 flex items-center justify-center rounded-full border ${innerSizes[size]} ${
          unlocked
            ? "border-white/30 bg-black/10 shadow-inner dark:bg-white/5"
            : "border-border/50 bg-background/30"
        }`}
      >
        <Icon
          className={`${iconSizes[size]} ${
            unlocked ? accent.icon : "text-muted-foreground"
          }`}
        />
      </div>
    </div>
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
