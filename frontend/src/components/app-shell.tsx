import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  CircleDot,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  Map,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import {
  APPLICATION_IDENTITIES,
  ApplicationIcon,
  type ApplicationId,
} from "@/components/application-identity";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  useAuth,
  useLogout,
  useSetDeveloperMode,
} from "@/hooks/queries/use-auth";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubApp = "ledger" | "stride" | "dashboard";

type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number }>;
};

type ApplicationNavItem = {
  application: Extract<ApplicationId, "ledger" | "stride">;
};

// ─── Sidebar application-level navigation (Level 1) ──────────────────────────

const appNavItems: ApplicationNavItem[] = [
  { application: "ledger" },
  { application: "stride" },
];

// ─── Sub-application navigation (Level 2) ────────────────────────────────────

const ledgerNavItems: NavItem[] = [
  { label: "Today", to: "/ledger/today", icon: CircleDot },
  { label: "Insights", to: "/ledger/insights", icon: BarChart3 },
  { label: "Commitments", to: "/ledger/commitments", icon: ListChecks },
  { label: "History", to: "/ledger/history", icon: CalendarDays },
];

const strideNavItems: NavItem[] = [
  { label: "Today", to: "/stride/today", icon: CircleDot },
  { label: "Journeys", to: "/stride/journeys", icon: Map },
  { label: "Insights", to: "/stride/insights", icon: BarChart3 },
  { label: "Achievements", to: "/stride/achievements", icon: Trophy },
  { label: "History", to: "/stride/history", icon: CalendarDays },
];

const applicationHeaderNavItems: Record<ApplicationId, NavItem[]> = {
  momentum: [],
  ledger: ledgerNavItems,
  stride: strideNavItems,
  developer: [],
};

function userInitials(name: string, username: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  }
  const source = parts[0] || username;
  return source.slice(0, 2).toUpperCase();
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const auth = useAuth();
  const logout = useLogout();
  const developerMode = useSetDeveloperMode();
  const user = auth.currentUser;

  if (!user) return null;

  const initials = userInitials(user.name, user.username);
  const momentumTheme = APPLICATION_IDENTITIES.momentum.theme;
  const error = developerMode.error
    ? "Developer mode couldn't be updated."
    : logout.error
      ? "Momentum couldn't log out. Please try again."
      : null;

  const avatar = (
    <span
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border text-[12px] font-bold tracking-wide",
        momentumTheme.surface,
        momentumTheme.border,
        momentumTheme.foreground,
        momentumTheme.glow,
      )}
    >
      {initials}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-sidebar",
          momentumTheme.dot,
        )}
      />
    </span>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <div
          aria-label={user.name}
          title={user.name}
          className="flex h-9 w-9 items-center justify-center rounded-lg"
        >
          {avatar}
        </div>
      ) : (
        <div className="relative z-10 flex items-center gap-2.5">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate text-[9px] font-medium text-muted-foreground">
              @{user.username}
            </p>
          </div>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Open menu for ${user.name}`}
              className={cn(
                "h-7 w-7 shrink-0 rounded-2xl text-muted-foreground transition-[color,background-color]",
                momentumTheme.foreground,
                momentumTheme.hover,
              )}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </div>
      )}

      <DropdownMenuContent
        side="top"
        align="end"
        className="rounded-xl"
        sideOffset={24}
      >
        <DropdownMenuLabel className="-mx-1 -mt-1 rounded-t-lg bg-muted-foreground/10 font-normal shadow-sm">
          <span className="block truncate text-xs font-semibold text-muted-foreground">
            @{user.username}
          </span>
        </DropdownMenuLabel>

        {auth.developerAuthorized && (
          <>
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <label
                htmlFor="developer-mode-switch"
                className="min-w-0 text-sm font-semibold"
              >
                Developer mode
                <span className="block text-[11px] font-normal text-muted-foreground">
                  Show diagnostics tools
                </span>
              </label>
              {developerMode.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  id="developer-mode-switch"
                  aria-label="Developer mode"
                  checked={auth.developerModeEnabled}
                  disabled={developerMode.isPending}
                  onCheckedChange={(enabled) => {
                    developerMode.reset();
                    developerMode.mutate(enabled);
                  }}
                />
              )}
            </div>
          </>
        )}

        {error && (
          <p className="px-2 py-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logout.isPending}
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            logout.reset();
            logout.mutate();
          }}
        >
          {logout.isPending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <LogOut />
          )}
          {logout.isPending ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggleButton({ application }: { application: ApplicationId }) {
  const { theme, toggleTheme } = useTheme();
  const applicationTheme = APPLICATION_IDENTITIES[application].theme;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      onClick={toggleTheme}
      className={cn(
        "h-10 w-10 rounded-full border transition-[color,background-color,border-color,filter] hover:brightness-110",
        applicationTheme.surface,
        applicationTheme.border,
        applicationTheme.foreground,
        applicationTheme.glow,
      )}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

// ─── Shared application header ───────────────────────────────────────────────

function ApplicationHeader({
  application,
  pageNavigation,
  pageActions,
}: {
  application: ApplicationId;
  pageNavigation?: ReactNode;
  pageActions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navItems = applicationHeaderNavItems[application];
  const identity = APPLICATION_IDENTITIES[application];

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
    <header
      className={cn(
        "sticky top-0 z-30 mx-12 overflow-hidden rounded-b-4xl border-x border-b bg-card/90 shadow-md backdrop-blur-xl",
        identity.theme.border,
      )}
    >
      <div className="relative flex min-h-14 items-center gap-4 px-2 sm:px-4">
        {/* ── Left: Application identity ─────────────────────────────── */}
        <div className="flex min-w-0 flex-1 basis-1/3 items-center gap-3">
          {/* Application icon */}
          <ApplicationIcon application={application} size="sm" />

          {/* Application identity */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-[17px]">
                {identity.label}
              </h1>

              <span
                className={cn(
                  "hidden rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] lg:inline-flex",
                  identity.theme.surface,
                  identity.theme.border,
                  identity.theme.foreground,
                )}
              >
                {identity.badge}
              </span>
            </div>

            <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
              {identity.description}
            </p>
          </div>
        </div>

        {/* ── Center: Application navigation ─────────────────────────── */}
        <nav
          className="momentum-subapp-nav absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5"
          aria-label={`${identity.label} navigation`}
        >
          {pageNavigation ??
            navItems.map(({ label, to, icon: Icon }) => {
              const active = isActive(to);

              return (
                <Link
                  key={to}
                  to={to as "/"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-7 shrink-0 items-center gap-1.5 rounded-2xl border px-2.5 text-xs font-medium transition-all duration-150 sm:px-3 sm:text-sm",
                    active
                      ? [
                          identity.theme.surface,
                          identity.theme.border,
                          identity.theme.foreground,
                          identity.theme.glow,
                        ]
                      : [
                          "border-transparent text-muted-foreground",
                          identity.theme.hover,
                        ],
                  )}
                >
                  <Icon
                    size={14}
                    className={cn(
                      "shrink-0 transition-colors",
                      active
                        ? identity.theme.foreground
                        : "text-muted-foreground group-hover:text-current",
                    )}
                  />

                  <span>{label}</span>

                  {active && (
                    <span
                      className={cn(
                        "absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full",
                        identity.theme.dot,
                      )}
                    />
                  )}
                </Link>
              );
            })}
        </nav>

        {/* ── Right: Application actions ─────────────────────────────── */}
        <div className="ml-auto flex flex-1 basis-1/3 items-center justify-end gap-1.5">
          {pageActions}
          <ThemeToggleButton application={application} />
        </div>
      </div>
    </header>
  );
}

// ─── Main AppShell inner (renders sidebar + content) ─────────────────────────

function AppShellInner({
  children,
  subApp = "dashboard",
  pageNavigation,
  pageActions,
}: {
  children: ReactNode;
  subApp?: SubApp;
  pageNavigation?: ReactNode;
  pageActions?: ReactNode;
}) {
  const auth = useAuth();
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
  const isDeveloperRoute = pathname.startsWith("/developer");
  const headerApplication: ApplicationId = isDeveloperRoute
    ? "developer"
    : subApp === "ledger" || subApp === "stride"
      ? subApp
      : "momentum";

  // Determine which app is "active" in the sidebar for highlighting
  const activeSidebarTo = (to: string) => {
    if (to === "/ledger/today") return pathname.startsWith("/ledger");
    if (to === "/stride/today") return pathname.startsWith("/stride");
    if (to === "/developer/events") return pathname.startsWith("/developer");
    return false;
  };

  const developerEventsActive = activeSidebarTo("/developer/events");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden rounded-r-4xl border-y border-r border-sidebar-border bg-sidebar shadow-md transition-[width,transform] duration-[250ms] ease-out will-change-[width,transform] md:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "w-14" : "w-56"}`}
      >
        {/* Brand + collapse button */}
        <div
          className={`relative flex h-16 shrink-0 items-center border-b border-sidebar-border bg-sidebar shadow-sm transition-[padding] duration-[250ms] ease-out ${
            sidebarCollapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <Button
            variant="ghost"
            size="icon"
            className={`group absolute left-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl p-0 transition-[opacity,transform] duration-200 ease-out ${
              sidebarCollapsed
                ? "scale-100 opacity-100"
                : "pointer-events-none scale-90 opacity-0"
            }`}
            aria-label="Expand sidebar"
            onClick={() => setSidebarCollapsed(false)}
          >
            <ApplicationIcon
              application="momentum"
              className="transition-all duration-200 group-hover:scale-75 group-hover:opacity-0"
            />

            <PanelLeftOpen
              className={cn(
                "absolute h-[17px] w-[17px] scale-75 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100",
                APPLICATION_IDENTITIES.momentum.theme.foreground,
              )}
            />
          </Button>

          <div
            className={`flex min-w-0 flex-1 items-center transition-[opacity,transform] duration-200 ease-out ${
              sidebarCollapsed
                ? "pointer-events-none -translate-x-2 opacity-0"
                : "translate-x-0 opacity-100"
            }`}
          >
            <div className="group flex min-w-0 flex-1 items-center gap-2.5">
              <Link
                to="/"
                aria-label="Go to Momentum dashboard"
                className="rounded-2xl transition-transform duration-200 hover:scale-105"
              >
                <ApplicationIcon application="momentum" size="sm" />
              </Link>

              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-bold tracking-tight text-foreground">
                  {APPLICATION_IDENTITIES.momentum.label}
                </h1>

                <p className="truncate text-[9px] font-medium tracking-tight text-muted-foreground">
                  {APPLICATION_IDENTITIES.momentum.description}
                </p>
              </div>
            </div>

            {/* Collapse button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "ml-2 h-9 w-9 shrink-0 rounded-3xl bg-transparent transition-[color,background-color] duration-200",
                APPLICATION_IDENTITIES.momentum.theme.foreground,
                APPLICATION_IDENTITIES.momentum.theme.hover,
              )}
              aria-label="Collapse sidebar"
              onClick={() => setSidebarCollapsed(true)}
            >
              <PanelLeftClose className="h-[17px] w-[17px]" />
            </Button>
          </div>

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
          className="flex flex-1 flex-col overflow-y-auto px-2 py-3"
          aria-label="Primary navigation"
        >
          <div className="mb-2 h-4 px-2">
            <span
              aria-hidden={sidebarCollapsed}
              className={`block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 transition-[opacity,transform] duration-150 ease-out ${
                sidebarCollapsed
                  ? "-translate-x-1 opacity-0"
                  : "translate-x-0 opacity-100"
              }`}
            >
              Applications
            </span>
          </div>

          <div className="space-y-1.5">
            {appNavItems.map(({ application }) => {
              const identity = APPLICATION_IDENTITIES[application];
              const { label, route: to } = identity;
              const active = activeSidebarTo(to);

              return (
                <Link
                  key={to}
                  to={to as "/"}
                  onClick={() => setMobileMenu(false)}
                  title={sidebarCollapsed ? label : undefined}
                  aria-label={sidebarCollapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-10 items-center overflow-hidden rounded-2xl border transition-[gap,padding,background-color,border-color,color,box-shadow,filter] duration-[250ms] ease-out",
                    sidebarCollapsed ? "justify-center" : "gap-2.5 px-2.5",
                    active
                      ? [
                          identity.theme.surface,
                          identity.theme.border,
                          identity.theme.foreground,
                          identity.theme.glow,
                        ]
                      : [
                          "border-transparent text-muted-foreground",
                          identity.theme.hover,
                        ],
                  )}
                >
                  {active && (
                    <>
                      <span
                        className={cn(
                          "absolute inset-y-2 left-0 w-0.5 rounded-full",
                          identity.theme.dot,
                          identity.theme.glow,
                        )}
                      />
                      <span
                        className={cn(
                          "absolute inset-0 bg-gradient-to-r opacity-40",
                          identity.theme.gradient,
                        )}
                      />
                    </>
                  )}

                  <ApplicationIcon
                    application={application}
                    size="xs"
                    className={`relative z-10 transition-all duration-200 group-hover:scale-105 ${
                      active
                        ? "opacity-100"
                        : "opacity-75 group-hover:opacity-100"
                    }`}
                  />

                  <span
                    aria-hidden={sidebarCollapsed}
                    className={`relative z-10 flex min-w-0 flex-1 items-center justify-between overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out ${
                      sidebarCollapsed
                        ? "max-w-0 -translate-x-1 opacity-0"
                        : "max-w-40 translate-x-0 opacity-100"
                    }`}
                  >
                    <span
                      className={`truncate text-[13px] ${
                        active ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {label}
                    </span>

                    {active && (
                      <span
                        className={cn(
                          "ml-2 h-1.5 w-1.5 shrink-0 rounded-full",
                          identity.theme.dot,
                          identity.theme.glow,
                        )}
                      />
                    )}
                  </span>
                </Link>
              );
            })}
          </div>

          {auth.developerAuthorized && auth.developerModeEnabled && (
            <div className="mt-auto border-t border-sidebar-border pt-4">
              <div className="mb-2 h-4 px-2">
                <span
                  aria-hidden={sidebarCollapsed}
                  className={`block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 transition-[opacity,transform] duration-150 ease-out ${
                    sidebarCollapsed
                      ? "-translate-x-1 opacity-0"
                      : "translate-x-0 opacity-100"
                  }`}
                >
                  Developer
                </span>
              </div>

              <Link
                to="/developer/events"
                onClick={() => setMobileMenu(false)}
                title={
                  sidebarCollapsed
                    ? APPLICATION_IDENTITIES.developer.label
                    : undefined
                }
                aria-label={
                  sidebarCollapsed
                    ? APPLICATION_IDENTITIES.developer.label
                    : undefined
                }
                aria-current={developerEventsActive ? "page" : undefined}
                className={cn(
                  "group relative flex h-10 items-center overflow-hidden rounded-2xl border transition-[gap,padding,background-color,border-color,color,box-shadow,filter] duration-[250ms] ease-out",
                  sidebarCollapsed ? "justify-center" : "gap-2.5 px-2.5",
                  developerEventsActive
                    ? [
                        APPLICATION_IDENTITIES.developer.theme.surface,
                        APPLICATION_IDENTITIES.developer.theme.border,
                        APPLICATION_IDENTITIES.developer.theme.foreground,
                        APPLICATION_IDENTITIES.developer.theme.glow,
                      ]
                    : [
                        "border-transparent text-muted-foreground",
                        APPLICATION_IDENTITIES.developer.theme.hover,
                      ],
                )}
              >
                {developerEventsActive && (
                  <>
                    <span
                      className={cn(
                        "absolute inset-y-2 left-0 w-0.5 rounded-full",
                        APPLICATION_IDENTITIES.developer.theme.dot,
                        APPLICATION_IDENTITIES.developer.theme.glow,
                      )}
                    />
                    <span
                      className={cn(
                        "absolute inset-0 bg-gradient-to-r opacity-40",
                        APPLICATION_IDENTITIES.developer.theme.gradient,
                      )}
                    />
                  </>
                )}

                <ApplicationIcon
                  application="developer"
                  size="xs"
                  className={`relative z-10 transition-all duration-200 group-hover:scale-105 ${
                    developerEventsActive
                      ? "opacity-100"
                      : "opacity-75 group-hover:opacity-100"
                  }`}
                />

                <span
                  aria-hidden={sidebarCollapsed}
                  className={`relative z-10 flex min-w-0 flex-1 items-center justify-between overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out ${
                    sidebarCollapsed
                      ? "max-w-0 -translate-x-1 opacity-0"
                      : "max-w-40 translate-x-0 opacity-100"
                  }`}
                >
                  <span
                    className={`truncate text-[13px] ${
                      developerEventsActive ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {APPLICATION_IDENTITIES.developer.label}
                  </span>

                  {developerEventsActive && (
                    <span
                      className={cn(
                        "ml-2 h-1.5 w-1.5 shrink-0 rounded-full",
                        APPLICATION_IDENTITIES.developer.theme.dot,
                        APPLICATION_IDENTITIES.developer.theme.glow,
                      )}
                    />
                  )}
                </span>
              </Link>
            </div>
          )}
        </nav>

        <div
          className={cn(
            "group relative overflow-hidden rounded-lg border border-sidebar-border bg-sidebar-accent/30 shadow-lg",
            APPLICATION_IDENTITIES.momentum.theme.hover,
            sidebarCollapsed
              ? "flex h-12 items-center justify-center"
              : "px-3 py-2",
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-200 group-hover:opacity-20",
              APPLICATION_IDENTITIES.momentum.theme.gradient,
            )}
          />
          <UserMenu collapsed={sidebarCollapsed} />
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
        className={`min-w-0 flex-1 transition-[padding-left] duration-[250ms] ease-out will-change-[padding-left] ${
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
            className="h-10 w-10 rounded-xl border border-border/70 bg-background/60 text-muted-foreground shadow-sm hover:bg-secondary-accent/10 hover:text-secondary-accent"
          >
            <Menu className="h-[18px] w-[18px]" />
          </Button>
        </div>

        <ApplicationHeader
          application={headerApplication}
          pageNavigation={pageNavigation}
          pageActions={pageActions}
        />

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
  /** Navigation rendered in the centered portion of the application header. */
  pageNavigation?: ReactNode;
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
      <AppShellInner
        subApp={subApp}
        pageNavigation={props.pageNavigation}
        pageActions={pageActions}
      >
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
          <p className="text-sm font-medium text-secondary-accent">{eyebrow}</p>
        )}
        <h2 className="text-xl font-bold tracking-tight md:text-2xl">
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
