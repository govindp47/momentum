import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bug,
  LoaderCircle,
  RefreshCw,
  Server,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import {
  BackendEventFilters,
  FrontendEventFilters,
} from "@/components/developer/event-filters";
import { EventList } from "@/components/developer/event-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useBackendLogs,
  useFrontendErrors,
} from "@/hooks/queries/use-developer-events";
import {
  DEFAULT_BACKEND_FILTERS,
  DEFAULT_FRONTEND_FILTERS,
} from "@/lib/developer-filters";
import type {
  BackendLogFilters,
  FrontendErrorFilters,
} from "@/types/developer";

export const Route = createFileRoute("/developer/events")({
  head: () => ({
    meta: [
      { title: "Errors & Logs · Momentum" },
      {
        name: "description",
        content:
          "Inspect frontend errors and backend logs captured by Momentum.",
      },
    ],
  }),
  component: DeveloperEventsPage,
});

type EventTab = "frontend" | "backend";

function LoadingEvents() {
  return (
    <div className="space-y-3" aria-label="Loading diagnostic events">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="rounded-xl border border-border/70 bg-card/80 p-5 shadow-sm"
        >
          <div className="flex gap-3">
            <Skeleton className="h-5 w-16" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventsError({
  kind,
  onRetry,
}: {
  kind: EventTab;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-card/80 shadow-sm">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <h3 className="mt-3 text-sm font-semibold">
          {kind === "frontend" ? "Frontend errors" : "Backend logs"} couldn't
          load
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Check that developer mode is still enabled and try again.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 rounded-lg"
          onClick={onRetry}
        >
          <RefreshCw /> Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyEvents({ kind }: { kind: EventTab }) {
  const Icon = kind === "frontend" ? Bug : Server;
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-sm font-semibold">
          {kind === "frontend" ? "No frontend errors" : "No backend events"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing has been {kind === "frontend" ? "captured" : "recorded"} for
          the selected filters.
        </p>
      </CardContent>
    </Card>
  );
}

function DeveloperEventsPage() {
  const [tab, setTab] = useState<EventTab>("frontend");
  const [frontendFilters, setFrontendFilters] = useState<FrontendErrorFilters>(
    DEFAULT_FRONTEND_FILTERS,
  );
  const [backendFilters, setBackendFilters] = useState<BackendLogFilters>(
    DEFAULT_BACKEND_FILTERS,
  );
  const frontend = useFrontendErrors(frontendFilters, tab === "frontend");
  const backend = useBackendLogs(backendFilters, tab === "backend");
  const activeQuery = tab === "frontend" ? frontend : backend;

  return (
    <AppShell subApp="dashboard">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Tabs value={tab} onValueChange={(value) => setTab(value as EventTab)}>
          <div className="flex items-center justify-between gap-3">
            <TabsList
              aria-label="Diagnostic event source"
              className="rounded-lg bg-primary/20 text-muted-foreground"
            >
              <TabsTrigger
                value="frontend"
                className="gap-2 rounded-xl data-[state=active]:bg-primary-foreground data-[state=active]:text-primary data-[state=active]:shadow-md"
              >
                <Bug className="h-3.5 w-3.5" /> Frontend Errors
              </TabsTrigger>
              <TabsTrigger
                value="backend"
                className="gap-2 rounded-xl data-[state=active]:bg-primary-foreground data-[state=active]:text-primary data-[state=active]:shadow-md"
              >
                <Server className="h-3.5 w-3.5" /> Backend Logs
              </TabsTrigger>
            </TabsList>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-2xl"
              disabled={activeQuery.isFetching}
              onClick={() => void activeQuery.refetch()}
            >
              {activeQuery.isFetching ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh
            </Button>
          </div>

          <TabsContent value="frontend" className="mt-5 space-y-5">
            <FrontendEventFilters
              filters={frontendFilters}
              onApply={setFrontendFilters}
            />
            {frontend.isPending ? (
              <LoadingEvents />
            ) : frontend.isError ? (
              <EventsError
                kind="frontend"
                onRetry={() => void frontend.refetch()}
              />
            ) : frontend.data.length === 0 ? (
              <EmptyEvents kind="frontend" />
            ) : (
              <EventList kind="frontend" events={frontend.data} />
            )}
          </TabsContent>

          <TabsContent value="backend" className="mt-5 space-y-5">
            <BackendEventFilters
              filters={backendFilters}
              onApply={setBackendFilters}
            />
            {backend.isPending ? (
              <LoadingEvents />
            ) : backend.isError ? (
              <EventsError
                kind="backend"
                onRetry={() => void backend.refetch()}
              />
            ) : backend.data.length === 0 ? (
              <EmptyEvents kind="backend" />
            ) : (
              <EventList kind="backend" events={backend.data} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
