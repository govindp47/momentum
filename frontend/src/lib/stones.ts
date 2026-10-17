export interface StoneTheme {
  icon: string;
  background: string;
  border: string;
  gradient: string;
  glow: string;
  inner: string;
  facet: string;
}

export interface StoneDefinition {
  name: string;
  purpose: string;
  description: string;
  theme: StoneTheme;
}

/**
 * The six Momentum stones form a shared visual and semantic vocabulary.
 *
 * Consumers should choose a stone for its meaning, not only its color. The
 * themes remain public so supporting UI can echo a stone without recreating
 * or reinterpreting its palette.
 */
export const STONES = {
  lodestar: {
    name: "Lodestar",
    purpose: "Discernment and direction",
    description:
      "Reveals what carries real significance and turns that understanding into a bearing—suited to recognition, priorities, goals, and decisive moments.",
    theme: {
      icon: "text-amber-300",
      background: "bg-amber-500/10",
      border: "border-amber-400/30",
      gradient: "from-yellow-200 via-amber-400 to-orange-600",
      glow: "shadow-amber-500/30",
      inner: "bg-amber-950/15 dark:bg-amber-950/35",
      facet: "bg-yellow-100/25",
    },
  },
  crucible: {
    name: "Crucible",
    purpose: "Transformation and possibility",
    description:
      "Holds tension, constraint, and unrealized potential long enough for them to become a stronger new form—suited to learning, adaptation, transitions, and reinvention.",
    theme: {
      icon: "text-violet-300",
      background: "bg-violet-500/10",
      border: "border-violet-400/30",
      gradient: "from-fuchsia-300 via-violet-500 to-indigo-700",
      glow: "shadow-violet-500/30",
      inner: "bg-violet-950/15 dark:bg-violet-950/35",
      facet: "bg-violet-100/20",
    },
  },
  verdure: {
    name: "Verdure",
    purpose: "Cultivation and renewal",
    description:
      "Nurtures living systems through patient compounding, restoration, and resilience—suited to habits, wellbeing, resources, and any progress that grows over time.",
    theme: {
      icon: "text-emerald-300",
      background: "bg-emerald-500/10",
      border: "border-emerald-400/30",
      gradient: "from-emerald-200 via-emerald-500 to-teal-700",
      glow: "shadow-emerald-500/30",
      inner: "bg-emerald-950/15 dark:bg-emerald-950/35",
      facet: "bg-emerald-100/20",
    },
  },
  tidemark: {
    name: "Tidemark",
    purpose: "Continuity and insight",
    description:
      "Preserves the trace of change, then reveals the rhythms and relationships hidden across time—suited to history, trends, reflection, forecasts, and measured progress.",
    theme: {
      icon: "text-sky-300",
      background: "bg-sky-500/10",
      border: "border-sky-400/30",
      gradient: "from-cyan-200 via-sky-500 to-blue-700",
      glow: "shadow-sky-500/30",
      inner: "bg-sky-950/15 dark:bg-sky-950/35",
      facet: "bg-sky-100/20",
    },
  },
  emberwake: {
    name: "Emberwake",
    purpose: "Agency and momentum",
    description:
      "Converts intention into usable energy and carries motion through resistance—suited to actions, streaks, urgency, breakthroughs, and the courage to begin again.",
    theme: {
      icon: "text-orange-300",
      background: "bg-orange-500/10",
      border: "border-orange-400/30",
      gradient: "from-yellow-200 via-orange-500 to-red-700",
      glow: "shadow-orange-500/30",
      inner: "bg-orange-950/15 dark:bg-orange-950/35",
      facet: "bg-orange-100/20",
    },
  },
  concord: {
    name: "Concord",
    purpose: "Connection and coherence",
    description:
      "Draws distinct people, signals, and parts of life into meaningful alignment without erasing their differences—suited to relationships, balance, synthesis, and shared outcomes.",
    theme: {
      icon: "text-pink-300",
      background: "bg-pink-500/10",
      border: "border-pink-400/30",
      gradient: "from-pink-200 via-pink-500 to-rose-700",
      glow: "shadow-pink-500/30",
      inner: "bg-pink-950/15 dark:bg-pink-950/35",
      facet: "bg-pink-100/20",
    },
  },
} as const satisfies Record<string, StoneDefinition>;

export type StoneId = keyof typeof STONES;
export const STONE_IDS = [
  "lodestar",
  "crucible",
  "verdure",
  "tidemark",
  "emberwake",
  "concord",
] as const satisfies readonly StoneId[];

export function getStoneByIndex(index: number): StoneId {
  const normalizedIndex =
    ((Math.trunc(index) % STONE_IDS.length) + STONE_IDS.length) %
    STONE_IDS.length;

  return STONE_IDS[normalizedIndex] ?? "lodestar";
}
