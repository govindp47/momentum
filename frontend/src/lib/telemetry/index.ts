/**
 * Frontend Telemetry — public API.
 *
 * Import from here rather than from individual submodules.
 */

export { frontendLogger, setCurrentRoute, getCurrentRoute } from "./logger";
export { installGlobalHandlers } from "./global-handlers";
export type {
  FrontendErrorEvent,
  LogEventInput,
  TelemetrySource,
  TelemetryLevel,
  RuntimeContext,
} from "./types";
