/**
 * Frontend telemetry event types.
 *
 * A FrontendErrorEvent captures everything a developer needs to investigate,
 * reproduce, and fix a frontend bug. It is persisted to the local SQLite
 * database through POST /api/v1/frontend-errors.
 */

// ---------------------------------------------------------------------------
// Classification enums
// ---------------------------------------------------------------------------

/** Where in the frontend the error originated. */
export type TelemetrySource =
  | "react" // React render / error boundary
  | "window" // window.onerror (uncaught JS error)
  | "promise" // unhandledrejection
  | "api" // API client / HTTP layer
  | "application"; // explicit logger.error / logger.warn calls

/** Severity. Only errors and warnings are persisted — not info/debug. */
export type TelemetryLevel = "error" | "warning";

// ---------------------------------------------------------------------------
// Structured event payload
// ---------------------------------------------------------------------------

/** Context gathered from the runtime environment. */
export interface RuntimeContext {
  app_version: string;
  user_agent: string;
  viewport_width: number;
  viewport_height: number;
  online_status: boolean;
}

/** Details captured specifically for API/HTTP failures. */
export interface ApiContext {
  http_method: string;
  endpoint: string;
  status_code: number;
}

/**
 * The canonical telemetry event.
 *
 * All fields are optional except the identity/classification group.
 * Consumers must handle missing fields gracefully.
 */
export interface FrontendErrorEvent {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Client-side UUID for this occurrence (not the fingerprint). */
  id: string;
  /** UTC ISO-8601 timestamp of when the error occurred. */
  timestamp: string;
  /**
   * Stable deterministic fingerprint derived from error class/message/route.
   * Does not include timestamp or the event id so repeated occurrences of
   * the same bug share the same fingerprint.
   */
  fingerprint: string;

  // ── Classification ────────────────────────────────────────────────────────
  level: TelemetryLevel;
  source: TelemetrySource;
  /** e.g. "TypeError", "ApiError", "Error" */
  error_name?: string;
  /** Human-readable description of the failure. */
  message: string;

  // ── Location / context ────────────────────────────────────────────────────
  /** TanStack Router pathname at the time of the error. */
  route?: string;
  /** Full URL (query params sanitized). */
  url?: string;
  /** React component name (for source === "react"). */
  component?: string;
  /** Logical operation that was running (e.g. "load today's commitments"). */
  operation?: string;

  // ── Error details ─────────────────────────────────────────────────────────
  stack?: string;
  /** React componentStack string from error boundaries. */
  component_stack?: string;
  /** Stringified cause chain when available. */
  cause?: string;

  // ── Global error location ─────────────────────────────────────────────────
  filename?: string;
  error_lineno?: number;
  error_colno?: number;

  // ── API details ───────────────────────────────────────────────────────────
  http_method?: string;
  endpoint?: string;
  status_code?: number;

  // ── Runtime context ───────────────────────────────────────────────────────
  runtime: RuntimeContext;

  // ── Arbitrary structured metadata (bounded, sanitized) ────────────────────
  metadata?: Record<string, unknown>;
}

/**
 * The subset of FrontendErrorEvent fields a caller provides when explicitly
 * calling logger.error / logger.warn. The logger fills in the rest.
 */
export interface LogEventInput {
  level: TelemetryLevel;
  source: TelemetrySource;
  message: string;
  error?: unknown;
  /** Pre-normalized error name (when error is not an Error instance). */
  error_name?: string;
  route?: string;
  component?: string;
  operation?: string;
  /** For API errors. */
  http_method?: string;
  endpoint?: string;
  status_code?: number;
  /** For window.onerror: source file. */
  filename?: string;
  /** For window.onerror: line number. */
  error_lineno?: number;
  /** For window.onerror: column number. */
  error_colno?: number;
  metadata?: Record<string, unknown>;
}
