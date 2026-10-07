import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/api/client";
import { AuthPage } from "@/components/auth/auth-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/queries/use-auth";

type LoginSearch = {
  redirect?: string;
  reason?: "session-expired";
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const validated: LoginSearch = {};
    if (typeof search["redirect"] === "string") {
      validated.redirect = search["redirect"];
    }
    if (search["reason"] === "session-expired") {
      validated.reason = "session-expired";
    }
    return validated;
  },
  head: () => ({
    meta: [
      { title: "Sign in to Momentum" },
      { name: "description", content: "Sign in to your Momentum workspace." },
    ],
  }),
  component: LoginPage,
});

function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Momentum couldn't sign you in. Please try again.";
  }
  if (error.status === 401) {
    return "Invalid username or password.";
  }
  if (error.status === 0) {
    return "Momentum couldn't reach the local server. Check your connection and try again.";
  }
  return "Momentum couldn't sign you in. Please try again.";
}

function LoginPage() {
  const { reason } = Route.useSearch();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (login.isPending) return;

    if (!username.trim() || !password) {
      setValidationError("Enter your username and password.");
      return;
    }

    setValidationError(null);
    login.reset();
    try {
      await login.mutateAsync({ username: username.trim(), password });
      setPassword("");
    } catch {
      // Mutation state owns the user-facing error.
    }
  }

  const error =
    validationError ?? (login.error ? loginErrorMessage(login.error) : null);

  return (
    <AuthPage title="Welcome back" description="Sign in to continue.">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {reason === "session-expired" && !error && (
          <Alert>
            <AlertDescription>
              Your session has expired. Please sign in again.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="login-username">Username</Label>
          <Input
            id="login-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={64}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={login.isPending}
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={login.isPending}
            required
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full rounded-lg"
          disabled={login.isPending}
        >
          {login.isPending && <LoaderCircle className="animate-spin" />}
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthPage>
  );
}
