import type { ComponentType } from "react";
import {
  Activity,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CircleHelp,
  Code2,
  HeartPulse,
  House,
  Leaf,
  Target,
  Users,
} from "lucide-react";
import type { CommitmentCategory } from "@/types/ledger";

export interface CommitmentCategoryMetadata {
  value: CommitmentCategory;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  iconClass: string;
  backgroundClass: string;
  borderClass: string;
  badgeTextClass: string;
}

export const DEFAULT_COMMITMENT_CATEGORY: CommitmentCategory =
  "habits_discipline";

export const COMMITMENT_CATEGORIES = [
  "health_fitness",
  "learning_growth",
  "career_work",
  "personal_projects",
  "reading_knowledge",
  "mental_wellbeing",
  "nutrition_self_care",
  "relationships_social",
  "home_responsibilities",
  "habits_discipline",
] as const satisfies readonly CommitmentCategory[];

export const commitmentCategoryMetadata = {
  health_fitness: {
    value: "health_fitness",
    label: "Health & Fitness",
    description: "Energy, vitality, health, and physical progress",
    icon: Activity,
    color: "#10B981",
    iconClass: "text-[#10B981] dark:text-[#6EE7B7]",
    backgroundClass: "bg-[#10B981]/10 dark:bg-[#10B981]/15",
    borderClass: "border-[#10B981]/25 dark:border-[#10B981]/35",
    badgeTextClass: "text-[#047857] dark:text-[#6EE7B7]",
  },
  learning_growth: {
    value: "learning_growth",
    label: "Learning & Growth",
    description: "Intelligence, learning, curiosity, and development",
    icon: Brain,
    color: "#6366F1",
    iconClass: "text-[#6366F1] dark:text-[#A5B4FC]",
    backgroundClass: "bg-[#6366F1]/10 dark:bg-[#6366F1]/15",
    borderClass: "border-[#6366F1]/25 dark:border-[#6366F1]/35",
    badgeTextClass: "text-[#4F46E5] dark:text-[#A5B4FC]",
  },
  career_work: {
    value: "career_work",
    label: "Career & Work",
    description: "Professionalism, trust, focus, and productivity",
    icon: BriefcaseBusiness,
    color: "#3B82F6",
    iconClass: "text-[#3B82F6] dark:text-[#93C5FD]",
    backgroundClass: "bg-[#3B82F6]/10 dark:bg-[#3B82F6]/15",
    borderClass: "border-[#3B82F6]/25 dark:border-[#3B82F6]/35",
    badgeTextClass: "text-[#2563EB] dark:text-[#93C5FD]",
  },
  personal_projects: {
    value: "personal_projects",
    label: "Personal Projects",
    description: "Creativity, innovation, and building something new",
    icon: Code2,
    color: "#8B5CF6",
    iconClass: "text-[#8B5CF6] dark:text-[#C4B5FD]",
    backgroundClass: "bg-[#8B5CF6]/10 dark:bg-[#8B5CF6]/15",
    borderClass: "border-[#8B5CF6]/25 dark:border-[#8B5CF6]/35",
    badgeTextClass: "text-[#7C3AED] dark:text-[#C4B5FD]",
  },
  reading_knowledge: {
    value: "reading_knowledge",
    label: "Reading & Knowledge",
    description: "Wisdom, ideas, discovery, and intellectual curiosity",
    icon: BookOpen,
    color: "#F59E0B",
    iconClass: "text-[#D97706] dark:text-[#FCD34D]",
    backgroundClass: "bg-[#F59E0B]/10 dark:bg-[#F59E0B]/15",
    borderClass: "border-[#F59E0B]/25 dark:border-[#F59E0B]/35",
    badgeTextClass: "text-[#B45309] dark:text-[#FCD34D]",
  },
  mental_wellbeing: {
    value: "mental_wellbeing",
    label: "Mental Wellbeing",
    description: "Calmness, balance, mindfulness, and emotional wellbeing",
    icon: HeartPulse,
    color: "#14B8A6",
    iconClass: "text-[#0D9488] dark:text-[#5EEAD4]",
    backgroundClass: "bg-[#14B8A6]/10 dark:bg-[#14B8A6]/15",
    borderClass: "border-[#14B8A6]/25 dark:border-[#14B8A6]/35",
    badgeTextClass: "text-[#0F766E] dark:text-[#5EEAD4]",
  },
  nutrition_self_care: {
    value: "nutrition_self_care",
    label: "Nutrition & Self-Care",
    description: "Freshness, nourishment, healthy choices, and renewal",
    icon: Leaf,
    color: "#84CC16",
    iconClass: "text-[#65A30D] dark:text-[#BEF264]",
    backgroundClass: "bg-[#84CC16]/10 dark:bg-[#84CC16]/15",
    borderClass: "border-[#84CC16]/25 dark:border-[#84CC16]/35",
    badgeTextClass: "text-[#4D7C0F] dark:text-[#BEF264]",
  },
  relationships_social: {
    value: "relationships_social",
    label: "Relationships & Social",
    description: "Connection, affection, warmth, and relationships",
    icon: Users,
    color: "#EC4899",
    iconClass: "text-[#DB2777] dark:text-[#F9A8D4]",
    backgroundClass: "bg-[#EC4899]/10 dark:bg-[#EC4899]/15",
    borderClass: "border-[#EC4899]/25 dark:border-[#EC4899]/35",
    badgeTextClass: "text-[#BE185D] dark:text-[#F9A8D4]",
  },
  home_responsibilities: {
    value: "home_responsibilities",
    label: "Home & Responsibilities",
    description: "Warmth, domestic life, practical work, and responsibility",
    icon: House,
    color: "#F97316",
    iconClass: "text-[#EA580C] dark:text-[#FDBA74]",
    backgroundClass: "bg-[#F97316]/10 dark:bg-[#F97316]/15",
    borderClass: "border-[#F97316]/25 dark:border-[#F97316]/35",
    badgeTextClass: "text-[#C2410C] dark:text-[#FDBA74]",
  },
  habits_discipline: {
    value: "habits_discipline",
    label: "Habits & Discipline",
    description: "Consistency, structure, stability, and discipline",
    icon: Target,
    color: "#64748B",
    iconClass: "text-[#64748B] dark:text-[#CBD5E1]",
    backgroundClass: "bg-[#64748B]/10 dark:bg-[#64748B]/20",
    borderClass: "border-[#64748B]/25 dark:border-[#64748B]/40",
    badgeTextClass: "text-[#475569] dark:text-[#CBD5E1]",
  },
} satisfies Record<CommitmentCategory, CommitmentCategoryMetadata>;

const unknownCategoryMetadata: Omit<CommitmentCategoryMetadata, "value"> & {
  value: null;
} = {
  value: null,
  label: "Unknown category",
  description: "Category information is unavailable",
  icon: CircleHelp,
  color: "#64748B",
  iconClass: "text-muted-foreground",
  backgroundClass: "bg-secondary/70",
  borderClass: "border-border/70",
  badgeTextClass: "text-muted-foreground",
};

export function getCommitmentCategoryMetadata(
  value: unknown,
): CommitmentCategoryMetadata | typeof unknownCategoryMetadata {
  if (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(commitmentCategoryMetadata, value)
  ) {
    return commitmentCategoryMetadata[value as CommitmentCategory];
  }

  return unknownCategoryMetadata;
}
