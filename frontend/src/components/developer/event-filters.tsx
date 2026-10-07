import { Filter } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BackendLogFilters,
  EventDaysFilter,
  FrontendErrorFilters,
} from "@/types/developer";

const DAYS_OPTIONS: Array<{ label: string; value: EventDaysFilter }> = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "all" },
];

function LevelFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
      <div className="flex h-7 shrink-0 items-center gap-1 px-2 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        <Filter className="h-3 w-3" />
        Level
      </div>
      {options.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`h-7 rounded-xl px-3 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DaysFilter({
  value,
  onChange,
}: {
  value: EventDaysFilter;
  onChange: (value: EventDaysFilter) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
      {DAYS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`h-7 rounded-xl px-3 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FrontendEventFilters({
  filters,
  onApply,
}: {
  filters: FrontendErrorFilters;
  onApply: (filters: FrontendErrorFilters) => void;
}) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <LevelFilter
        value={filters.level}
        onChange={(level) => onApply({ ...filters, level })}
        options={[
          { label: "All", value: "" },
          { label: "Error", value: "error" },
          { label: "Warning", value: "warning" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Select
          value={filters.source || "all"}
          onValueChange={(source) =>
            onApply({ ...filters, source: source === "all" ? "" : source })
          }
        >
          <SelectTrigger
            aria-label="Filter frontend events by source"
            className="w-36 rounded-xl border-border/70 bg-card/80 shadow-sm"
          >
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="react">React</SelectItem>
            <SelectItem value="window">Window</SelectItem>
            <SelectItem value="promise">Promise</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="application">Application</SelectItem>
          </SelectContent>
        </Select>
        <DaysFilter
          value={filters.days}
          onChange={(days) => onApply({ ...filters, days })}
        />
      </div>
    </section>
  );
}

export function BackendEventFilters({
  filters,
  onApply,
}: {
  filters: BackendLogFilters;
  onApply: (filters: BackendLogFilters) => void;
}) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <LevelFilter
        value={filters.level}
        onChange={(level) => onApply({ ...filters, level })}
        options={[
          { label: "All", value: "" },
          { label: "Warning", value: "WARNING" },
          { label: "Error", value: "ERROR" },
          { label: "Critical", value: "CRITICAL" },
        ]}
      />
      <DaysFilter
        value={filters.days}
        onChange={(days) => onApply({ ...filters, days })}
      />
    </section>
  );
}
