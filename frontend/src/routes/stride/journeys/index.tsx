import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  CheckCircle2,
  CirclePause,
  Filter,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JourneyCardWithProgress } from "@/components/stride/journey-card";
import {
  useJourneys,
  useJourneyStats,
  usePauseJourney,
  useResumeJourney,
  useArchiveJourney,
} from "@/hooks/queries/use-stride";
import type { JourneyStatus } from "@/types/stride";

export const Route = createFileRoute("/stride/journeys/")({
  head: () => ({
    meta: [
      { title: "Journeys — Stride" },
      {
        name: "description",
        content: "Review, filter, and manage every personal journey in Stride.",
      },
    ],
  }),
  component: JourneysPage,
});

const STATUS_FILTERS: Array<{
  value: "all" | JourneyStatus;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

function JourneysPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JourneyStatus>(
    "all",
  );

  const { data: journeys, isLoading, error } = useJourneys();
  const pauseJourney = usePauseJourney();
  const resumeJourney = useResumeJourney();
  const archiveJourney = useArchiveJourney();

  const shown = useMemo(() => {
    if (!journeys) return [];

    return journeys.filter((j) => {
      if (j.is_archived && statusFilter !== "archived") return false;
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (query && !j.name.toLowerCase().includes(query.toLowerCase()))
        return false;

      return true;
    });
  }, [journeys, query, statusFilter]);

  const handlePause = (id: number, name: string) => {
    pauseJourney.mutate(id, {
      onSuccess: () => toast.success(`${name} paused`),
      onError: () => toast.error("Failed to pause journey"),
    });
  };

  const handleResume = (id: number, name: string) => {
    resumeJourney.mutate(id, {
      onSuccess: () => toast.success(`${name} resumed`),
      onError: () => toast.error("Failed to resume journey"),
    });
  };

  const handleArchive = (id: number, name: string) => {
    archiveJourney.mutate(id, {
      onSuccess: () => toast.success(`${name} archived`),
      onError: () => toast.error("Failed to archive journey"),
    });
  };

  const activeCount =
    journeys?.filter((journey) => journey.is_active && !journey.is_archived)
      .length ?? 0;

  const pausedCount =
    journeys?.filter((journey) => journey.is_paused && !journey.is_archived)
      .length ?? 0;

  const completedCount =
    journeys?.filter((journey) => journey.is_completed && !journey.is_archived)
      .length ?? 0;

  return (
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <PageIntro
              eyebrow="THE LONG VIEW"
              title="What are you moving toward?"
              description="The journeys you’re building, one milestone and one step at a time."
            />
          </div>

          <Button
            asChild
            className="w-full shrink-0 rounded-lg shadow-sm sm:w-auto"
          >
            <Link to="/stride/journeys/new">
              <Plus className="h-4 w-4" />
              New journey
            </Link>
          </Button>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <JourneySummary
            icon={CheckCircle2}
            label="Active"
            value={activeCount}
            iconClass="text-emerald-500"
            iconBgClass="bg-emerald-500/10"
            borderClass="border-emerald-500/20"
            isLoading={isLoading}
          />
          <JourneySummary
            icon={CirclePause}
            label="Paused"
            value={pausedCount}
            iconClass="text-amber-500"
            iconBgClass="bg-amber-500/10"
            borderClass="border-amber-500/20"
            isLoading={isLoading}
          />
          <JourneySummary
            icon={CheckCircle2}
            label="Completed"
            value={completedCount}
            iconClass="text-violet-500"
            iconBgClass="bg-violet-500/10"
            borderClass="border-violet-500/20"
            isLoading={isLoading}
          />
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3 shadow-sm backdrop-blur-sm">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search journeys…"
                aria-label="Search journeys"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
              <div className="flex h-7 shrink-0 items-center gap-1 px-2 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                <Filter className="h-3 w-3" />
                Filter
              </div>

              {STATUS_FILTERS.map(({ value, label }) => (
                <Button
                  key={value}
                  size="sm"
                  variant={statusFilter === value ? "secondary" : "ghost"}
                  onClick={() => setStatusFilter(value)}
                  className="h-7 rounded-lg px-2.5 text-[10px] font-semibold"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {(query || statusFilter !== "all") && (
            <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
              <span>
                Showing {shown.length} journey{shown.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
                className="font-semibold transition-colors hover:text-foreground"
              >
                Reset filters
              </button>
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <Skeleton key={key} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="overflow-hidden rounded-xl border border-status-no/30 bg-status-no/5 p-8 text-center shadow-sm">
            <p className="text-xs font-medium text-status-no">
              Unable to load journeys. Please try again.
            </p>
          </div>
        ) : shown.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((journey) => (
              <JourneyWithStats
                key={journey.id}
                journey={journey}
                onPause={() => handlePause(journey.id, journey.name)}
                onResume={() => handleResume(journey.id, journey.name)}
                onArchive={() => handleArchive(journey.id, journey.name)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80 p-9 text-center shadow-sm backdrop-blur-sm">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10">
              <Search className="h-4 w-4 text-sky-500" />
            </div>
            <p className="mt-3 text-xs font-semibold">No journeys found</p>
            <p className="mt-1 max-w-sm mx-auto text-[10px] leading-relaxed text-muted-foreground">
              Try a different search or filter, or start a new journey.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(query || statusFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                  }}
                  className="h-8 rounded-lg text-[10px]"
                >
                  Clear filters
                </Button>
              )}

              <Button asChild size="sm" className="h-8 rounded-lg text-[10px]">
                <Link to="/stride/journeys/new">
                  <Plus className="h-3.5 w-3.5" />
                  New journey
                </Link>
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border/50 pt-4">
          <p className="text-[10px] text-muted-foreground">
            {shown.length > 0
              ? `${shown.length} journey${shown.length === 1 ? "" : "s"} in view`
              : "No journeys in view"}
          </p>

          <Link
            to="/stride/archive"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          >
            <Archive className="h-3 w-3" />
            View archived
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function JourneySummary({
  icon: Icon,
  label,
  value,
  iconClass,
  iconBgClass,
  borderClass,
  isLoading,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  iconClass: string;
  iconBgClass: string;
  borderClass: string;
  isLoading: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border ${borderClass} bg-card/80 p-4 shadow-sm backdrop-blur-sm`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
      >
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>

      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        {isLoading ? (
          <Skeleton className="mt-1 h-5 w-8 rounded-md" />
        ) : (
          <p className={`mt-0.5 text-lg font-bold tracking-tight ${iconClass}`}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

function JourneyWithStats({
  journey,
  onPause,
  onResume,
  onArchive,
}: {
  journey: import("@/types/stride").JourneyResponse;
  onPause: () => void;
  onResume: () => void;
  onArchive: () => void;
}) {
  const { data: stats } = useJourneyStats(journey.id);

  const percentage =
    stats?.progress.percentage ?? (journey.is_completed ? 100 : 0);

  const currentValue = stats?.progress.current_value;

  return (
    <JourneyCardWithProgress
      journey={journey}
      percentage={percentage}
      currentValue={currentValue}
      onPause={journey.is_active ? onPause : undefined}
      onResume={journey.is_paused ? onResume : undefined}
      onArchive={
        !journey.is_archived && !journey.is_completed ? onArchive : undefined
      }
    />
  );
}