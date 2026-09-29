import { useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  CircleDot,
  LayoutDashboard,
  ListChecks,
  Map,
  Menu,
  Moon,
  MoreHorizontal,
  Sparkles,
  Sun,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeProvider, useTheme } from "@/lib/theme";

type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  heading?: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }],
  },
  {
    heading: "PERSONAL LEDGER",
    items: [
      { label: "Today", to: "/ledger/today", icon: CircleDot },
      { label: "Insights", to: "/ledger/insights", icon: BarChart3 },
      { label: "History", to: "/ledger/history", icon: CalendarDays },
      { label: "Commitments", to: "/ledger/commitments", icon: ListChecks },
    ],
  },
  {
    heading: "STRIDE",
    items: [
      { label: "Today", to: "/stride/today", icon: CircleDot },
      { label: "Journeys", to: "/stride/journeys", icon: Map },
      { label: "History", to: "/stride/history", icon: CalendarDays },
      { label: "Insights", to: "/stride/insights", icon: BarChart3 },
      { label: "Achievements", to: "/stride/achievements", icon: Trophy },
    ],
  },
];

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

function AppShellInner({
  children,
  headerTitle = "Today",
  headerActions,
}: {
  children: ReactNode;
  headerTitle?: string;
  headerActions?: ReactNode;
}) {
  const [mobileMenu, setMobileMenu] = useState(false);
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Momentum</h1>
            <p className="text-xs leading-tight text-muted-foreground">
              Daily commitments
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileMenu(false)}
          >
            <X />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto" aria-label="Primary navigation">
          {navigationGroups.map((group) => (
            <div key={group.heading ?? "top"}>
              {group.heading ? (
                <p className="px-5 pb-1 pt-4 text-xs font-medium text-muted-foreground">
                  {group.heading}
                </p>
              ) : (
                <div className="pt-4" />
              )}
              {group.items.map(({ label, to, icon: Icon }) => (
                <div key={to} className="border-b border-sidebar-border">
                  <Link
                    to={to as "/"}
                    activeOptions={{ exact: to === "/" }}
                    onClick={() => setMobileMenu(false)}
                    className="flex h-10 items-center gap-3 px-5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeProps={{
                      className: "bg-sidebar-accent font-medium text-primary",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">My ledger</p>
              <p className="text-xs text-muted-foreground">
                Stored on this device
              </p>
            </div>
          </div>
        </div>
      </aside>
      {mobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-overlay md:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <main className="min-w-0 flex-1 md:pl-64">
        <header className="sticky top-0 z-20 grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center border-b border-border bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileMenu(true)}
          >
            <Menu />
          </Button>
          <span className="truncate text-sm font-medium md:col-start-2">
            {headerTitle}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <ThemeToggleButton />
            <Button variant="ghost" size="icon" aria-label="More options">
              <MoreHorizontal />
            </Button>
          </div>
        </header>
        <div className="min-h-[calc(100vh-3.5rem)] bg-dot-pattern p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export function AppShell(props: {
  children: ReactNode;
  headerTitle?: string;
  headerActions?: ReactNode;
}) {
  return (
    <ThemeProvider>
      <AppShellInner {...props} />
    </ThemeProvider>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-fade-up flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-sm font-medium text-primary">{eyebrow}</p>
        )}
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
