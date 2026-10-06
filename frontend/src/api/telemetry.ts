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
import type { FrontendErrorEvent } from "@/lib/telemetry/types";

const BASE = "/v1/frontend-errors";

export interface FrontendErrorListParams {
  limit?: number;
  source?: string;
  level?: string;
  fingerprint?: string;
  since?: string; // ISO-8601 timestamp
}

export const telemetryApi = {
  /**
   * List persisted frontend error events.
   * Intended for developer inspection — not user-facing.
   */
  listErrors(
    params: FrontendErrorListParams = {},
  ): Promise<FrontendErrorEvent[]> {
    const search = new URLSearchParams();
    if (params.limit != null) search.set("limit", String(params.limit));
    if (params.source) search.set("source", params.source);
    if (params.level) search.set("level", params.level);
    if (params.fingerprint) search.set("fingerprint", params.fingerprint);
    if (params.since) search.set("since", params.since);
    const query = search.toString();
    return apiClient.get<FrontendErrorEvent[]>(
      query ? `${BASE}?${query}` : BASE,
    );
  },
};
