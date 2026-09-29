/**
 * Dashboard API module.
 *
 * Encapsulates the endpoint path /api/v1/dashboard.
 * Components must not own endpoint strings directly.
 */

import { apiClient } from "./client";
import type { DashboardResponse } from "@/types/dashboard";

const DASHBOARD_PATH = "/v1/dashboard";

export const dashboardApi = {
  /**
   * Fetch the combined Momentum dashboard.
   *
   * @param days - Number of calendar days to include for LifeLedger statistics.
   *               Defaults to 30. Backend accepts 1–365.
   */
  getDashboard(days: number = 30): Promise<DashboardResponse> {
    const path =
      days === 30 ? DASHBOARD_PATH : `${DASHBOARD_PATH}?days=${String(days)}`;
    return apiClient.get<DashboardResponse>(path);
  },
};
