// Generic application error reporting.
// Routes unexpected errors to the frontend telemetry system for persistence.

import { frontendLogger } from "./telemetry/logger";

export function reportMomentumError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  // Log to console so errors remain visible in development and server logs.
  console.error("[Momentum] Error boundary caught:", error, context);

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "React error boundary caught an unexpected error";

  const boundary =
    typeof context["boundary"] === "string" ? context["boundary"] : undefined;
  const hasContext = Object.keys(context).length > 0;

  // Persist to telemetry for developer investigation.
  frontendLogger.error({
    source: "react",
    message,
    error,
    ...(boundary !== undefined && { component: boundary }),
    ...(hasContext && { metadata: context }),
  });
}
