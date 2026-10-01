import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleDot,
  LayoutDashboard,
  ListChecks,
  Map,
  Menu,
  Moon,
  MoreHorizontal,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeProvider, useTheme } from "@/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubApp = "ledger" | "stride" | "dashboard";

type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number }>;
};

// ─── Sidebar application-level navigation (Level 1) ──────────────────────────

const appNavItems: NavItem[] = [
  { label: "Ledger", to: "/ledger/today", icon: BookOpen },
  { label: "Stride", to: "/stride/today", icon: Mountain },
];

// ─── Sub-application navigation (Level 2) ────────────────────────────────────

const ledgerNavItems: NavItem[] = [
  { label: "Today", to: "/ledger/today", icon: CircleDot },
  { label: "Insights", to: "/ledger/insights", icon: BarChart3 },
  { label: "History", to: "/ledger/history", icon: CalendarDays },
  { label: "Commitments", to: "/ledger/commitments", icon: ListChecks },
];

const strideNavItems: NavItem[] = [
  { label: "Today", to: "/stride/today", icon: CircleDot },
  { label: "Journeys", to: "/stride/journeys", icon: Map },
  { label: "Insights", to: "/stride/insights", icon: BarChart3 },
  { label: "Achievements", to: "/stride/achievements", icon: Trophy },
  { label: "History", to: "/stride/history", icon: CalendarDays },
];

// ─── Theme toggle ─────────────────────────────────────────────────────────────

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
      className="h-10 w-10 rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors hover:bg-primary/15 hover:text-primary"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

// ─── Sub-application header (Level 2 nav) ────────────────────────────────────

function SubAppHeader({
  subApp,
  pageActions,
}: {
  subApp: "ledger" | "stride";
  pageActions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const navItems = subApp === "ledger" ? ledgerNavItems : strideNavItems;
  const SubAppIcon = subApp === "ledger" ? BookOpen : Mountain;

  const subAppLabel = subApp === "ledger" ? "Ledger" : "Stride";

  const subAppDescription =
    subApp === "ledger"
      ? "Your daily commitments"
      : "Your long-term progress";

  const isActive = (to: string) => {
    if (to === "/stride/journeys") {
      return (
        pathname === "/stride/journeys" ||
        pathname.startsWith("/stride/journeys/")
      );
    }

    return pathname === to;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 shadow-sm backdrop-blur-xl">
      <div className="relative flex min-h-16 items-center gap-4 px-4 sm:px-6">
        {/* ── Left: Sub-application identity ─────────────────────────── */}
        <div className="flex min-w-0 flex-1 basis-1/3 items-center gap-3">
          {/* Application icon */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />

            <SubAppIcon
              size={21}
              strokeWidth={1.9}
              className="relative z-10"
            />

            <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_60%,transparent)]" />
          </div>

          {/* Application identity */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-[17px]">
                {subAppLabel}
              </h1>

              <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary lg:inline-flex">
                App
              </span>
            </div>

            <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
              {subAppDescription}
            </p>
          </div>
        </div>

        {/* ── Center: Sub-application navigation ─────────────────────── */}
        <nav
          className="momentum-subapp-nav absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-border/70 bg-background/60 p-1 shadow-sm backdrop-blur-md"
          aria-label={`${subAppLabel} navigation`}
        >
          {navItems.map(({ label, to, icon: Icon }) => {
            const active = isActive(to);

            return (
              <Link
                key={to}
                to={to as "/"}
                aria-current={active ? "page" : undefined}
                className={`group relative flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-150 sm:px-3 sm:text-sm ${
                  active
                    ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <Icon
                  size={14}
                  className={`shrink-0 transition-colors ${
                    active
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />

                <span>{label}</span>

                {active && (
                  <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-primary/80" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Right: Application actions ─────────────────────────────── */}
        <div className="ml-auto flex flex-1 basis-1/3 items-center justify-end gap-1.5">
          {pageActions}
          <ThemeToggleButton />
        </div>
      </div>
    </header>
  );
}

// ─── Dashboard header ────────────────────────────────────

function DashboardHeader({ pageActions }: { pageActions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 shadow-sm backdrop-blur-xl">
      <div className="flex min-h-16 items-center gap-4 px-4 sm:px-6">
        {/* ── Left: Momentum identity ──────────────────────────────── */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Momentum icon */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />

            <Sparkles
              size={21}
              strokeWidth={1.9}
              className="relative z-10"
            />

            <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_60%,transparent)]" />
          </div>

          {/* Momentum identity */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-[17px]">
                Momentum
              </h1>

              <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary lg:inline-flex">
                Core
              </span>
            </div>

            <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
              Your personal workspace
            </p>
          </div>
        </div>

        {/* ── Right: Core actions ─────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-1.5">
          {pageActions}
          <ThemeToggleButton />
        </div>
      </div>
    </header>
  );
}

// ─── Main AppShell inner (renders sidebar + content) ─────────────────────────

function AppShellInner({
  children,
  subApp = "dashboard",
  pageActions,
}: {
  children: ReactNode;
  subApp?: SubApp;
  pageActions?: ReactNode;
}) {
  const [mobileMenu, setMobileMenu] = useState(false);
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem("momentum.sidebar.collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem(
      "momentum.sidebar.collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Determine which app is "active" in the sidebar for highlighting
  const activeSidebarTo = (to: string) => {
    if (to === "/ledger/today") return pathname.startsWith("/ledger");
    if (to === "/stride/today") return pathname.startsWith("/stride");
    return false;
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 md:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "w-14" : "w-56"}`}
      >
        {/* Brand + collapse button */}
        <div
          className={`relative flex h-16 shrink-0 items-center border-b border-sidebar-border bg-sidebar shadow-sm ${
            sidebarCollapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          {sidebarCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm transition-all duration-200 hover:border-primary/35 hover:bg-primary/15 hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_12%,transparent)]"
              aria-label="Expand sidebar"
              onClick={() => setSidebarCollapsed(false)}
            >
              <Sparkles className="h-[18px] w-[18px] transition-all duration-200 group-hover:scale-0 group-hover:opacity-0" />

              <PanelLeftOpen className="absolute h-[17px] w-[17px] scale-75 text-primary opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" />

              <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
            </Button>
          ) : (
            <>
              <div className="group flex min-w-0 flex-1 items-center gap-2.5">
                <Link
                  to="/"
                  aria-label="Go to Momentum dashboard"
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-sm transition-all duration-200 hover:border-primary/35 hover:bg-primary/15 hover:shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_15%,transparent)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />

                  <Sparkles
                    className="relative z-10 h-[17px] w-[17px] transition-transform duration-200 group-hover:scale-105"
                    strokeWidth={1.9}
                  />

                  <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_7px_color-mix(in_oklch,var(--primary)_65%,transparent)]" />
                </Link>

                <div className="min-w-0">
                  <h1 className="truncate text-[15px] font-bold tracking-tight text-foreground">
                    Momentum
                  </h1>

                  <p className="mt-0.5 truncate text-[9px] font-medium tracking-wide text-muted-foreground">
                    Personal workspace
                  </p>
                </div>
              </div>

              {/* Collapse button */}
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 h-9 w-9 shrink-0 rounded-lg border border-transparent text-muted-foreground transition-all duration-200 hover:border-primary/15 hover:bg-primary/10 hover:text-primary"
                aria-label="Collapse sidebar"
                onClick={() => setSidebarCollapsed(true)}
              >
                <PanelLeftClose className="h-[17px] w-[17px]" />
              </Button>
            </>
          )}

          {/* Mobile close */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-9 w-9 shrink-0 rounded-lg md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileMenu(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-2 py-3"
          aria-label="Primary navigation"
        >
          <div className="mb-2 px-2">
            {!sidebarCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                Applications
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {appNavItems.map(({ label, to, icon: Icon }) => {
              const active = activeSidebarTo(to);

              return (
                <Link
                  key={to}
                  to={to as "/"}
                  onClick={() => setMobileMenu(false)}
                  title={sidebarCollapsed ? label : undefined}
                  aria-label={sidebarCollapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-10 items-center overflow-hidden rounded-lg border transition-all duration-200 ${
                    sidebarCollapsed
                      ? "justify-center"
                      : "gap-2.5 px-2.5"
                  } ${
                    active
                      ? "border-primary/20 bg-primary/10 text-primary shadow-[0_3px_16px_color-mix(in_oklch,var(--primary)_8%,transparent)]"
                      : "border-transparent text-sidebar-foreground/75 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  {active && (
                    <>
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_70%,transparent)]" />
                      <span className="absolute inset-0 bg-gradient-to-r from-primary/7 via-primary/2 to-transparent" />
                    </>
                  )}

                  <span
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
                      active
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "border-sidebar-border bg-sidebar-accent/60 text-muted-foreground group-hover:border-primary/15 group-hover:bg-primary/5 group-hover:text-primary"
                    }`}
                  >
                    <Icon
                      size={15}
                      className="transition-transform duration-200 group-hover:scale-105"
                    />
                  </span>

                  {!sidebarCollapsed && (
                    <span className="relative z-10 flex min-w-0 flex-1 items-center justify-between">
                      <span
                        className={`truncate text-[13px] ${
                          active ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {label}
                      </span>

                      {active && (
                        <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_70%,transparent)]" />
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-2.5">
          <div
            className={`group relative overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-accent/30 transition-all duration-200 hover:border-primary/15 hover:bg-primary/5 ${
              sidebarCollapsed
                ? "flex h-9 items-center justify-center"
                : "px-2 py-1.5"
            }`}
            title={sidebarCollapsed ? "Govind Patidar" : undefined}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

            <div
              className={`relative z-10 flex items-center ${
                sidebarCollapsed ? "justify-center" : "gap-2.5"
              }`}
            >
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-[9px] font-bold tracking-wide text-primary shadow-sm">
                GP

                <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-sidebar bg-primary" />
              </div>

              {!sidebarCollapsed && (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-foreground">
                      Govind Patidar
                    </p>

                    <p className="mt-0.5 truncate text-[9px] font-medium text-muted-foreground">
                      Momentum user
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="More options"
                    className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {mobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-overlay md:hidden"
          onClick={() => setMobileMenu(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Main content area ───────────────────────────────────────────── */}
      <main
        className={`min-w-0 flex-1 transition-all duration-200 ${
          sidebarCollapsed ? "md:pl-14" : "md:pl-56"
        }`}
      >
        {/* Mobile menu button */}
        <div className="flex h-16 items-center border-b border-border bg-card px-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            onClick={() => setMobileMenu(true)}
            className="h-10 w-10 rounded-xl border border-border/70 bg-background/60 text-muted-foreground shadow-sm hover:bg-primary/10 hover:text-primary"
          >
            <Menu className="h-[18px] w-[18px]" />
          </Button>
        </div>

        {/* Sub-app or dashboard header */}
        {subApp === "ledger" || subApp === "stride" ? (
          <SubAppHeader subApp={subApp} pageActions={pageActions} />
        ) : (
          <DashboardHeader pageActions={pageActions} />
        )}

        {/* Page content */}
        <div className="min-h-[calc(100vh-4rem)] bg-dot-pattern p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Public AppShell export ───────────────────────────────────────────────────

export function AppShell(props: {
  children: ReactNode;
  subApp?: SubApp;
  /**
   * Actions rendered in the right side of the sub-application header.
   * This replaces the old `headerActions` prop.
   */
  pageActions?: ReactNode;
  /**
   * @deprecated Use `pageActions` and `subApp` instead.
   * Kept for backward compatibility during migration — maps to pageActions.
   */
  headerTitle?: string;
  /**
   * @deprecated Use `pageActions` and `subApp` instead.
   */
  headerActions?: ReactNode;
}) {
  // Map legacy props: headerActions → pageActions
  const pageActions = props.pageActions ?? props.headerActions;
  // Derive subApp from headerTitle if not provided (best-effort backward compat)
  const subApp = props.subApp ?? "dashboard";

  return (
    <ThemeProvider>
      <AppShellInner subApp={subApp} pageActions={pageActions}>
        {props.children}
      </AppShellInner>
    </ThemeProvider>
  );
}

// ─── PageIntro (unchanged) ────────────────────────────────────────────────────

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
