import {
  AlertCircle,
  AlertTriangle,
  Braces,
  Bug,
  ChevronDown,
  CircleAlert,
  Clock3,
  Code2,
  Info,
  MapPin,
  Server,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

function getSeverityStyles(level: string) {
  const normalized = level.toLowerCase();

  if (normalized === "critical") {
    return {
      Icon: CircleAlert,
      accent: "border-l-destructive",
      icon: "bg-destructive text-destructive-foreground shadow-destructive/20",
      badge: "border-destructive bg-destructive text-destructive-foreground",
    };
  }

  if (normalized === "error") {
    return {
      Icon: AlertCircle,
      accent: "border-l-destructive/70",
      icon: "bg-destructive/10 text-destructive",
      badge: "border-destructive/40 bg-destructive/10 text-destructive",
    };
  }

  if (normalized === "warning") {
    return {
      Icon: AlertTriangle,
      accent: "border-l-amber-500/70",
      icon: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
      badge:
        "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (normalized === "info") {
    return {
      Icon: Info,
      accent: "border-l-sky-500/70",
      icon: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      badge: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    };
  }

  return {
    Icon: Code2,
    accent: "border-l-border",
    icon: "bg-muted text-muted-foreground",
    badge: "text-muted-foreground",
  };
}

function SeverityBadge({ level }: { level: string }) {
  const { badge } = getSeverityStyles(level);

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 shrink-0 rounded-full px-2 text-[9px] font-bold uppercase tracking-[0.08em]",
        badge,
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
    <div className="min-w-0 rounded-lg bg-background/60 px-2.5 py-2 ring-1 ring-border/50">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-xs font-medium leading-relaxed text-foreground">
        {String(value)}
      </dd>
    </div>
  );
}

function DetailSection({
  title,
  icon: Icon,
  wide = false,
  children,
}: {
  title: string;
  icon: LucideIcon;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5",
        wide && "lg:col-span-2",
      )}
    >
      <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-background text-foreground ring-1 ring-border/60">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
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
    <div className="grid gap-3 border-t border-border/70 bg-muted/10 px-4 py-4 sm:px-5 lg:grid-cols-2">
      <DetailSection title="Summary" icon={Bug}>
        <DetailGrid>
          <Detail label="Severity" value={event.level} />
          <Detail label="Timestamp" value={formatTimestamp(event.timestamp)} />
          <Detail label="Source" value={event.source} />
          <Detail label="Error name" value={event.error_name} />
          <Detail label="Message" value={event.message} />
          <Detail label="Fingerprint" value={event.fingerprint} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Request" icon={MapPin}>
        <DetailGrid>
          <Detail label="Method" value={event.http_method} />
          <Detail label="Endpoint" value={event.endpoint} />
          <Detail label="Route" value={event.route} />
          <Detail label="Status" value={event.status_code} />
          <Detail label="URL" value={event.url} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Runtime" icon={Code2}>
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
        <DetailSection title="Exception" icon={AlertCircle} wide>
          <div className="space-y-3">
            <Trace label="Stack trace" value={event.stack} />
            <Trace label="Component stack" value={event.component_stack} />
            <Trace label="Cause" value={event.cause} />
          </div>
        </DetailSection>
      )}

      <DetailSection title="Context" icon={Braces}>
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
    <div className="grid gap-3 border-t border-border/70 bg-muted/10 px-4 py-4 sm:px-5 lg:grid-cols-2">
      <DetailSection title="Summary" icon={Server}>
        <DetailGrid>
          <Detail label="Severity" value={event.level} />
          <Detail label="Timestamp" value={formatTimestamp(event.timestamp)} />
          <Detail label="Source" value={event.source} />
          <Detail label="Logger" value={event.logger_name} />
          <Detail label="Exception" value={event.exception_type} />
          <Detail label="Fingerprint" value={event.fingerprint} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Request" icon={MapPin}>
        <DetailGrid>
          <Detail label="Method" value={event.method} />
          <Detail label="Path" value={event.path} />
          <Detail label="Route" value={event.route} />
          <Detail label="Status" value={event.status_code} />
          <Detail label="Request ID" value={event.request_id} />
        </DetailGrid>
      </DetailSection>

      <DetailSection title="Runtime" icon={Code2}>
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
        <DetailSection title="Exception" icon={AlertCircle} wide>
          <Trace label="Traceback" value={event.traceback} />
        </DetailSection>
      )}

      <DetailSection title="Context" icon={Braces}>
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
        const severity = getSeverityStyles(event.level);
        const SeverityIcon = severity.Icon;

        return (
          <article
            key={key}
            className={cn(
              "overflow-hidden rounded-3xl border border-l-2 border-border/70 bg-card/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md",
              severity.accent,
              isExpanded && "border-border shadow-md ring-1 ring-border/40",
            )}
          >
            <button
              type="button"
              className="group flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-4 sm:px-5"
              aria-expanded={isExpanded}
              onClick={() => setExpanded(isExpanded ? null : key)}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
                  severity.icon,
                )}
              >
                <SeverityIcon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <SeverityBadge level={event.level} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {kind === "frontend" ? "Frontend" : "Backend"}
                  </span>
                </span>
                <span className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                  <span className="break-words text-sm font-semibold leading-5 text-foreground sm:text-[15px]">
                    {event.message}
                  </span>
                  <time
                    className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                    dateTime={event.timestamp}
                  >
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    {formatTimestamp(event.timestamp)}
                  </time>
                </span>
                <span className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 font-mono font-medium">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{event.location}</span>
                  </span>
                  {event.context && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/8 px-2 py-1 font-mono font-semibold text-destructive">
                      <Braces className="h-3 w-3" aria-hidden="true" />
                      {event.context}
                    </span>
                  )}
                </span>
              </span>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isExpanded && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </span>
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
