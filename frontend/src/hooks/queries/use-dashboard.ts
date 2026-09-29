/**
 * TanStack Query hook for the Momentum dashboard.
 *
 * Uses the existing QueryClient provided by the root route context.
 * Query key includes the `days` period so period changes trigger a fresh fetch.
 */

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboard";
import type { DashboardResponse } from "@/types/dashboard";

export const DASHBOARD_QUERY_KEY_BASE = "dashboard" as const;

export function dashboardQueryKey(days: number) {
  return [DASHBOARD_QUERY_KEY_BASE, { days }] as const;
}

export function useDashboard(days: number = 30) {
  return useQuery<DashboardResponse, Error>({
    queryKey: dashboardQueryKey(days),
    queryFn: () => dashboardApi.getDashboard(days),
  });
}
