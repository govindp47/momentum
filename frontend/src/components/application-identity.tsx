import {
  NotebookTabs,
  Orbit,
  Route,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ApplicationId = "momentum" | "ledger" | "stride" | "developer";

type ApplicationTheme = {
  surface: string;
  border: string;
  foreground: string;
  gradient: string;
  glow: string;
  dot: string;
  hover: string;
};

type ApplicationIdentity = {
  label: string;
  description: string;
  badge: string;
  route: string;
  icon: LucideIcon;
  theme: ApplicationTheme;
};

/**
 * The single source of truth for application-level visual identities.
 * Feature and navigation icons remain local to the feature they describe.
 */
export const APPLICATION_IDENTITIES = {
  momentum: {
    label: "Momentum",
    description: "Your personal workspace",
    badge: "Core",
    route: "/",
    icon: Orbit,
    theme: {
      surface: "bg-sky-500/10 dark:bg-sky-400/10",
      border: "border-sky-500/25 dark:border-sky-400/25",
      foreground: "text-sky-600 dark:text-sky-400",
      gradient:
        "from-blue-500/25 via-sky-400/10 to-cyan-300/20 dark:from-blue-400/25 dark:via-sky-400/10 dark:to-cyan-300/15",
      glow: "shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--color-sky-500)_55%,transparent)] dark:shadow-[0_8px_26px_-12px_color-mix(in_oklch,var(--color-sky-400)_65%,transparent)]",
      dot: "bg-cyan-500 dark:bg-cyan-300",
      hover:
        "hover:border-sky-500/25 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:border-sky-400/25 dark:hover:bg-sky-400/10 dark:hover:text-sky-400",
    },
  },
  ledger: {
    label: "Ledger",
    description: "Your daily commitments",
    badge: "App",
    route: "/ledger/today",
    icon: NotebookTabs,
    theme: {
      surface: "bg-emerald-500/10 dark:bg-emerald-400/10",
      border: "border-emerald-500/25 dark:border-emerald-400/25",
      foreground: "text-emerald-600 dark:text-emerald-400",
      gradient:
        "from-emerald-500/25 via-teal-400/10 to-lime-300/20 dark:from-emerald-400/25 dark:via-teal-400/10 dark:to-lime-300/15",
      glow: "shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--color-emerald-500)_55%,transparent)] dark:shadow-[0_8px_26px_-12px_color-mix(in_oklch,var(--color-emerald-400)_65%,transparent)]",
      dot: "bg-teal-500 dark:bg-teal-300",
      hover:
        "hover:border-emerald-500/25 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:border-emerald-400/25 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-400",
    },
  },
  stride: {
    label: "Stride",
    description: "Your long-term progress",
    badge: "App",
    route: "/stride/today",
    icon: Route,
    theme: {
      surface: "bg-violet-500/10 dark:bg-violet-400/10",
      border: "border-violet-500/25 dark:border-violet-400/25",
      foreground: "text-violet-600 dark:text-violet-400",
      gradient:
        "from-violet-500/25 via-fuchsia-400/10 to-purple-300/20 dark:from-violet-400/25 dark:via-fuchsia-400/10 dark:to-purple-300/15",
      glow: "shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--color-violet-500)_55%,transparent)] dark:shadow-[0_8px_26px_-12px_color-mix(in_oklch,var(--color-violet-400)_65%,transparent)]",
      dot: "bg-fuchsia-500 dark:bg-fuchsia-300",
      hover:
        "hover:border-violet-500/25 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:border-violet-400/25 dark:hover:bg-violet-400/10 dark:hover:text-violet-400",
    },
  },
  developer: {
    label: "Errors & Logs",
    description: "Application diagnostics",
    badge: "Developer",
    route: "/developer/events",
    icon: ScanSearch,
    theme: {
      surface: "bg-rose-500/10 dark:bg-rose-400/10",
      border: "border-rose-500/25 dark:border-rose-400/25",
      foreground: "text-rose-600 dark:text-rose-400",
      gradient:
        "from-rose-500/25 via-orange-400/10 to-amber-300/20 dark:from-rose-400/25 dark:via-orange-400/10 dark:to-amber-300/15",
      glow: "shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--color-rose-500)_55%,transparent)] dark:shadow-[0_8px_26px_-12px_color-mix(in_oklch,var(--color-rose-400)_65%,transparent)]",
      dot: "bg-orange-500 dark:bg-orange-300",
      hover:
        "hover:border-rose-500/25 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:border-rose-400/25 dark:hover:bg-rose-400/10 dark:hover:text-rose-400",
    },
  },
} as const satisfies Record<ApplicationId, ApplicationIdentity>;

const sizes = {
  xs: { frame: "h-8 w-8 rounded-2xl", icon: "h-4 w-4", dot: "h-1 w-1" },
  sm: {
    frame: "h-9 w-9 rounded-2xl",
    icon: "h-[17px] w-[17px]",
    dot: "h-1.5 w-1.5",
  },
  md: {
    frame: "h-10 w-10 rounded-3xl",
    icon: "h-5 w-5",
    dot: "h-1.5 w-1.5",
  },
  lg: {
    frame: "h-12 w-12 rounded-3xl",
    icon: "h-6 w-6",
    dot: "h-2 w-2",
  },
} as const;

export function ApplicationIcon({
  application,
  size = "md",
  className,
  iconClassName,
}: {
  application: ApplicationId;
  size?: keyof typeof sizes;
  className?: string;
  iconClassName?: string;
}) {
  const identity = APPLICATION_IDENTITIES[application];
  const Icon = identity.icon;
  const dimensions = sizes[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative isolate flex shrink-0 items-center justify-center overflow-hidden border",
        dimensions.frame,
        identity.theme.surface,
        identity.theme.border,
        identity.theme.foreground,
        identity.theme.glow,
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-0 bg-gradient-to-br",
          identity.theme.gradient,
        )}
      />
      <span className="absolute -left-1/3 top-1/2 h-2/3 w-[160%] -translate-y-1/2 rotate-[-28deg] border-y border-current/10 bg-foreground/5" />
      <Icon
        strokeWidth={1.9}
        className={cn("relative z-10", dimensions.icon, iconClassName)}
      />
      <span
        className={cn(
          "absolute bottom-[12%] right-[12%] rounded-full ring-2 ring-card/70 dark:ring-background/70",
          dimensions.dot,
          identity.theme.dot,
        )}
      />
    </span>
  );
}
