/**
 * Frontend telemetry API module.
 *
 * Provides typed access to POST /api/v1/frontend-errors (write) and
 * GET /api/v1/frontend-errors (read, for developer inspection).
 *
 * The logger.ts handles persistence directly via fetch (to keep it
 * independent of this module). This module is for any explicit consumer
 * that wants to read stored events.
 */

import { apiClient } from "./client";
import type {
  BackendLogEventResponse,
  FrontendErrorEventResponse,
} from "@/types/developer";

const BASE = "/v1/frontend-errors";

export interface FrontendErrorListParams {
  limit?: number;
  source?: string;
  level?: string;
  fingerprint?: string;
  since?: string; // ISO-8601 timestamp
}

export interface BackendLogListParams {
  limit?: number;
  level?: string;
  fingerprint?: string;
  requestId?: string;
  since?: string;
}

function addSince(search: URLSearchParams, since?: string): void {
  if (!since) return;
  const parsed = new Date(since);
  search.set(
    "since",
    Number.isNaN(parsed.getTime()) ? since : parsed.toISOString(),
  );
}

export const telemetryApi = {
  /**
   * List persisted frontend error events.
   * Intended for developer inspection — not user-facing.
   */
  listErrors(
    params: FrontendErrorListParams = {},
  ): Promise<FrontendErrorEventResponse[]> {
    const search = new URLSearchParams();
    if (params.limit != null) search.set("limit", String(params.limit));
    if (params.source) search.set("source", params.source);
    if (params.level) search.set("level", params.level);
    if (params.fingerprint) search.set("fingerprint", params.fingerprint);
    addSince(search, params.since);
    const query = search.toString();
    return apiClient.get<FrontendErrorEventResponse[]>(
      query ? `${BASE}?${query}` : BASE,
      { suppressTelemetry: true },
    );
  },

  listBackendLogs(
    params: BackendLogListParams = {},
  ): Promise<BackendLogEventResponse[]> {
    const search = new URLSearchParams();
    if (params.limit != null) search.set("limit", String(params.limit));
    if (params.level) search.set("level", params.level);
    if (params.fingerprint) search.set("fingerprint", params.fingerprint);
    if (params.requestId) search.set("request_id", params.requestId);
    addSince(search, params.since);
    const query = search.toString();
    const path = query ? `/v1/backend-logs?${query}` : "/v1/backend-logs";
    return apiClient.get<BackendLogEventResponse[]>(path, {
      suppressTelemetry: true,
    });
  },
};
