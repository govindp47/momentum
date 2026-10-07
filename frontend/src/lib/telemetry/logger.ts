/**
 * Central frontend telemetry logger.
 *
 * Responsibilities:
 *  - Accept structured error/warning reports from any frontend layer.
 *  - Normalize, sanitize, fingerprint, and enrich them with runtime context.
 *  - Persist asynchronously to POST /api/v1/frontend-errors (best-effort).
 *  - Never throw, never block the UI, never crash on telemetry failure.
 *  - Guard against recursive error→logger→error loops.
 *
 * Usage:
 *   import { frontendLogger } from "@/lib/telemetry";
 *   frontendLogger.error({ source: "application", message: "...", error: err });
 *   frontendLogger.warn({ source: "application", message: "...", operation: "..." });
 */

import type {
  FrontendErrorEvent,
  LogEventInput,
  RuntimeContext,
} from "./types";
import { normalizeError } from "./normalize";
import { generateFingerprint } from "./fingerprint";
import { sanitizeMetadata, sanitizeUrl } from "./sanitize";

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

// Injected by Vite at build time from package.json "version".
// Falls back to "unknown" if not set.
const APP_VERSION: string =
  (import.meta.env["VITE_APP_VERSION"] as string | undefined) ?? "unknown";

// ---------------------------------------------------------------------------
// Recursion guard
// ---------------------------------------------------------------------------

/** Prevents telemetry failures from recursively triggering more telemetry. */
let _isLogging = false;

// ---------------------------------------------------------------------------
// Route accessor
// ---------------------------------------------------------------------------

/**
 * Mutable reference to the current TanStack Router location.
 * Set by installTelemetryRouteTracker() in __root.tsx.
 */
let _currentRoute = "";

export function setCurrentRoute(route: string): void {
  _currentRoute = route;
}

export function getCurrentRoute(): string {
  return _currentRoute;
}

// ---------------------------------------------------------------------------
// Logger implementation
// ---------------------------------------------------------------------------

const TELEMETRY_ENDPOINT = "/v1/frontend-errors";

/**
 * Build and persist a telemetry event. Returns immediately; persistence is
 * fire-and-forget.
 */
function _log(input: LogEventInput): void {
  // Recursion guard: if logging itself causes an error, bail out silently.
  if (_isLogging) return;
  _isLogging = true;

  try {
    const normalized = input.error != null ? normalizeError(input.error) : null;

    const route = input.route ?? _currentRoute;
    const url = sanitizeUrl(
      typeof window !== "undefined" ? window.location.href : undefined,
    );
    const runtime = buildRuntimeContext();

    // Derive optional values — undefined means "absent", not "present as undefined"
    const errorName: string | undefined =
      normalized?.name ?? input.error_name ?? undefined;
    const stack: string | undefined = normalized?.stack ?? undefined;
    const cause: string | undefined = normalized?.cause ?? undefined;
    const routeValue: string | undefined = route || undefined;
    const sanitizedMetadata = sanitizeMetadata(input.metadata);
    const fingerprintEndpoint: string | undefined = input.endpoint ?? undefined;

    const event: FrontendErrorEvent = {
      // Identity
      id: generateId(),
      timestamp: new Date().toISOString(),
      fingerprint: generateFingerprint({
        source: input.source,
        ...(errorName !== undefined && { error_name: errorName }),
        message: input.message,
        ...(routeValue !== undefined && { route: routeValue }),
        ...(stack !== undefined && { stack }),
        ...(fingerprintEndpoint !== undefined && {
          endpoint: fingerprintEndpoint,
        }),
      }),

      // Classification
      level: input.level,
      source: input.source,
      message: input.message,
      ...(errorName !== undefined && { error_name: errorName }),

      // Location
      ...(routeValue !== undefined && { route: routeValue }),
      ...(url !== undefined && { url }),
      ...(input.component !== undefined && { component: input.component }),
      ...(input.operation !== undefined && { operation: input.operation }),

      // Error details
      ...(stack !== undefined && { stack }),
      ...(cause !== undefined && { cause }),

      // Global error location
      ...(input.filename !== undefined && { filename: input.filename }),
      ...(input.error_lineno !== undefined && {
        error_lineno: input.error_lineno,
      }),
      ...(input.error_colno !== undefined && {
        error_colno: input.error_colno,
      }),

      // API details
      ...(input.http_method !== undefined && {
        http_method: input.http_method,
      }),
      ...(input.endpoint !== undefined && { endpoint: input.endpoint }),
      ...(input.status_code !== undefined && {
        status_code: input.status_code,
      }),

      // Runtime
      runtime,

      // Metadata (sanitized)
      ...(sanitizedMetadata !== undefined && { metadata: sanitizedMetadata }),
    };

    // Fire-and-forget: do not await, do not let failure propagate.
    void _persist(event);
  } catch {
    // Silently swallow — telemetry must never crash the application.
  } finally {
    _isLogging = false;
  }
}

/**
 * Persist the event via POST to the backend. Best-effort, swallows all errors.
 */
async function _persist(event: FrontendErrorEvent): Promise<void> {
  try {
    const apiBase: string =
      (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api";
    await fetch(`${apiBase}${TELEMETRY_ENDPOINT}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      // Use keepalive so the request survives page unloads.
      keepalive: true,
      body: JSON.stringify(event),
    });
  } catch {
    // Offline or server error — swallow silently.
    // Per spec: telemetry failure must never disrupt the application.
  }
}

// ---------------------------------------------------------------------------
// Runtime context
// ---------------------------------------------------------------------------

function buildRuntimeContext(): RuntimeContext {
  try {
    return {
      app_version: APP_VERSION,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      viewport_width: typeof window !== "undefined" ? window.innerWidth : 0,
      viewport_height: typeof window !== "undefined" ? window.innerHeight : 0,
      online_status: typeof navigator !== "undefined" ? navigator.onLine : true,
    };
  } catch {
    return {
      app_version: APP_VERSION,
      user_agent: "unknown",
      viewport_width: 0,
      viewport_height: 0,
      online_status: true,
    };
  }
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for environments without crypto.randomUUID
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const frontendLogger = {
  /**
   * Record an unexpected frontend error for developer investigation.
   *
   * @example
   * frontendLogger.error({
   *   source: "application",
   *   message: "Failed to process entry",
   *   error: err,
   *   operation: "record daily entry",
   * });
   */
  error(input: Omit<LogEventInput, "level">): void {
    _log({ ...input, level: "error" });
  },

  /**
   * Record a frontend warning worth investigating.
   *
   * @example
   * frontendLogger.warn({
   *   source: "application",
   *   message: "Unexpected null response from API",
   *   operation: "fetch dashboard",
   * });
   */
  warn(input: Omit<LogEventInput, "level">): void {
    _log({ ...input, level: "warning" });
  },
} as const;

export type { LogEventInput };
