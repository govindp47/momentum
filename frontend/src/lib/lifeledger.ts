/**
 * LifeLedger UI utilities.
 *
 * This file contains:
 *  - Icon types and map (UI concern, not in the backend schema)
 *  - getTaskIcon: keyword-based icon resolver for backend tasks
 *
 * The backend has NO icon field. Icons are inferred from task names on the frontend.
 * The authoritative task/entry/stats data comes from TanStack Query + Ledger API.
 */

import type { ComponentType } from "react";
import {
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Dumbbell,
  FolderKanban,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status type (used in Today/History presentation)
// ---------------------------------------------------------------------------

export type Status = "yes" | "no" | "unrecorded";

// ---------------------------------------------------------------------------
// Icon system (UI-only — not stored in the backend)
// ---------------------------------------------------------------------------

export type CommitmentIcon =
  "exercise" | "learning" | "reading" | "work" | "social" | "project";

export const iconMap: Record<
  CommitmentIcon,
  ComponentType<{ className?: string }>
> = {
  exercise: Dumbbell,
  learning: Brain,
  reading: BookOpen,
  work: BriefcaseBusiness,
  social: Users,
  project: FolderKanban,
};

/** Keyword patterns to resolve a CommitmentIcon from a task name. */
const ICON_KEYWORDS: Array<{ keywords: string[]; icon: CommitmentIcon }> = [
  {
    keywords: [
      "exercise",
      "workout",
      "gym",
      "run",
      "walk",
      "sport",
      "fitness",
      "yoga",
      "swim",
    ],
    icon: "exercise",
  },
  {
    keywords: [
      "learn",
      "study",
      "course",
      "practice",
      "skill",
      "lesson",
      "education",
    ],
    icon: "learning",
  },
  {
    keywords: ["read", "book", "page", "chapter", "novel", "article"],
    icon: "reading",
  },
  {
    keywords: ["work", "task", "job", "career", "office", "meeting", "project"],
    icon: "work",
  },
  {
    keywords: [
      "social",
      "friend",
      "family",
      "conversation",
      "connect",
      "people",
      "talk",
      "call",
    ],
    icon: "social",
  },
];

/**
 * Infer the best icon for a task based on its name keywords.
 * Falls back to "project" when no keyword matches.
 */
export function getTaskIcon(taskName: string): CommitmentIcon {
  const lower = taskName.toLowerCase();
  for (const { keywords, icon } of ICON_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return icon;
    }
  }
  return "project";
}
