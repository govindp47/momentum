import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { SESSION_EXPIRED_EVENT } from "@/api/client";
import { Button } from "@/components/ui/button";
import { expireSession, useAuth } from "@/hooks/queries/use-auth";

const PUBLIC_ROUTES = new Set(["/login", "/setup"]);

function safeRedirect(value: unknown): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login") &&
    !value.startsWith("/setup")
    ? value
    : "/";
}

function BootstrapScreen({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-secondary-accent/20 bg-secondary-accent/10 text-secondary-accent shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold">Momentum identity</p>
        {error ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 rounded-lg"
              onClick={onRetry}
            >
              <RefreshCw /> Retry
            </Button>
          </>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Checking your session…
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const isPublicRoute = PUBLIC_ROUTES.has(location.pathname);
  const search = location.search as { redirect?: unknown };

  useEffect(() => {
    const handleSessionExpired = () => {
      const redirect = safeRedirect(location.href);
      expireSession(queryClient);
      void navigate({
        to: "/login",
        search: { redirect, reason: "session-expired" },
        replace: true,
      });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [location.href, navigate, queryClient]);

  useEffect(() => {
    if (auth.loading || auth.isError) return;

    if (auth.setupRequired && location.pathname !== "/setup") {
      void navigate({
        to: "/setup",
        search: { redirect: safeRedirect(location.href) },
        replace: true,
      });
      return;
    }

    if (!auth.setupRequired && !auth.authenticated) {
      if (location.pathname !== "/login") {
        const redirect = isPublicRoute
          ? safeRedirect(search.redirect)
          : safeRedirect(location.href);
        void navigate({ to: "/login", search: { redirect }, replace: true });
      }
      return;
    }

    if (auth.authenticated && isPublicRoute) {
      void navigate({
        to: safeRedirect(search.redirect),
        replace: true,
      });
      return;
    }

    if (
      auth.authenticated &&
      location.pathname.startsWith("/developer") &&
      (!auth.developerAuthorized || !auth.developerModeEnabled)
    ) {
      void navigate({ to: "/", replace: true });
    }
  }, [
    auth.authenticated,
    auth.developerAuthorized,
    auth.developerModeEnabled,
    auth.isError,
    auth.loading,
    auth.setupRequired,
    isPublicRoute,
    location.href,
    location.pathname,
    navigate,
    search.redirect,
  ]);

  if (auth.loading) {
    return <BootstrapScreen />;
  }

  if (auth.isError) {
    return (
      <BootstrapScreen
        error="Momentum couldn't verify your session. Check that the local server is available."
        onRetry={() => void auth.refetch()}
      />
    );
  }

  const canRender = auth.setupRequired
    ? location.pathname === "/setup"
    : auth.authenticated
      ? !isPublicRoute &&
        (!location.pathname.startsWith("/developer") ||
          (auth.developerAuthorized && auth.developerModeEnabled))
      : location.pathname === "/login";

  return canRender ? children : <BootstrapScreen />;
}
