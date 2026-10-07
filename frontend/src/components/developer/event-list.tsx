import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  BackendLogEventResponse,
  FrontendErrorEventResponse,
} from "@/types/developer";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function SeverityBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 text-[10px] rounded-3xl uppercase tracking-wide",
        normalized === "warning" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        normalized === "error" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        normalized === "critical" &&
          "border-destructive bg-destructive text-destructive-foreground",
        normalized === "info" &&
          "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        normalized === "debug" && "text-muted-foreground",
      )}
    >
      {level}
    </Badge>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">{children}</dl>;
}

function Detail({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs text-foreground">
        {String(value)}
      </dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Trace({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium">{label}</p>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border/70 bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground">
        {value}
      </pre>
    </div>
  );
}

function Metadata({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) return null;
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border border-border/70 bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function FrontendDetails({ event }: { event: FrontendErrorEventResponse }) {
  return (
    <div className="space-y-5 border-t border-border/70 px-4 py-4 sm:px-5">
      <DetailSection title="Summary">
        <DetailGrid>
          <Detail label="Severity" value={event.level} />
          <Detail label="Timestamp" value={formatTimestamp(event.timestamp)} />
          <Detail label="Source" value={event.source} />
          <Detail label="Error name" value={event.error_name} />
          <Detail label="Message" value={event.message} />
          <Detail label="Fingerprint" value={event.fingerprint} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Request">
        <DetailGrid>
          <Detail label="Method" value={event.http_method} />
          <Detail label="Endpoint" value={event.endpoint} />
          <Detail label="Route" value={event.route} />
          <Detail label="Status" value={event.status_code} />
          <Detail label="URL" value={event.url} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Runtime">
        <DetailGrid>
          <Detail label="Application version" value={event.app_version} />
          <Detail label="User agent" value={event.user_agent} />
          <Detail
            label="Viewport"
            value={`${event.viewport_width} × ${event.viewport_height}`}
          />
          <Detail label="Online" value={event.online_status ? "Yes" : "No"} />
        </DetailGrid>
      </DetailSection>

      {(event.stack || event.component_stack || event.cause) && (
        <DetailSection title="Exception">
          <div className="space-y-3">
            <Trace label="Stack trace" value={event.stack} />
            <Trace label="Component stack" value={event.component_stack} />
            <Trace label="Cause" value={event.cause} />
          </div>
        </DetailSection>
      )}

      <DetailSection title="Context">
        <DetailGrid>
          <Detail label="Operation" value={event.operation} />
          <Detail label="Component" value={event.component} />
          <Detail label="File" value={event.filename} />
          <Detail label="Line" value={event.error_lineno} />
          <Detail label="Column" value={event.error_colno} />
          <Detail label="Stored" value={formatTimestamp(event.created_at)} />
        </DetailGrid>
        <Metadata value={event.metadata} />
      </DetailSection>
    </div>
  );
}

function BackendDetails({ event }: { event: BackendLogEventResponse }) {
  return (
    <div className="space-y-5 border-t border-border/70 px-4 py-4 sm:px-5">
      <DetailSection title="Summary">
        <DetailGrid>
          <Detail label="Severity" value={event.level} />
          <Detail label="Timestamp" value={formatTimestamp(event.timestamp)} />
          <Detail label="Source" value={event.source} />
          <Detail label="Logger" value={event.logger_name} />
          <Detail label="Exception" value={event.exception_type} />
          <Detail label="Fingerprint" value={event.fingerprint} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Request">
        <DetailGrid>
          <Detail label="Method" value={event.method} />
          <Detail label="Path" value={event.path} />
          <Detail label="Route" value={event.route} />
          <Detail label="Status" value={event.status_code} />
          <Detail label="Request ID" value={event.request_id} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Runtime">
        <DetailGrid>
          <Detail
            label="Application version"
            value={event.application_version}
          />
          <Detail label="Environment" value={event.environment} />
          <Detail label="Python" value={event.python_version} />
          <Detail label="Process" value={event.process_id} />
          <Detail label="Thread" value={event.thread_id} />
          <Detail label="Module" value={event.module} />
          <Detail label="Function" value={event.function} />
        </DetailGrid>
      </DetailSection>

      {event.traceback && (
        <DetailSection title="Exception">
          <Trace label="Traceback" value={event.traceback} />
        </DetailSection>
      )}

      <DetailSection title="Context">
        <DetailGrid>
          <Detail label="Operation" value={event.operation} />
          <Detail label="Component" value={event.component} />
          <Detail label="Stored" value={formatTimestamp(event.created_at)} />
        </DetailGrid>
        <Metadata value={event.metadata} />
      </DetailSection>
    </div>
  );
}

type EventListProps =
  | { kind: "frontend"; events: FrontendErrorEventResponse[] }
  | { kind: "backend"; events: BackendLogEventResponse[] };

function EventCards({
  events,
  expanded,
  setExpanded,
  kind,
}: {
  events: Array<{
    db_id: number;
    level: string;
    message: string;
    timestamp: string;
    location: string;
    context: string | null;
    details: React.ReactNode;
  }>;
  expanded: string | null;
  setExpanded: (value: string | null) => void;
  kind: "frontend" | "backend";
}) {
  return (
    <div className="space-y-3">
      {events.map((event) => {
        const key = `${kind}-${event.db_id}`;
        const isExpanded = expanded === key;

        return (
          <article
            key={key}
            className="overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-sm transition-colors hover:border-border"
          >
            <button
              type="button"
              className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
              aria-expanded={isExpanded}
              onClick={() => setExpanded(isExpanded ? null : key)}
            >
              <SeverityBadge level={event.level} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="break-words text-sm font-semibold leading-5 text-foreground">
                    {event.message}
                  </span>
                  <time
                    className="shrink-0 text-[11px] font-medium text-muted-foreground"
                    dateTime={event.timestamp}
                  >
                    {formatTimestamp(event.timestamp)}
                  </time>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="text-[12px] font-medium">
                    {event.location}
                  </span>
                  {event.context && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold tracking-[0.08em] text-status-no">
                        {event.context}
                      </span>
                    </span>
                  )}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180",
                )}
              />
            </button>
            {isExpanded && event.details}
          </article>
        );
      })}
    </div>
  );
}

export function EventList(props: EventListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (props.kind === "frontend") {
    return (
      <EventCards
        kind="frontend"
        expanded={expanded}
        setExpanded={setExpanded}
        events={props.events.map((event) => ({
          db_id: event.db_id,
          level: event.level,
          message: event.message,
          timestamp: event.timestamp,
          location: event.endpoint || event.route || event.source,
          context: event.error_name,
          details: <FrontendDetails event={event} />,
        }))}
      />
    );
  }

  return (
    <EventCards
      kind="backend"
      expanded={expanded}
      setExpanded={setExpanded}
      events={props.events.map((event) => ({
        db_id: event.db_id,
        level: event.level,
        message: event.message,
        timestamp: event.timestamp,
        location: event.path || event.route || event.logger_name,
        context: event.exception_type,
        details: <BackendDetails event={event} />,
      }))}
    />
  );
}
