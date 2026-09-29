import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JourneyCard } from "@/components/stride/journey-card";
import { PageHeader, EmptyState } from "@/components/stride/page-header";
import { useJourneys, useReopenJourney } from "@/hooks/queries/use-stride";

export const Route = createFileRoute("/stride/archive")({
  head: () => ({
    meta: [
      { title: "Archive — Stride" },
      {
        name: "description",
        content: "Review and restore journeys you have archived in Stride.",
      },
    ],
  }),
  component: StrideArchivePage,
});

function StrideArchivePage() {
  const { data: journeys, isLoading, error } = useJourneys();
  const reopenJourney = useReopenJourney();

  const archived = journeys?.filter((j) => j.is_archived) ?? [];

  const handleRestore = (id: number, name: string) => {
    reopenJourney.mutate(id, {
      onSuccess: () => toast.success(`${name} restored to active`),
      onError: () => toast.error("Failed to restore journey"),
    });
  };

  return (
    <AppShell headerTitle="Archive">
      <div className="animate-fade-up space-y-8 pb-12">
        <Link
          to="/stride/journeys"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Journeys
        </Link>

        <PageHeader
          eyebrow="Set aside, not lost"
          title="Archive"
          description="Restore a journey whenever it becomes meaningful again."
        />

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Unable to load archived journeys.
            </p>
          </div>
        ) : archived.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((journey) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                onRestore={() => handleRestore(journey.id, journey.name)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Archive size={20} />}
            title="The archive is empty"
            body="Journeys you set aside will stay safely available here."
            action={
              <Button asChild variant="outline">
                <Link to="/stride/journeys">
                  <RotateCcw size={16} />
                  View journeys
                </Link>
              </Button>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
