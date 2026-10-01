import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageIntro } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JourneyCard } from "@/components/stride/journey-card";
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
    <AppShell subApp="stride">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-7 pb-12 md:space-y-8">
        <Link
          to="/stride/journeys"
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Journeys
        </Link>

        <section>
          <PageIntro
            eyebrow="SET ASIDE, NOT LOST"
            title="Where the old paths rest."
            description="Restore a journey whenever it becomes meaningful again."
          />
        </section>

        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-500/20 bg-slate-500/10">
              <Archive className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">Archived journeys</p>
              <p className="text-[10px] text-muted-foreground">
                Kept here until you are ready to continue.
              </p>
            </div>
          </div>

          {!isLoading && !error && (
            <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1 text-[9px] font-semibold text-muted-foreground">
              {archived.length} {archived.length === 1 ? "journey" : "journeys"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((k) => (
              <Skeleton
                key={k}
                className="h-40 rounded-xl border border-border/50"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-status-no/20 bg-status-no/5 p-7 text-center shadow-sm">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-status-no/20 bg-status-no/10">
              <Archive className="h-4 w-4 text-status-no" />
            </div>
            <p className="mt-3 text-xs font-semibold">
              Unable to load archived journeys
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Something went wrong while loading your archive.
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
          <div className="rounded-xl border border-border/70 bg-card/80 p-8 text-center shadow-sm backdrop-blur-sm">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
              <Archive className="h-4.5 w-4.5 text-sky-500" />
            </div>

            <h2 className="mt-4 text-sm font-bold tracking-tight">
              The archive is empty
            </h2>

            <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-muted-foreground">
              Journeys you set aside will stay safely available here until you
              decide to bring them back.
            </p>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-5 h-8 rounded-lg border-border/70 bg-background/40 px-3 text-[10px]"
            >
              <Link to="/stride/journeys">
                <RotateCcw className="h-3.5 w-3.5" />
                View journeys
              </Link>
            </Button>
          </div>
        )}

        {!isLoading && !error && archived.length > 0 && (
          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <p className="text-[9px] text-muted-foreground">
              {archived.length} archived{" "}
              {archived.length === 1 ? "journey" : "journeys"}
            </p>

            <Link
              to="/stride/journeys"
              className="text-[9px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to journeys
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}