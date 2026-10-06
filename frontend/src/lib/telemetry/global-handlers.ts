/**
 * Global browser error handlers for frontend telemetry.
 *
 * Captures:
 *  - window.onerror   — uncaught synchronous JavaScript errors
 *  - unhandledrejection — uncaught Promise rejections
 *
 * Design:
 *  - Preserves any existing handlers that were installed before this module.
 *  - Never throws.
 *  - Reports to frontendLogger only; does not call console.error itself
 *    (the existing error-capture.ts already wraps console.error on the server side).
 *
 * Call installGlobalHandlers() once at application startup.
 */

import { frontendLogger } from "./logger";

let _installed = false;

/**
 * Install window.onerror and unhandledrejection handlers.
 * Idempotent — safe to call multiple times.
 */
export function installGlobalHandlers(): void {
  if (_installed) return;
  if (typeof window === "undefined") return; // SSR guard

  _installed = true;

  installWindowOnError();
  installUnhandledRejection();
}

// ---------------------------------------------------------------------------
// window.onerror
// ---------------------------------------------------------------------------

function installWindowOnError(): void {
  const previousHandler = window.onerror;

  window.onerror = function (
    event: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error,
  ): boolean | undefined {
    // Run previous handler first (preserves existing behavior).
    let previousResult: boolean | undefined;
    if (typeof previousHandler === "function") {
      try {
        previousResult = previousHandler.call(
          this,
          event,
          source,
          lineno,
          colno,
          error,
        ) as boolean | undefined;
      } catch {
        // Swallow errors in the previous handler.
      }
    }

    try {
      const message =
        typeof event === "string"
          ? event
          : event instanceof ErrorEvent
            ? event.message
            : "Uncaught JavaScript error";

      frontendLogger.error({
        source: "window",
        message,
        ...(error !== undefined && { error }),
        ...(source !== undefined && { filename: source }),
        ...(lineno !== undefined && { error_lineno: lineno }),
        ...(colno !== undefined && { error_colno: colno }),
        // Include location in metadata for context even if error is null
        metadata: {
          filename: source ?? null,
          lineno: lineno ?? null,
          colno: colno ?? null,
        },
      });
    } catch {
      // Telemetry must never affect the application.
    }

    return previousResult;
  };
}

// ---------------------------------------------------------------------------
// unhandledrejection
// ---------------------------------------------------------------------------

function installUnhandledRejection(): void {
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  try {
    const reason: unknown = event.reason;
    const message = extractRejectionMessage(reason);

    const isError = reason instanceof Error;
    const hasReason = !isError && reason != null;

    frontendLogger.error({
      source: "promise",
      message,
      ...(isError && { error: reason }),
      ...(hasReason && {
        metadata: { rejection_reason: safeMetadataValue(reason) },
      }),
    });
  } catch {
    // Swallow.
  }
}

function extractRejectionMessage(reason: unknown): string {
  if (reason == null)
    return "Unhandled promise rejection (null/undefined reason)";
  if (reason instanceof Error)
    return reason.message || "Unhandled promise rejection";
  if (typeof reason === "string")
    return reason || "Unhandled promise rejection (empty string)";
  try {
    const str = JSON.stringify(reason);
    const bounded =
      str && str.length <= 300 ? str : "[complex rejection reason]";
    return `Unhandled promise rejection: ${bounded}`;
  } catch {
    return "Unhandled promise rejection (unserializable reason)";
  }
}

function safeMetadataValue(value: unknown): string {
  try {
    const str = JSON.stringify(value);
    return str ? str.slice(0, 300) : String(value);
  } catch {
    return String(value);
  }
}
