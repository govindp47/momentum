import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/api/client";
import { AuthPage } from "@/components/auth/auth-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignup } from "@/hooks/queries/use-auth";

type SetupSearch = { redirect?: string };

export const Route = createFileRoute("/setup")({
  validateSearch: (search: Record<string, unknown>): SetupSearch => {
    const validated: SetupSearch = {};
    if (typeof search["redirect"] === "string") {
      validated.redirect = search["redirect"];
    }
    return validated;
  },
  head: () => ({
    meta: [
      { title: "Set up Momentum" },
      {
        name: "description",
        content: "Create the owner account for this Momentum workspace.",
      },
    ],
  }),
  component: SetupPage,
});

function setupErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Momentum couldn't create your account. Please try again.";
  }
  if (error.status === 0) {
    return "Momentum couldn't reach the local server. Check your connection and try again.";
  }
  if (error.status === 409) {
    return "Momentum setup has already been completed.";
  }
  if (error.status === 422) {
    return error.message;
  }
  return "Momentum couldn't create your account. Please try again.";
}

function SetupPage() {
  const signup = useSignup();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signup.isPending) return;

    const normalizedName = name.trim();
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedName) {
      setValidationError("Enter your name.");
      return;
    }
    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 64 ||
      !/^[a-z0-9][a-z0-9._-]*$/.test(normalizedUsername)
    ) {
      setValidationError(
        "Username must be 3–64 characters using lowercase letters, numbers, dots, underscores, or hyphens.",
      );
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setValidationError("Password must be between 12 and 128 characters.");
      return;
    }
    if (password !== confirmation) {
      setValidationError("Passwords do not match.");
      return;
    }

    setValidationError(null);
    signup.reset();
    try {
      await signup.mutateAsync({
        name: normalizedName,
        username: normalizedUsername,
        password,
      });
      setPassword("");
      setConfirmation("");
    } catch {
      // Mutation state owns the user-facing error.
    }
  }

  const error =
    validationError ?? (signup.error ? setupErrorMessage(signup.error) : null);

  return (
    <AuthPage
      title="Set up Momentum"
      description="Create your personal account to get started."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="setup-name">Name</Label>
          <Input
            id="setup-name"
            name="name"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={signup.isPending}
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-username">Username</Label>
          <Input
            id="setup-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={64}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={signup.isPending}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-password">Password</Label>
          <Input
            id="setup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={signup.isPending}
            required
          />
          <p className="text-xs text-muted-foreground">
            Use at least 12 characters.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="setup-confirmation">Confirm password</Label>
          <Input
            id="setup-confirmation"
            name="password-confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={signup.isPending}
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
          disabled={signup.isPending}
        >
          {signup.isPending && <LoaderCircle className="animate-spin" />}
          {signup.isPending ? "Creating account…" : "Create Momentum account"}
        </Button>
      </form>
    </AuthPage>
  );
}
