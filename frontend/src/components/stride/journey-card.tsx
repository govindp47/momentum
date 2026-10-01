/**
 * JourneyCard — shared card used on the Journeys list, Today, and Archive.
 *
 * Structure mirrors stride-lovable journey-card.tsx but uses:
 * - Momentum's Progress component
 * - Momentum's Button and DropdownMenu
 * - Momentum's card/border tokens (glass utility)
 * - Real JourneyResponse from the backend (no local store)
 */

import { Link } from "@tanstack/react-router";
import { Archive, MoreHorizontal, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { resolveJourneyIcon } from "./icons";
import type { JourneyResponse } from "@/types/stride";
import { formatPercentage } from "@/lib/utils";

export function JourneyCard({
  journey,
  onPause,
  onResume,
  onArchive,
  onRestore,
}: {
  journey: JourneyResponse;
  onPause?: () => void;
  onResume?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const Icon = resolveJourneyIcon(journey.tracking_method);
  const progress = journey.is_completed ? 100 : 0; // Will be overridden by caller with real stats

  return (
    <article className="journey-card glass rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/stride/journeys/$journeyId"
          params={{ journeyId: String(journey.id) }}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium">{journey.name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">
              {journey.status}
              {journey.unit ? ` · ${journey.unit}` : ""}
            </p>
          </div>
        </Link>

        {(onPause ?? onResume ?? onArchive ?? onRestore) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Options for ${journey.name}`}
              >
                <MoreHorizontal size={17} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {journey.is_active && onPause && (
                <DropdownMenuItem onSelect={onPause}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </DropdownMenuItem>
              )}
              {journey.is_paused && onResume && (
                <DropdownMenuItem onSelect={onResume}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </DropdownMenuItem>
              )}
              {journey.is_archived && onRestore && (
                <DropdownMenuItem onSelect={onRestore}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </DropdownMenuItem>
              )}
              {!journey.is_archived && onArchive && (
                <DropdownMenuItem onSelect={onArchive}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Link
        to="/stride/journeys/$journeyId"
        params={{ journeyId: String(journey.id) }}
        className="mt-5 block"
      >
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {journey.description}
        </p>
      </Link>
    </article>
  );
}

type JourneyCardWithProgressProps = {
  journey: JourneyResponse;
  percentage: number;
  currentValue: number | undefined;
  onPause?: (() => void) | undefined;
  onResume?: (() => void) | undefined;
  onArchive?: (() => void) | undefined;
  onRestore?: (() => void) | undefined;
};

/**
 * Extended card that also shows real progress percentage from stats.
 */
export function JourneyCardWithProgress({
  journey,
  percentage,
  currentValue,
  onPause,
  onResume,
  onArchive,
  onRestore,
}: JourneyCardWithProgressProps) {
  const Icon = resolveJourneyIcon(journey.tracking_method);

  return (
    <article className="journey-card glass rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/stride/journeys/$journeyId"
          params={{ journeyId: String(journey.id) }}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium">{journey.name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {currentValue !== undefined
                ? `${formatValue(currentValue)} of ${formatValue(journey.target_value)}${journey.unit ? ` ${journey.unit}` : ""}`
                : (journey.unit ?? journey.tracking_method)}
            </p>
          </div>
        </Link>

        {(onPause ?? onResume ?? onArchive ?? onRestore) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Options for ${journey.name}`}
              >
                <MoreHorizontal size={17} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {journey.is_active && onPause && (
                <DropdownMenuItem onSelect={onPause}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </DropdownMenuItem>
              )}
              {journey.is_paused && onResume && (
                <DropdownMenuItem onSelect={onResume}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </DropdownMenuItem>
              )}
              {journey.is_archived && onRestore && (
                <DropdownMenuItem onSelect={onRestore}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </DropdownMenuItem>
              )}
              {!journey.is_archived && onArchive && (
                <DropdownMenuItem onSelect={onArchive}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Link
        to="/stride/journeys/$journeyId"
        params={{ journeyId: String(journey.id) }}
        className="mt-4 block"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="capitalize text-muted-foreground">
            {journey.status}
          </span>
          <span className="text-xl font-bold text-foreground">
            {formatPercentage(percentage)}
          </span>
        </div>
        <Progress value={percentage} className="mt-3" />
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {journey.description}
        </p>
      </Link>
    </article>
  );
}

export function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
