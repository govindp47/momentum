import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Check,
  Flame,
  Gauge,
  Milestone,
  Mountain,
  Plus,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressDialog } from "@/components/stride/progress-dialog";
import {
  JourneyCardWithProgress,
  formatValue,
} from "@/components/stride/journey-card";
import {
  useStrideDashboard,
  useJourneyMilestones,
} from "@/hooks/queries/use-stride";
import { formatPercentage } from "@/lib/utils";

export const Route = createFileRoute("/stride/today")({
  head: () => ({
    meta: [
      { title: "Today — Stride" },
      {
        name: "description",
        content:
          "See your active journeys, recent momentum, milestones, and daily progress in Stride.",
      },
    ],
  }),
  component: StrideTodayPage,
});

// Simple activity bar heights for visual rhythm (static decorative data)
const ACTIVITY_HEIGHTS = [28, 54, 34, 74, 44, 88, 63];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function StrideTodayPage() {
  const { data, isLoading, error } = useStrideDashboard();
  const [logOpen, setLogOpen] = useState(false);

  const activeJourneys =
    data?.journeys.filter((dj) => dj.journey.is_active).slice(0, 4) ?? [];

  const todayTotal = Object.values(data?.today_activity ?? {}).reduce(
    (sum, activity) => sum + (activity.total_value ?? 0),
    0,
  );

  const todayCount = Object.keys(data?.today_activity ?? {}).length;

  const focusJourney = activeJourneys[0];
  const focusJourneyId = focusJourney?.journey.id;

  const streak = activeJourneys[0]?.streak.current_streak ?? 0;

  const now = new Date();
  const dayName = now.toLocaleDateString(undefined, { weekday: "long" });
  const dateName = now.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        {/* ── Page introduction ───────────────────────────────────────── */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <PageIntro
              eyebrow={`${dayName.toUpperCase()} · ${dateName.toUpperCase()}`}
              title="Keep moving forward."
              description="Your journeys are moving. Keep the rhythm going today."
            />
          </div>

          <Button
            onClick={() => setLogOpen(true)}
            className="w-full shrink-0 rounded-lg shadow-sm sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Log progress</span>
            <span className="sm:hidden">Log progress</span>
          </Button>
        </section>

        {/* ── Momentum + Today ────────────────────────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.8fr)]">
          {/* Momentum */}
          <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="relative flex flex-col justify-between gap-7 sm:flex-row">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-orange-500/25 bg-orange-500/10">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                  </span>
                  Current momentum
                </div>

                {isLoading ? (
                  <Skeleton className="mt-5 h-14 w-28 rounded-lg" />
                ) : (
                  <>
                    <div className="mt-5 flex items-end gap-3">
                      <span className="text-5xl font-bold tracking-tight md:text-6xl">
                        {streak}
                      </span>

                      <span className="mb-2 text-xs font-medium text-muted-foreground">
                        day streak
                      </span>
                    </div>

                    <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
                      {activeJourneys.length > 0
                        ? `${activeJourneys.length} active journey${activeJourneys.length > 1 ? "s" : ""} in motion.`
                        : "Start a journey to build your streak."}
                    </p>
                  </>
                )}
              </div>

              {/* Activity bars */}
              <div
                className="flex items-end gap-2"
                aria-label="Decorative activity chart"
              >
                {ACTIVITY_HEIGHTS.map((height, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`w-5 rounded-t-md transition-colors md:w-6 ${
                        index === 6
                          ? "bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.18)]"
                          : "bg-primary/20"
                      }`}
                      style={{ height }}
                    />

                    <span className="text-[8px] font-medium text-muted-foreground">
                      {DAYS[index]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's activity */}
          <div className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Today
              </p>

              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </span>
            </div>

            {isLoading ? (
              <Skeleton className="mt-5 h-9 w-24 rounded-lg" />
            ) : (
              <>
                <div className="mt-5 text-3xl font-bold tracking-tight">
                  {formatValue(todayTotal)}
                </div>

                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  progress logged across {todayCount} update
                  {todayCount === 1 ? "" : "s"}
                </p>
              </>
            )}

            {!isLoading && todayTotal > 0 && (
              <div className="mt-5 flex items-center gap-2 text-[10px] font-semibold text-emerald-500">
                <Check className="h-3.5 w-3.5" />
                One meaningful step today
              </div>
            )}
          </div>
        </section>

        {/* ── Active journeys ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                In motion
              </p>

              <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
                Active journeys
              </h2>
            </div>

            <Link
              to="/stride/journeys"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[1, 2].map((key) => (
                <Skeleton key={key} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-status-no/30 bg-status-no/5 p-6 text-center shadow-sm">
              <p className="text-xs font-medium text-status-no">
                Unable to load journeys.
              </p>
            </div>
          ) : activeJourneys.length === 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-card/80 p-8 text-center shadow-sm backdrop-blur-sm">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-secondary/70 text-muted-foreground">
                <Mountain className="h-4 w-4" />
              </div>

              <p className="mt-3 text-xs font-semibold">
                No active journeys yet.
              </p>

              <p className="mt-1 text-[10px] text-muted-foreground">
                Start something worth moving toward.
              </p>

              <Link
                to="/stride/journeys/new"
                className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
              >
                Create a journey
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activeJourneys.map((journey) => (
                <JourneyCardWithProgress
                  key={journey.journey.id}
                  journey={journey.journey}
                  percentage={journey.progress.percentage}
                  currentValue={journey.progress.current_value}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Milestones + Pace / Achievement ─────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-2">
          <MilestonePath journeyId={focusJourneyId} />

          <div className="space-y-4">
            {/* Pace */}
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Pace
                  </p>

                  {isLoading ? (
                    <Skeleton className="mt-2 h-7 w-36 rounded-lg" />
                  ) : (
                    <h2 className="mt-1 text-xl font-bold tracking-tight">
                      {activeJourneys[0]?.streak.active_days ?? 0} active days
                    </h2>
                  )}
                </div>

                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10">
                  <Gauge className="h-4 w-4 text-sky-500" />
                </span>
              </div>

              {!isLoading && activeJourneys[0] && (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <StatTile
                    value={String(activeJourneys[0].streak.current_streak)}
                    label="streak"
                    accent="orange"
                  />

                  <StatTile
                    value={String(activeJourneys[0].streak.longest_streak)}
                    label="best"
                    accent="violet"
                  />

                  <StatTile
                    value={String(activeJourneys[0].streak.active_days)}
                    label="days"
                    accent="sky"
                  />
                </div>
              )}
            </div>

            {/* Achievements */}
            <Link
              to="/stride/achievements"
              className="group block overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-accent/20 hover:shadow-md md:p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10">
                  <Trophy className="h-4 w-4 text-amber-500" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Achievements
                  </p>

                  <h3 className="mt-1 text-sm font-bold tracking-tight">
                    View your badges
                  </h3>
                </div>

                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                Earn achievements through consistent progress across your
                journeys.
              </p>
            </Link>
          </div>
        </section>

        {/* ── Closest active journey ──────────────────────────────────── */}
        {focusJourney && (
          <div className="flex items-center justify-between gap-4 overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Closest active journey
              </p>

              <p className="mt-1 truncate text-xs font-semibold">
                {focusJourney.journey.name} ·{" "}
                {formatPercentage(focusJourney.progress.percentage)} ·{" "}
                {formatValue(focusJourney.progress.remaining)}
                {focusJourney.journey.unit
                  ? ` ${focusJourney.journey.unit}`
                  : ""}{" "}
                left
              </p>
            </div>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
            </span>
          </div>
        )}
      </div>

      <ProgressDialog open={logOpen} onOpenChange={setLogOpen} />
    </AppShell>
  );
}

function MilestonePath({
  journeyId,
}: {
  journeyId: number | undefined;
}) {
  const { data: milestones, isLoading } = useJourneyMilestones(journeyId);

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Up next
          </p>

          <h2 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
            Milestone path
          </h2>
        </div>

        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10">
          <Milestone className="h-4 w-4 text-violet-500" />
        </span>
      </div>

      {isLoading ? (
        <div className="mt-7 space-y-4">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-7 w-full rounded-lg" />
          ))}
        </div>
      ) : !journeyId ? (
        <div className="mt-7 rounded-lg border border-border/60 bg-background/20 p-4 text-xs text-muted-foreground">
          No active journey selected.
        </div>
      ) : milestones && milestones.length > 0 ? (
        <div className="mt-7 space-y-0">
          {milestones.map((milestone, index, items) => (
            <div className="flex gap-3.5" key={milestone.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                    milestone.is_completed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-border/70 bg-secondary/70 text-muted-foreground"
                  }`}
                >
                  {milestone.is_completed ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </div>

                {index < items.length - 1 && (
                  <div
                    className={`h-9 w-px ${
                      milestone.is_completed
                        ? "bg-emerald-500/30"
                        : "bg-border/70"
                    }`}
                  />
                )}
              </div>

              <div
                className={`pt-1 text-xs ${
                  milestone.is_completed
                    ? "font-semibold text-foreground"
                    : "font-medium text-muted-foreground"
                }`}
              >
                {milestone.name}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-7 rounded-lg border border-border/60 bg-background/20 p-4 text-xs text-muted-foreground">
          No milestones set for this journey.
        </div>
      )}
    </div>
  );
}

function StatTile({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: "orange" | "violet" | "sky";
}) {
  const accentClasses = {
    orange: "border-orange-500/20 bg-orange-500/5",
    violet: "border-violet-500/20 bg-violet-500/5",
    sky: "border-sky-500/20 bg-sky-500/5",
  };

  const valueClasses = {
    orange: "text-orange-500",
    violet: "text-violet-500",
    sky: "text-sky-500",
  };

  return (
    <div
      className={`rounded-lg border p-3 text-center ${accentClasses[accent]}`}
    >
      <div
        className={`text-base font-bold tracking-tight ${valueClasses[accent]}`}
      >
        {value}
      </div>

      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}