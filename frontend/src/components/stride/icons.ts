/**
 * Shared icon maps for Stride journey cards and achievements.
 * Uses lucide-react icons already available in Momentum.
 */

import {
  BookOpen,
  CalendarDays,
  Code2,
  Flag,
  Flame,
  Footprints,
  Guitar,
  Mountain,
  Orbit,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

// Map from backend tracking_method or a UI icon-key to a Lucide icon.
export const journeyMethodIcons: Record<string, LucideIcon> = {
  quantity: Footprints,
  count: BookOpen,
  duration: Guitar,
  milestone: Target,
};

// A small set of named journey icons for display purposes.
export const journeyIcons: Record<string, LucideIcon> = {
  footprints: Footprints,
  book: BookOpen,
  code: Code2,
  guitar: Guitar,
  mountain: Mountain,
  target: Target,
};

export const achievementIcons: Record<string, LucideIcon> = {
  trophy: Trophy,
  flame: Flame,
  flag: Flag,
  sparkles: Sparkles,
  calendar: CalendarDays,
  orbit: Orbit,
};

/** Resolve the best icon for a journey from the API response. */
export function resolveJourneyIcon(trackingMethod: string): LucideIcon {
  return journeyMethodIcons[trackingMethod] ?? Target;
}
