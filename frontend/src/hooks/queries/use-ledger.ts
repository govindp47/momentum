/**
 * TanStack Query hooks for all Ledger server state.
 *
 * Query key conventions:
 *   ["ledger", "tasks", { includeArchived }]
 *   ["ledger", "today", date]
 *   ["ledger", "history", { from, to, taskName }]
 *   ["ledger", "stats", { days }]
 *   ["ledger", "weekly-stats", weekCount]
 *
 * Rates from the backend are 0..1 ratios. This file does not convert them.
 * Presentation conversion (ratio × 100) happens only in components.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { ledgerApi } from "@/api/ledger";
import type {
  DailyEntryRecordRequest,
  DayEntryResponse,
  HistoryEntryResponse,
  OverallStatsResponse,
  TaskCreateRequest,
  TaskResponse,
  TaskUpdateRequest,
} from "@/types/ledger";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const ledgerKeys = {
  all: ["ledger"] as const,
  tasks: (includeArchived = false) =>
    ["ledger", "tasks", { includeArchived }] as const,
  today: (date: string) => ["ledger", "today", date] as const,
  history: (params: { from?: string; to?: string; taskName?: string }) =>
    ["ledger", "history", params] as const,
  stats: (days: number) => ["ledger", "stats", { days }] as const,
  weeklyStats: (weekCount: number) =>
    ["ledger", "weekly-stats", weekCount] as const,
} as const;

// ---------------------------------------------------------------------------
// Utility: format a Date as "YYYY-MM-DD" without timezone shifting
// ---------------------------------------------------------------------------

export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Return today's date as "YYYY-MM-DD" in local time. */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** List active tasks (no archived). */
export function useLedgerTasks() {
  return useQuery<TaskResponse[], Error>({
    queryKey: ledgerKeys.tasks(false),
    queryFn: () => ledgerApi.listTasks(false),
  });
}

/** List all tasks including archived. */
export function useLedgerAllTasks() {
  return useQuery<TaskResponse[], Error>({
    queryKey: ledgerKeys.tasks(true),
    queryFn: () => ledgerApi.listTasks(true),
  });
}

// ---------------------------------------------------------------------------
// Today's entries
// ---------------------------------------------------------------------------

/** Fetch active tasks + their entry status for a specific calendar date. */
export function useLedgerToday(date: string) {
  return useQuery<DayEntryResponse[], Error>({
    queryKey: ledgerKeys.today(date),
    queryFn: () => ledgerApi.getDayEntries(date),
  });
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** Fetch historical YES/NO entries for a date range / task filter. */
export function useLedgerHistory(params: {
  from?: string;
  to?: string;
  taskName?: string;
}) {
  return useQuery<HistoryEntryResponse[], Error>({
    queryKey: ledgerKeys.history(params),
    queryFn: () => ledgerApi.getHistory(params),
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Fetch aggregate statistics across all eligible tasks. */
export function useLedgerStats(days = 90) {
  return useQuery<OverallStatsResponse, Error>({
    queryKey: ledgerKeys.stats(days),
    queryFn: () => ledgerApi.getOverallStats(days),
  });
}

/**
 * Fetch weekly overall stats for the Insights chart.
 * Calls GET /stats?days=7&reference_date=... for each of the past `weekCount` weeks.
 * Results are returned oldest-first (index 0 = oldest week).
 * Each value is avg_rate converted to 0–100 integer (0 when no data that week).
 */
export function useLedgerWeeklyStats(weekCount = 12) {
  return useQuery<number[], Error>({
    queryKey: ledgerKeys.weeklyStats(weekCount),
    queryFn: async () => {
      const today = new Date();
      // Build reference dates oldest-first
      const refDates: string[] = Array.from({ length: weekCount }, (_, i) => {
        // i=0 → oldest (weekCount-1 weeks ago), i=weekCount-1 → most recent (today)
        const offset = (weekCount - 1 - i) * 7;
        const d = new Date(today);
        d.setDate(d.getDate() - offset);
        return formatLocalDate(d);
      });

      // backend is not supporting the concurrent api calls
      // const snapshots = await Promise.all(
      //   refDates.map((ref) => ledgerApi.getOverallStats(7, ref)),
      // );

      const snapshots: OverallStatsResponse[] = [];

      for (const ref of refDates) {
        const snapshot = await ledgerApi.getOverallStats(7, ref);
        snapshots.push(snapshot);
      }

      return snapshots.map((s) =>
        s.avg_rate !== null ? Math.round(s.avg_rate * 100) : 0,
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Record or update a YES/NO entry for a task.
 * Invalidates today, history, and stats caches on success.
 */
export function useRecordEntry(todayDate: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DailyEntryRecordRequest>({
    mutationFn: async (payload) => {
      await ledgerApi.recordEntry(payload);
    },
    onSuccess: () => {
      // Invalidate the affected queries
      void queryClient.invalidateQueries({
        queryKey: ledgerKeys.today(todayDate),
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "history"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "stats"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "weekly-stats"],
        exact: false,
      });
    },
  }) as UseMutationResult<void, Error, DailyEntryRecordRequest>;
}

/**
 * Create a new task.
 * Invalidates tasks and today caches on success.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<TaskResponse, Error, TaskCreateRequest>({
    mutationFn: (payload) => ledgerApi.createTask(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "tasks"],
        exact: false,
      });
      // A new task may affect today's list
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "today"],
        exact: false,
      });
    },
  });
}

/**
 * Update an existing task by name.
 * Invalidates tasks and today caches on success.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<
    TaskResponse,
    Error,
    { taskName: string; payload: TaskUpdateRequest }
  >({
    mutationFn: ({ taskName, payload }) =>
      ledgerApi.updateTask(taskName, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "tasks"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "today"],
        exact: false,
      });
    },
  });
}

/**
 * Archive an active task by name.
 * Invalidates tasks, today, and stats caches.
 */
export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation<TaskResponse, Error, string>({
    mutationFn: (taskName) => ledgerApi.archiveTask(taskName),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "tasks"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "today"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "stats"],
        exact: false,
      });
    },
  });
}

/**
 * Restore an archived task by its numeric ID.
 * Invalidates tasks and today caches.
 */
export function useRestoreTask() {
  const queryClient = useQueryClient();

  return useMutation<TaskResponse, Error, number>({
    mutationFn: (taskId) => ledgerApi.restoreTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "tasks"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "today"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["ledger", "stats"],
        exact: false,
      });
    },
  });
}
