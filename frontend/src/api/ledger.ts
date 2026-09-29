/**
 * Ledger API module.
 *
 * Encapsulates all /api/v1/ledger/* endpoint paths.
 * Components must not own endpoint strings directly.
 *
 * All rate fields returned by the backend are 0..1 ratios.
 * Percentage conversion happens only at the presentation boundary (in components).
 */

import { apiClient } from "./client";
import type {
  DailyEntryRecordRequest,
  DailyEntryResponse,
  DayEntryResponse,
  HistoryEntryResponse,
  OverallStatsResponse,
  TaskCreateRequest,
  TaskResponse,
  TaskStatsResponse,
  TaskUpdateRequest,
} from "@/types/ledger";

const BASE = "/v1/ledger";

export const ledgerApi = {
  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  /**
   * List tasks.
   * @param includeArchived - When true, returns active + archived tasks.
   */
  listTasks(includeArchived = false): Promise<TaskResponse[]> {
    const path = includeArchived
      ? `${BASE}/tasks?include_archived=true`
      : `${BASE}/tasks`;
    return apiClient.get<TaskResponse[]>(path);
  },

  /**
   * Get a single task by exact (case-insensitive) name.
   */
  getTask(taskName: string): Promise<TaskResponse> {
    return apiClient.get<TaskResponse>(
      `${BASE}/tasks/${encodeURIComponent(taskName)}`,
    );
  },

  /**
   * Create a new task.
   */
  createTask(payload: TaskCreateRequest): Promise<TaskResponse> {
    return apiClient.post<TaskResponse>(`${BASE}/tasks`, payload);
  },

  /**
   * Edit an existing active task by name.
   */
  updateTask(
    taskName: string,
    payload: TaskUpdateRequest,
  ): Promise<TaskResponse> {
    return apiClient.patch<TaskResponse>(
      `${BASE}/tasks/${encodeURIComponent(taskName)}`,
      payload,
    );
  },

  /**
   * Archive an active task by name. Preserves historical records.
   */
  archiveTask(taskName: string): Promise<TaskResponse> {
    return apiClient.post<TaskResponse>(
      `${BASE}/tasks/${encodeURIComponent(taskName)}/archive`,
      {},
    );
  },

  /**
   * Restore an archived task by its stable numeric ID.
   */
  restoreTask(taskId: number): Promise<TaskResponse> {
    return apiClient.post<TaskResponse>(`${BASE}/tasks/${taskId}/restore`, {});
  },

  // ---------------------------------------------------------------------------
  // Tracking / Entries
  // ---------------------------------------------------------------------------

  /**
   * Record or update a YES/NO entry for a task on a specific date.
   * date must be "YYYY-MM-DD".
   */
  recordEntry(payload: DailyEntryRecordRequest): Promise<DailyEntryResponse> {
    return apiClient.post<DailyEntryResponse>(`${BASE}/entries`, payload);
  },

  /**
   * Get all active tasks and their entry status for a given date.
   * date must be "YYYY-MM-DD".
   */
  getDayEntries(date: string): Promise<DayEntryResponse[]> {
    return apiClient.get<DayEntryResponse[]>(
      `${BASE}/entries?date=${encodeURIComponent(date)}`,
    );
  },

  /**
   * Get historical YES/NO entries.
   * All params are optional. date strings are "YYYY-MM-DD".
   */
  getHistory(params?: {
    taskName?: string;
    from?: string;
    to?: string;
  }): Promise<HistoryEntryResponse[]> {
    const search = new URLSearchParams();
    if (params?.taskName) search.set("task_name", params.taskName);
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    const query = search.toString();
    return apiClient.get<HistoryEntryResponse[]>(
      query ? `${BASE}/history?${query}` : `${BASE}/history`,
    );
  },

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  /**
   * Get aggregate statistics across eligible tasks.
   * @param days - 1–365 calendar days to analyze.
   * @param referenceDate - Optional end date "YYYY-MM-DD". Defaults to today.
   */
  getOverallStats(
    days = 90,
    referenceDate?: string,
  ): Promise<OverallStatsResponse> {
    const params = new URLSearchParams({ days: String(days) });
    if (referenceDate) params.set("reference_date", referenceDate);
    return apiClient.get<OverallStatsResponse>(
      `${BASE}/stats?${params.toString()}`,
    );
  },

  /**
   * Get statistics for a specific task by name.
   * @param taskName - Case-insensitive task name.
   * @param days - 1–365 calendar days to analyze.
   * @param referenceDate - Optional end date "YYYY-MM-DD". Defaults to today.
   */
  getTaskStats(
    taskName: string,
    days = 90,
    referenceDate?: string,
  ): Promise<TaskStatsResponse> {
    const params = new URLSearchParams({ days: String(days) });
    if (referenceDate) params.set("reference_date", referenceDate);
    return apiClient.get<TaskStatsResponse>(
      `${BASE}/stats/tasks/${encodeURIComponent(taskName)}?${params.toString()}`,
    );
  },
};
