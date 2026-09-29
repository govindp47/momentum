import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JourneyCardWithProgress } from "@/components/stride/journey-card";
import { PageHeader, EmptyState } from "@/components/stride/page-header";
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

const STATUS_FILTERS: Array<{ value: "all" | JourneyStatus; label: string }> = [
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

  return (
    <AppShell headerTitle="Journeys">
      <div className="animate-fade-up space-y-8 pb-12">
        <PageHeader
          eyebrow="The long view"
          title="Journeys"
          description="Everything you are moving toward, gathered in one calm place."
          action={
            <Button asChild>
              <Link to="/stride/journeys/new">
                <Plus size={17} />
                New journey
              </Link>
            </Button>
          }
        />

        {/* Search + filter bar */}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card/60 px-3">
            <Search size={16} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search journeys…"
              aria-label="Search journeys"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-border bg-card/60 p-1">
            {STATUS_FILTERS.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant={statusFilter === value ? "secondary" : "ghost"}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Journey grid */}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4].map((k) => (
              <Skeleton key={k} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
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
          <EmptyState
            icon={<Search size={20} />}
            title="No journeys found"
            body="Try a different search or filter, or start a new journey."
            action={
              <Button asChild>
                <Link to="/stride/journeys/new">
                  <Plus size={16} />
                  New journey
                </Link>
              </Button>
            }
          />
        )}

        <Link
          to="/stride/archive"
          className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Archive size={14} />
          View archived journeys
        </Link>
      </div>
    </AppShell>
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
