// Generic application error reporting.
// Future: wire this up to a real error monitoring service if needed.

export function reportMomentumError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  // Log to console so errors remain visible in development and server logs.
  console.error("[Momentum] Error boundary caught:", error, context);
}
