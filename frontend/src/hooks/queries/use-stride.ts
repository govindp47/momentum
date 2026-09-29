/**
 * TanStack Query hooks for all Stride server state.
 *
 * Query key conventions:
 *   ["stride", "dashboard"]
 *   ["stride", "journeys"]
 *   ["stride", "journeys", { status }]
 *   ["stride", "journey", journeyId]
 *   ["stride", "journey", journeyId, "milestones"]
 *   ["stride", "journey", journeyId, "progress", { limit, startDate, endDate }]
 *   ["stride", "journey", journeyId, "stats", { range, startDate, endDate }]
 *   ["stride", "journey", journeyId, "calendar", year]
 *   ["stride", "achievements"]
 *   ["stride", "achievements", journeyId]
 *
 * Date values ("YYYY-MM-DD") are transported as plain strings.
 * Use `formatLocalDate` / `todayLocalDate` (re-exported from this file) to
 * build local date strings safely — never use `new Date("YYYY-MM-DD")` which
 * shifts by timezone.
 *
 * Cache invalidation strategy:
 *   - Journey lifecycle mutations invalidate: journeys list, journey detail,
 *     journey stats, dashboard, achievements.
 *   - Milestone mutations invalidate: journey milestones, journey detail,
 *     journey stats, dashboard, achievements.
 *   - Progress mutations invalidate: journey progress, journey stats,
 *     journey calendar (all years), dashboard, achievements.
 *
 * The next phase (Stride UI) should be able to consume these hooks without
 * knowing any HTTP details.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { strideApi } from "@/api/stride";
import type {
  AchievementResponse,
  CalendarResponse,
  DateRangePreset,
  ExportJsonResponse,
  JourneyAnalyticsResponse,
  JourneyCreateRequest,
  JourneyResponse,
  JourneyUpdateRequest,
  MilestoneCompletionRequest,
  MilestoneCreateRequest,
  MilestoneReorderRequest,
  MilestoneResponse,
  MilestoneUpdateRequest,
  ProgressCreateRequest,
  ProgressEventResponse,
  ProgressUpdateRequest,
  StrideDashboardResponse,
} from "@/types/stride";

// ---------------------------------------------------------------------------
// Date utilities (re-exported so Stride pages don't need separate imports)
// ---------------------------------------------------------------------------

/**
 * Format a Date object as "YYYY-MM-DD" in local time.
 * Never passes the Date through ISO string parsing which shifts timezone.
 */
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
// Query key factory
// ---------------------------------------------------------------------------

export const strideKeys = {
  /** Root prefix — use for broad invalidation of all Stride queries. */
  all: ["stride"] as const,

  // Dashboard
  dashboard: () => ["stride", "dashboard"] as const,

  // Journeys list (optionally filtered by status)
  journeys: (status?: JourneyResponse["status"]) =>
    status !== undefined
      ? (["stride", "journeys", { status }] as const)
      : (["stride", "journeys"] as const),

  // Single journey
  journey: (journeyId: number) => ["stride", "journey", journeyId] as const,

  // Milestones for a journey
  milestones: (journeyId: number) =>
    ["stride", "journey", journeyId, "milestones"] as const,

  // Progress history for a journey (optionally scoped by query params)
  progress: (
    journeyId: number,
    params?: { limit?: number; startDate?: string; endDate?: string },
  ) =>
    params !== undefined
      ? (["stride", "journey", journeyId, "progress", params] as const)
      : (["stride", "journey", journeyId, "progress"] as const),

  // Analytics / stats for a journey (optionally scoped by range)
  stats: (
    journeyId: number,
    params?: {
      range?: DateRangePreset;
      startDate?: string;
      endDate?: string;
    },
  ) =>
    params !== undefined
      ? (["stride", "journey", journeyId, "stats", params] as const)
      : (["stride", "journey", journeyId, "stats"] as const),

  // Calendar activity for a journey + year
  calendar: (journeyId: number, year: number) =>
    ["stride", "journey", journeyId, "calendar", year] as const,

  // All achievements (optionally scoped by journey)
  achievements: (journeyId?: number) =>
    journeyId !== undefined
      ? (["stride", "achievements", journeyId] as const)
      : (["stride", "achievements"] as const),
} as const;

// ---------------------------------------------------------------------------
// Invalidation helpers (used internally by mutations)
// ---------------------------------------------------------------------------

/**
 * Invalidate all queries that are affected when a journey's status changes.
 * Covers: list, detail, stats, dashboard, achievements.
 */
function invalidateAfterJourneyMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  journeyId: number,
) {
  void queryClient.invalidateQueries({
    queryKey: ["stride", "journeys"],
    exact: false,
  });
  void queryClient.invalidateQueries({
    queryKey: strideKeys.journey(journeyId),
  });
  void queryClient.invalidateQueries({
    queryKey: ["stride", "journey", journeyId, "stats"],
    exact: false,
  });
  void queryClient.invalidateQueries({
    queryKey: strideKeys.dashboard(),
  });
  void queryClient.invalidateQueries({
    queryKey: ["stride", "achievements"],
    exact: false,
  });
}

/**
 * Invalidate all queries affected by a milestone mutation.
 * Covers: milestones list, journey detail, stats, dashboard, achievements.
 */
function invalidateAfterMilestoneMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  journeyId: number,
) {
  void queryClient.invalidateQueries({
    queryKey: strideKeys.milestones(journeyId),
  });
  void queryClient.invalidateQueries({
    queryKey: strideKeys.journey(journeyId),
  });
  void queryClient.invalidateQueries({
    queryKey: ["stride", "journey", journeyId, "stats"],
    exact: false,
  });
  void queryClient.invalidateQueries({
    queryKey: strideKeys.dashboard(),
  });
  void queryClient.invalidateQueries({
    queryKey: ["stride", "achievements"],
    exact: false,
  });
}

/**
 * Invalidate all queries affected by a progress mutation.
 * Covers: progress history, stats, calendar (all years), dashboard, achievements.
 */
function invalidateAfterProgressMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  journeyId: number,
) {
  void queryClient.invalidateQueries({
    queryKey: ["stride", "journey", journeyId, "progress"],
    exact: false,
  });
  void queryClient.invalidateQueries({
    queryKey: ["stride", "journey", journeyId, "stats"],
    exact: false,
  });
  void queryClient.invalidateQueries({
    queryKey: ["stride", "journey", journeyId, "calendar"],
    exact: false,
  });
  void queryClient.invalidateQueries({
    queryKey: strideKeys.dashboard(),
  });
  void queryClient.invalidateQueries({
    queryKey: ["stride", "achievements"],
    exact: false,
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Fetch the Stride dashboard: active journeys with progress, streak, today's activity. */
export function useStrideDashboard() {
  return useQuery<StrideDashboardResponse, Error>({
    queryKey: strideKeys.dashboard(),
    queryFn: () => strideApi.getDashboard(),
  });
}

// ---------------------------------------------------------------------------
// Journeys — queries
// ---------------------------------------------------------------------------

/**
 * List journeys, optionally filtered by status.
 * When status is omitted, returns journeys in all statuses.
 */
export function useJourneys(status?: JourneyResponse["status"]) {
  return useQuery<JourneyResponse[], Error>({
    queryKey: strideKeys.journeys(status),
    queryFn: () => strideApi.listJourneys(status),
  });
}

/** Fetch a single journey by numeric ID. */
export function useJourney(journeyId: number) {
  return useQuery<JourneyResponse, Error>({
    queryKey: strideKeys.journey(journeyId),
    queryFn: () => strideApi.getJourney(journeyId),
    enabled: journeyId > 0,
  });
}

// ---------------------------------------------------------------------------
// Journeys — mutations
// ---------------------------------------------------------------------------

/** Create a new journey. Invalidates all journey lists on success. */
export function useCreateJourney() {
  const queryClient = useQueryClient();

  return useMutation<JourneyResponse, Error, JourneyCreateRequest>({
    mutationFn: (payload) => strideApi.createJourney(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["stride", "journeys"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: strideKeys.dashboard(),
      });
    },
  });
}

/** Update journey metadata. Invalidates affected caches on success. */
export function useUpdateJourney() {
  const queryClient = useQueryClient();

  return useMutation<
    JourneyResponse,
    Error,
    { journeyId: number; payload: JourneyUpdateRequest }
  >({
    mutationFn: ({ journeyId, payload }) =>
      strideApi.updateJourney(journeyId, payload),
    onSuccess: (_data, { journeyId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["stride", "journeys"],
        exact: false,
      });
      void queryClient.invalidateQueries({
        queryKey: strideKeys.journey(journeyId),
      });
      void queryClient.invalidateQueries({
        queryKey: strideKeys.dashboard(),
      });
    },
  });
}

/** Pause an active journey. */
export function usePauseJourney() {
  const queryClient = useQueryClient();

  return useMutation<JourneyResponse, Error, number>({
    mutationFn: (journeyId) => strideApi.pauseJourney(journeyId),
    onSuccess: (_data, journeyId) => {
      invalidateAfterJourneyMutation(queryClient, journeyId);
    },
  });
}

/** Resume a paused journey. */
export function useResumeJourney() {
  const queryClient = useQueryClient();

  return useMutation<JourneyResponse, Error, number>({
    mutationFn: (journeyId) => strideApi.resumeJourney(journeyId),
    onSuccess: (_data, journeyId) => {
      invalidateAfterJourneyMutation(queryClient, journeyId);
    },
  });
}

/** Complete a journey. */
export function useCompleteJourney() {
  const queryClient = useQueryClient();

  return useMutation<JourneyResponse, Error, number>({
    mutationFn: (journeyId) => strideApi.completeJourney(journeyId),
    onSuccess: (_data, journeyId) => {
      invalidateAfterJourneyMutation(queryClient, journeyId);
    },
  });
}

/** Archive a journey. */
export function useArchiveJourney() {
  const queryClient = useQueryClient();

  return useMutation<JourneyResponse, Error, number>({
    mutationFn: (journeyId) => strideApi.archiveJourney(journeyId),
    onSuccess: (_data, journeyId) => {
      invalidateAfterJourneyMutation(queryClient, journeyId);
    },
  });
}

/** Reopen a completed or archived journey back to active. */
export function useReopenJourney() {
  const queryClient = useQueryClient();

  return useMutation<JourneyResponse, Error, number>({
    mutationFn: (journeyId) => strideApi.reopenJourney(journeyId),
    onSuccess: (_data, journeyId) => {
      invalidateAfterJourneyMutation(queryClient, journeyId);
    },
  });
}

// ---------------------------------------------------------------------------
// Milestones — queries
// ---------------------------------------------------------------------------

/** Fetch all milestones for a journey, ordered by position. */
export function useJourneyMilestones(journeyId: number | undefined) {
  return useQuery<MilestoneResponse[], Error>({
    queryKey: strideKeys.milestones(journeyId ?? 0),
    queryFn: () => strideApi.listMilestones(journeyId!),
    enabled: journeyId !== undefined,
  });
}

// ---------------------------------------------------------------------------
// Milestones — mutations
// ---------------------------------------------------------------------------

/** Add a milestone to a journey. */
export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation<
    MilestoneResponse,
    Error,
    { journeyId: number; payload: MilestoneCreateRequest }
  >({
    mutationFn: ({ journeyId, payload }) =>
      strideApi.createMilestone(journeyId, payload),
    onSuccess: (_data, { journeyId }) => {
      invalidateAfterMilestoneMutation(queryClient, journeyId);
    },
  });
}

/** Update a milestone's name or description. */
export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation<
    MilestoneResponse,
    Error,
    {
      journeyId: number;
      milestoneId: number;
      payload: MilestoneUpdateRequest;
    }
  >({
    mutationFn: ({ journeyId, milestoneId, payload }) =>
      strideApi.updateMilestone(journeyId, milestoneId, payload),
    onSuccess: (_data, { journeyId }) => {
      invalidateAfterMilestoneMutation(queryClient, journeyId);
    },
  });
}

/** Delete a milestone. */
export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { journeyId: number; milestoneId: number }>({
    mutationFn: ({ journeyId, milestoneId }) =>
      strideApi.deleteMilestone(journeyId, milestoneId),
    onSuccess: (_data, { journeyId }) => {
      invalidateAfterMilestoneMutation(queryClient, journeyId);
    },
  });
}

/** Reorder milestones within a journey by providing a complete ordered list of IDs. */
export function useReorderMilestones() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { journeyId: number; payload: MilestoneReorderRequest }
  >({
    mutationFn: ({ journeyId, payload }) =>
      strideApi.reorderMilestones(journeyId, payload),
    onSuccess: (_data, { journeyId }) => {
      void queryClient.invalidateQueries({
        queryKey: strideKeys.milestones(journeyId),
      });
    },
  });
}

/** Complete a milestone (records a milestone_completed progress event). */
export function useCompleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation<
    ProgressEventResponse,
    Error,
    {
      journeyId: number;
      milestoneId: number;
      payload: MilestoneCompletionRequest;
    }
  >({
    mutationFn: ({ journeyId, milestoneId, payload }) =>
      strideApi.completeMilestone(journeyId, milestoneId, payload),
    onSuccess: (_data, { journeyId }) => {
      // Milestone completion affects both milestones and progress caches.
      invalidateAfterMilestoneMutation(queryClient, journeyId);
      invalidateAfterProgressMutation(queryClient, journeyId);
    },
  });
}

/** Reopen a completed milestone. */
export function useReopenMilestone() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { journeyId: number; milestoneId: number }>({
    mutationFn: ({ journeyId, milestoneId }) =>
      strideApi.reopenMilestone(journeyId, milestoneId),
    onSuccess: (_data, { journeyId }) => {
      invalidateAfterMilestoneMutation(queryClient, journeyId);
      invalidateAfterProgressMutation(queryClient, journeyId);
    },
  });
}

// ---------------------------------------------------------------------------
// Progress — queries
// ---------------------------------------------------------------------------

/**
 * Fetch progress history for a journey.
 *
 * @param journeyId - Journey numeric ID.
 * @param params    - Optional filter: limit (1–500), startDate/endDate "YYYY-MM-DD".
 */
export function useProgressHistory(
  journeyId: number,
  params?: { limit?: number; startDate?: string; endDate?: string },
) {
  return useQuery<ProgressEventResponse[], Error>({
    queryKey: strideKeys.progress(journeyId, params),
    queryFn: () => strideApi.getProgressHistory(journeyId, params),
    enabled: journeyId > 0,
  });
}

// ---------------------------------------------------------------------------
// Progress — mutations
// ---------------------------------------------------------------------------

/** Log a progress event for a journey. */
export function useLogProgress() {
  const queryClient = useQueryClient();

  return useMutation<
    ProgressEventResponse,
    Error,
    { journeyId: number; payload: ProgressCreateRequest }
  >({
    mutationFn: ({ journeyId, payload }) =>
      strideApi.logProgress(journeyId, payload),
    onSuccess: (_data, { journeyId }) => {
      invalidateAfterProgressMutation(queryClient, journeyId);
    },
  });
}

/** Update a progress event. */
export function useUpdateProgressEvent() {
  const queryClient = useQueryClient();

  return useMutation<
    ProgressEventResponse,
    Error,
    {
      eventId: number;
      journeyId: number;
      payload: ProgressUpdateRequest;
    }
  >({
    mutationFn: ({ eventId, payload }) =>
      strideApi.updateProgressEvent(eventId, payload),
    onSuccess: (_data, { journeyId }) => {
      invalidateAfterProgressMutation(queryClient, journeyId);
    },
  });
}

/** Delete a progress event. */
export function useDeleteProgressEvent() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { eventId: number; journeyId: number }>({
    mutationFn: ({ eventId }) => strideApi.deleteProgressEvent(eventId),
    onSuccess: (_data, { journeyId }) => {
      invalidateAfterProgressMutation(queryClient, journeyId);
    },
  });
}

// ---------------------------------------------------------------------------
// Statistics / analytics — queries
// ---------------------------------------------------------------------------

/**
 * Fetch full journey analytics (progress summary, streak, pace, date-range stats).
 *
 * Supply either `range` (preset name) OR `startDate`/`endDate`, not both.
 * When no params are supplied, the backend returns all-time stats.
 */
export function useJourneyStats(
  journeyId: number,
  params?: {
    range?: DateRangePreset;
    startDate?: string;
    endDate?: string;
  },
) {
  return useQuery<JourneyAnalyticsResponse, Error>({
    queryKey: strideKeys.stats(journeyId, params),
    queryFn: () => strideApi.getJourneyStats(journeyId, params),
    enabled: journeyId > 0,
  });
}

// ---------------------------------------------------------------------------
// Calendar / activity — queries
// ---------------------------------------------------------------------------

/**
 * Fetch daily activity calendar for a journey and year.
 *
 * @param journeyId - Journey numeric ID.
 * @param year      - 4-digit year (1900–9999). Defaults to the current year.
 */
export function useJourneyCalendar(
  journeyId: number,
  year: number = new Date().getFullYear(),
) {
  return useQuery<CalendarResponse, Error>({
    queryKey: strideKeys.calendar(journeyId, year),
    queryFn: () => strideApi.getCalendar(journeyId, year),
    enabled: journeyId > 0 && year >= 1900 && year <= 9999,
  });
}

// ---------------------------------------------------------------------------
// Achievements — queries
// ---------------------------------------------------------------------------

/**
 * Fetch achievements. When journeyId is provided, returns achievements
 * for that journey only; otherwise returns all achievements.
 */
export function useAchievements(journeyId?: number) {
  return useQuery<AchievementResponse[], Error>({
    queryKey: strideKeys.achievements(journeyId),
    queryFn: () => strideApi.getAchievements(journeyId),
  });
}

// ---------------------------------------------------------------------------
// Export — queries
// ---------------------------------------------------------------------------

/**
 * Fetch JSON export data.
 * The response contains a `content` string (raw JSON) and a `journey_count`.
 * Parsing the content string is the responsibility of the consumer.
 *
 * @param journeyId - Optional journey numeric ID to export a single journey.
 */
export function useExportJson(journeyId?: number) {
  return useQuery<ExportJsonResponse, Error>({
    queryKey:
      journeyId !== undefined
        ? (["stride", "export", "json", journeyId] as const)
        : (["stride", "export", "json"] as const),
    queryFn: () => strideApi.exportJson(journeyId),
    // Export data should not be refetched automatically.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: false, // caller triggers via refetch()
  });
}
