import { useState } from "react";
import { ChevronDown, Filter } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const SOURCE_OPTIONS = [
  { label: "React", value: "react" },
  { label: "Window", value: "window" },
  { label: "Promise", value: "promise" },
  { label: "API", value: "api" },
  { label: "Application", value: "application" },
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
    <div className="flex items-center gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
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
          className={`h-7 rounded-2xl px-3 text-xs font-medium transition-colors ${
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
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-3xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
      {DAYS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`h-7 rounded-2xl px-3 text-xs font-medium transition-colors ${
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
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const selectedSource = SOURCE_OPTIONS.find(
    (option) => option.value === filters.source,
  );

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
        <div className="flex items-center gap-1 rounded-3xl border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
          <Popover open={sourcePickerOpen} onOpenChange={setSourcePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Filter frontend events by source"
                className={`flex h-7 w-32 items-center gap-1.5 rounded-2xl px-3 text-xs font-medium transition-colors ${
                  filters.source
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {selectedSource?.label ?? "All sources"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(8rem,calc(100vw-2rem))] rounded-3xl p-1"
            >
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                <button
                  type="button"
                  aria-pressed={!filters.source}
                  onClick={() => {
                    onApply({ ...filters, source: "" });
                    setSourcePickerOpen(false);
                  }}
                  className={`flex w-full items-center rounded-2xl border p-1 text-left text-[12px] font-semibold transition-colors ${
                    !filters.source
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/60 bg-card/60 hover:bg-accent/40"
                  }`}
                >
                  All sources
                </button>
                {SOURCE_OPTIONS.map((option) => {
                  const selected = filters.source === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        onApply({ ...filters, source: option.value });
                        setSourcePickerOpen(false);
                      }}
                      className={`flex w-full items-center rounded-2xl border p-1 text-left text-[11px] font-semibold transition-colors ${
                        selected
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/60 bg-card/60 hover:bg-accent/40"
                      }`}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
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
