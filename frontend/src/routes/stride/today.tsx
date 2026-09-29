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
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ProgressDialog } from "@/components/stride/progress-dialog";
import {
  JourneyCardWithProgress,
  formatValue,
} from "@/components/stride/journey-card";
import {
  useStrideDashboard,
  useJourneyMilestones,
} from "@/hooks/queries/use-stride";

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
    (sum, a) => sum + (a.total_value ?? 0),
    0,
  );
  const todayCount = Object.keys(data?.today_activity ?? {}).length;

  // For the milestone path we show the focus journey's milestones
  const focusJourney = activeJourneys[0];
  const focusJourneyId = focusJourney?.journey.id;

  // Streak from first active journey
  const streak = activeJourneys[0]?.streak.current_streak ?? 0;

  const now = new Date();
  const dayName = now.toLocaleDateString(undefined, { weekday: "long" });
  const dateName = now.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell headerTitle="Today">
      <div className="animate-fade-up space-y-12 pb-12">
        {/* Hero greeting */}
        <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative mt-1 flex size-12 shrink-0 items-center justify-center">
              <div className="absolute inset-0 rotate-45 rounded-xl border border-primary/30 bg-primary/10 shadow-glow" />
              <Mountain className="relative text-primary" size={23} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {dayName} · {dateName}
              </p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
                Good morning.
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Your journeys are moving. Keep the rhythm going today.
              </p>
            </div>
          </div>
          <Button onClick={() => setLogOpen(true)}>
            <Plus size={17} />
            <span className="hidden sm:inline">Log progress</span>
          </Button>
        </section>

        {/* Momentum + Today cards */}
        <section className="grid gap-4 xl:grid-cols-[1.45fr_.8fr]">
          {/* Streak/momentum */}
          <div className="glass-strong relative overflow-hidden rounded-xl p-6 sm:p-7">
            <div className="relative flex flex-col justify-between gap-8 sm:flex-row">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <Flame size={14} className="text-primary" />
                  Current momentum
                </div>
                {isLoading ? (
                  <Skeleton className="mt-5 h-16 w-32" />
                ) : (
                  <>
                    <div className="mt-5 flex items-end gap-3">
                      <span className="text-6xl font-bold">{streak}</span>
                      <span className="mb-2 text-sm text-muted-foreground">
                        day streak
                      </span>
                    </div>
                    <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                      {activeJourneys.length > 0
                        ? `${activeJourneys.length} active journey${activeJourneys.length > 1 ? "s" : ""} in motion.`
                        : "Start a journey to build your streak."}
                    </p>
                  </>
                )}
              </div>
              {/* Activity bars (decorative) */}
              <div
                className="flex items-end gap-2"
                aria-label="Decorative activity chart"
              >
                {ACTIVITY_HEIGHTS.map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div
                      className={`activity-bar w-7 rounded-t-md ${i === 6 ? "bg-primary" : "bg-primary/30"}`}
                      style={{ height: h }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {DAYS[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's activity summary */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Today
              </p>
              <Sparkles size={16} className="text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="mt-5 h-10 w-24" />
            ) : (
              <>
                <div className="mt-5 text-3xl font-bold">
                  {formatValue(todayTotal)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  progress logged across {todayCount} update
                  {todayCount === 1 ? "" : "s"}
                </p>
              </>
            )}
            {!isLoading && todayTotal > 0 && (
              <div className="mt-6 flex items-center gap-2 text-xs text-primary">
                <Check size={14} />
                One meaningful step today
              </div>
            )}
          </div>
        </section>

        {/* Active journeys */}
        <section>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                In motion
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                Active journeys
              </h2>
            </div>
            <Link
              to="/stride/journeys"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[1, 2].map((k) => (
                <Skeleton key={k} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="mt-4 glass rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Unable to load journeys.
              </p>
            </div>
          ) : activeJourneys.length === 0 ? (
            <div className="mt-4 glass rounded-xl p-8 text-center">
              <p className="text-muted-foreground">
                No active journeys yet.{" "}
                <Link
                  to="/stride/journeys/new"
                  className="text-primary hover:underline"
                >
                  Create one
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activeJourneys.map((dj) => (
                <JourneyCardWithProgress
                  key={dj.journey.id}
                  journey={dj.journey}
                  percentage={dj.progress.percentage}
                  currentValue={dj.progress.current_value}
                />
              ))}
            </div>
          )}
        </section>

        {/* Milestone path + Pace + Achievement */}
        <section className="grid gap-4 lg:grid-cols-2">
          <MilestonePath journeyId={focusJourneyId} />

          <div className="space-y-4">
            {/* Pace card */}
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Pace
                  </p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-8 w-36" />
                  ) : (
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">
                      {activeJourneys[0]?.streak.active_days ?? 0} active days
                    </h2>
                  )}
                </div>
                <Gauge size={22} className="text-primary" />
              </div>
              {!isLoading && activeJourneys[0] && (
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  <StatTile
                    value={String(activeJourneys[0].streak.current_streak)}
                    label="streak"
                  />
                  <StatTile
                    value={String(activeJourneys[0].streak.longest_streak)}
                    label="best"
                  />
                  <StatTile
                    value={String(activeJourneys[0].streak.active_days)}
                    label="days"
                  />
                </div>
              )}
            </div>

            {/* Achievements teaser */}
            <Link
              to="/stride/achievements"
              className="glass block rounded-xl p-6 hover:shadow-glow transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Trophy size={19} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Achievements
                  </p>
                  <h3 className="mt-1 text-base font-semibold">
                    View your badges
                  </h3>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Earn achievements through consistent progress across your
                journeys.
              </p>
            </Link>
          </div>
        </section>

        {/* Closest active journey bar */}
        {focusJourney && (
          <div className="glass flex items-center justify-between rounded-xl p-5">
            <div>
              <p className="text-xs text-muted-foreground">
                Closest active journey
              </p>
              <p className="mt-1 text-sm">
                {focusJourney.journey.name} · {focusJourney.progress.percentage}
                % · {formatValue(focusJourney.progress.remaining)}
                {focusJourney.journey.unit
                  ? ` ${focusJourney.journey.unit}`
                  : ""}{" "}
                left
              </p>
            </div>
            <Activity size={18} className="text-primary" />
          </div>
        )}
      </div>

      <ProgressDialog open={logOpen} onOpenChange={setLogOpen} />
    </AppShell>
  );
}

function MilestonePath({ journeyId }: { journeyId: number | undefined }) {
  const { data: milestones, isLoading } = useJourneyMilestones(journeyId);

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Up next
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Milestone path
          </h2>
        </div>
        <Milestone className="text-primary" size={20} />
      </div>

      {isLoading ? (
        <div className="mt-7 space-y-4">
          {[1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-7 w-full" />
          ))}
        </div>
      ) : !journeyId ? (
        <p className="mt-7 text-sm text-muted-foreground">
          No active journey selected.
        </p>
      ) : milestones && milestones.length > 0 ? (
        <div className="mt-7 space-y-0">
          {milestones.map((m, i, arr) => (
            <div className="flex gap-4" key={m.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-7 items-center justify-center rounded-full border text-xs ${
                    m.is_completed
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {m.is_completed ? <Check size={13} /> : i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={`h-9 w-px ${m.is_completed ? "bg-primary/35" : "bg-border"}`}
                  />
                )}
              </div>
              <div className="pt-1 text-sm">{m.name}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-7 text-sm text-muted-foreground">
          No milestones set for this journey.
        </p>
      )}
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="text-base font-bold">{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
