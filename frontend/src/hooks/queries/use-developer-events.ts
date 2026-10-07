import { useQuery } from "@tanstack/react-query";

import { telemetryApi } from "@/api/telemetry";
import { getEventSince } from "@/lib/developer-filters";
import type {
  BackendLogEventResponse,
  BackendLogFilters,
  FrontendErrorEventResponse,
  FrontendErrorFilters,
} from "@/types/developer";

export const DEVELOPER_EVENTS_QUERY_KEY = "developer-events" as const;

export function useFrontendErrors(
  filters: FrontendErrorFilters,
  enabled: boolean,
) {
  return useQuery<FrontendErrorEventResponse[], Error>({
    queryKey: [DEVELOPER_EVENTS_QUERY_KEY, "frontend", filters],
    queryFn: () =>
      telemetryApi.listErrors({
        limit: 100,
        source: filters.source,
        level: filters.level,
        since: getEventSince(filters.days),
      }),
    enabled,
    retry: false,
  });
}

export function useBackendLogs(filters: BackendLogFilters, enabled: boolean) {
  return useQuery<BackendLogEventResponse[], Error>({
    queryKey: [DEVELOPER_EVENTS_QUERY_KEY, "backend", filters],
    queryFn: () =>
      telemetryApi.listBackendLogs({
        limit: 100,
        level: filters.level,
        since: getEventSince(filters.days),
      }),
    enabled,
    retry: false,
  });
}
