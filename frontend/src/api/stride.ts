/**
 * Stride API module.
 *
 * Encapsulates all /api/v1/stride/* endpoint paths.
 * Components and hooks must not own endpoint strings directly.
 *
 * The journey path parameter is the journey's numeric ID encoded as a string,
 * or an exact (case-insensitive) journey name — the backend accepts both.
 * We always use numeric IDs here for unambiguous lookups.
 *
 * Date-only values ("YYYY-MM-DD") are passed as plain strings — do NOT
 * construct them via `new Date("YYYY-MM-DD")` which shifts by timezone.
 * Use `formatLocalDate` from hooks/queries/use-stride.ts for local dates.
 *
 * The CSV export returns application/zip binary content; it is handled
 * separately from the JSON export which returns a normal JSON body.
 */

import { apiClient } from "./client";
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

const BASE = "/v1/stride";

export const strideApi = {
  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  /**
   * GET /stride/dashboard
   * Returns active journeys with progress summaries, streaks, and today's activity.
   */
  getDashboard(): Promise<StrideDashboardResponse> {
    return apiClient.get<StrideDashboardResponse>(`${BASE}/dashboard`);
  },

  // ---------------------------------------------------------------------------
  // Journeys
  // ---------------------------------------------------------------------------

  /**
   * GET /stride/journeys
   * List all journeys. Optionally filter by status.
   */
  listJourneys(status?: JourneyResponse["status"]): Promise<JourneyResponse[]> {
    const path =
      status !== undefined
        ? `${BASE}/journeys?status=${encodeURIComponent(status)}`
        : `${BASE}/journeys`;
    return apiClient.get<JourneyResponse[]>(path);
  },

  /**
   * GET /stride/journeys/{journey}
   * Get a single journey by numeric ID.
   */
  getJourney(journeyId: number): Promise<JourneyResponse> {
    return apiClient.get<JourneyResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}`,
    );
  },

  /**
   * POST /stride/journeys
   * Create a new journey. Returns 201 with the created journey.
   */
  createJourney(payload: JourneyCreateRequest): Promise<JourneyResponse> {
    return apiClient.post<JourneyResponse>(`${BASE}/journeys`, payload);
  },

  /**
   * PATCH /stride/journeys/{journey}
   * Update journey metadata (name, description, target_value, unit, target_date).
   * To clear nullable fields, use the clear_* boolean flags.
   */
  updateJourney(
    journeyId: number,
    payload: JourneyUpdateRequest,
  ): Promise<JourneyResponse> {
    return apiClient.patch<JourneyResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}`,
      payload,
    );
  },

  // ---------------------------------------------------------------------------
  // Journey lifecycle operations
  // Each is a POST with no request body to {journey}/{operation}.
  // ---------------------------------------------------------------------------

  /**
   * POST /stride/journeys/{journey}/pause
   * Pause an active journey.
   */
  pauseJourney(journeyId: number): Promise<JourneyResponse> {
    return apiClient.post<JourneyResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/pause`,
      {},
    );
  },

  /**
   * POST /stride/journeys/{journey}/resume
   * Resume a paused journey.
   */
  resumeJourney(journeyId: number): Promise<JourneyResponse> {
    return apiClient.post<JourneyResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/resume`,
      {},
    );
  },

  /**
   * POST /stride/journeys/{journey}/complete
   * Mark a journey as completed.
   */
  completeJourney(journeyId: number): Promise<JourneyResponse> {
    return apiClient.post<JourneyResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/complete`,
      {},
    );
  },

  /**
   * POST /stride/journeys/{journey}/archive
   * Archive a journey (preserves history).
   */
  archiveJourney(journeyId: number): Promise<JourneyResponse> {
    return apiClient.post<JourneyResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/archive`,
      {},
    );
  },

  /**
   * POST /stride/journeys/{journey}/reopen
   * Reopen a completed or archived journey back to active.
   */
  reopenJourney(journeyId: number): Promise<JourneyResponse> {
    return apiClient.post<JourneyResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/reopen`,
      {},
    );
  },

  // ---------------------------------------------------------------------------
  // Milestones
  // ---------------------------------------------------------------------------

  /**
   * GET /stride/journeys/{journey}/milestones
   * List all milestones for a journey, ordered by position.
   */
  listMilestones(journeyId: number): Promise<MilestoneResponse[]> {
    return apiClient.get<MilestoneResponse[]>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/milestones`,
    );
  },

  /**
   * POST /stride/journeys/{journey}/milestones
   * Add a milestone to a journey. Returns 201 with the created milestone.
   */
  createMilestone(
    journeyId: number,
    payload: MilestoneCreateRequest,
  ): Promise<MilestoneResponse> {
    return apiClient.post<MilestoneResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/milestones`,
      payload,
    );
  },

  /**
   * PATCH /stride/journeys/{journey}/milestones/{milestone_id}
   * Update a milestone's name or description.
   */
  updateMilestone(
    journeyId: number,
    milestoneId: number,
    payload: MilestoneUpdateRequest,
  ): Promise<MilestoneResponse> {
    return apiClient.patch<MilestoneResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/milestones/${encodeURIComponent(String(milestoneId))}`,
      payload,
    );
  },

  /**
   * DELETE /stride/journeys/{journey}/milestones/{milestone_id}
   * Delete a milestone. Returns 204 No Content.
   */
  deleteMilestone(journeyId: number, milestoneId: number): Promise<void> {
    return apiClient.delete<void>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/milestones/${encodeURIComponent(String(milestoneId))}`,
    );
  },

  /**
   * POST /stride/journeys/{journey}/milestones/reorder
   * Reorder milestones by providing the complete ordered list of IDs.
   * Returns 204 No Content.
   */
  reorderMilestones(
    journeyId: number,
    payload: MilestoneReorderRequest,
  ): Promise<void> {
    return apiClient.post<void>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/milestones/reorder`,
      payload,
    );
  },

  /**
   * POST /stride/journeys/{journey}/milestones/{milestone_id}/complete
   * Complete a milestone (records a milestone_completed progress event).
   */
  completeMilestone(
    journeyId: number,
    milestoneId: number,
    payload: MilestoneCompletionRequest,
  ): Promise<ProgressEventResponse> {
    return apiClient.post<ProgressEventResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/milestones/${encodeURIComponent(String(milestoneId))}/complete`,
      payload,
    );
  },

  /**
   * POST /stride/journeys/{journey}/milestones/{milestone_id}/reopen
   * Reopen a completed milestone. Returns 204 No Content.
   */
  reopenMilestone(journeyId: number, milestoneId: number): Promise<void> {
    return apiClient.post<void>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/milestones/${encodeURIComponent(String(milestoneId))}/reopen`,
      {},
    );
  },

  // ---------------------------------------------------------------------------
  // Progress events
  // ---------------------------------------------------------------------------

  /**
   * POST /stride/journeys/{journey}/progress
   * Log a progress event for a journey. Returns 201 with the created event.
   */
  logProgress(
    journeyId: number,
    payload: ProgressCreateRequest,
  ): Promise<ProgressEventResponse> {
    return apiClient.post<ProgressEventResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/progress`,
      payload,
    );
  },

  /**
   * GET /stride/journeys/{journey}/progress
   * Get progress history for a journey.
   *
   * @param journeyId - Journey numeric ID.
   * @param limit     - Max events to return (1–500, default 50).
   * @param startDate - ISO date "YYYY-MM-DD" lower bound (inclusive).
   * @param endDate   - ISO date "YYYY-MM-DD" upper bound (inclusive).
   */
  getProgressHistory(
    journeyId: number,
    params?: {
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<ProgressEventResponse[]> {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.startDate) search.set("start_date", params.startDate);
    if (params?.endDate) search.set("end_date", params.endDate);
    const query = search.toString();
    const base = `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/progress`;
    return apiClient.get<ProgressEventResponse[]>(
      query ? `${base}?${query}` : base,
    );
  },

  /**
   * PATCH /stride/progress/{event_id}
   * Update a progress event. Use clear_* flags to null out optional fields.
   */
  updateProgressEvent(
    eventId: number,
    payload: ProgressUpdateRequest,
  ): Promise<ProgressEventResponse> {
    return apiClient.patch<ProgressEventResponse>(
      `${BASE}/progress/${encodeURIComponent(String(eventId))}`,
      payload,
    );
  },

  /**
   * DELETE /stride/progress/{event_id}
   * Delete a progress event. Returns 204 No Content.
   */
  deleteProgressEvent(eventId: number): Promise<void> {
    return apiClient.delete<void>(
      `${BASE}/progress/${encodeURIComponent(String(eventId))}`,
    );
  },

  // ---------------------------------------------------------------------------
  // Statistics / analytics
  // ---------------------------------------------------------------------------

  /**
   * GET /stride/journeys/{journey}/stats
   * Get full analytics for a journey (progress summary, streak, pace, stats).
   *
   * Supply either `range` (preset name) OR `startDate`/`endDate`, not both.
   *
   * @param journeyId - Journey numeric ID.
   * @param range     - Preset range name (e.g. "30d", "this-year").
   * @param startDate - ISO date "YYYY-MM-DD".
   * @param endDate   - ISO date "YYYY-MM-DD".
   */
  getJourneyStats(
    journeyId: number,
    params?: {
      range?: DateRangePreset;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<JourneyAnalyticsResponse> {
    const search = new URLSearchParams();
    if (params?.range) search.set("range", params.range);
    if (params?.startDate) search.set("start_date", params.startDate);
    if (params?.endDate) search.set("end_date", params.endDate);
    const query = search.toString();
    const base = `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/stats`;
    return apiClient.get<JourneyAnalyticsResponse>(
      query ? `${base}?${query}` : base,
    );
  },

  /**
   * GET /stride/journeys/{journey}/calendar/{year}
   * Get daily activity for a journey for a given calendar year.
   *
   * @param journeyId - Journey numeric ID.
   * @param year      - 4-digit year (1900–9999).
   */
  getCalendar(journeyId: number, year: number): Promise<CalendarResponse> {
    return apiClient.get<CalendarResponse>(
      `${BASE}/journeys/${encodeURIComponent(String(journeyId))}/calendar/${encodeURIComponent(String(year))}`,
    );
  },

  // ---------------------------------------------------------------------------
  // Achievements
  // ---------------------------------------------------------------------------

  /**
   * GET /stride/achievements
   * Get all achievements across all journeys, or filter to a specific journey.
   *
   * @param journeyId - Optional journey numeric ID to filter achievements.
   */
  getAchievements(journeyId?: number): Promise<AchievementResponse[]> {
    const path =
      journeyId !== undefined
        ? `${BASE}/achievements?journey=${encodeURIComponent(String(journeyId))}`
        : `${BASE}/achievements`;
    return apiClient.get<AchievementResponse[]>(path);
  },

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  /**
   * GET /stride/export/json
   * Export journey data as JSON. Returns the raw export content inline.
   *
   * @param journeyId - Optional journey numeric ID to export a single journey.
   *                    Omit to export all journeys.
   */
  exportJson(journeyId?: number): Promise<ExportJsonResponse> {
    const path =
      journeyId !== undefined
        ? `${BASE}/export/json?journey=${encodeURIComponent(String(journeyId))}`
        : `${BASE}/export/json`;
    return apiClient.get<ExportJsonResponse>(path);
  },

  /**
   * GET /stride/export/csv
   * Export journey progress as a ZIP archive of CSV files.
   *
   * Returns a raw Response so the caller can stream or download the binary ZIP.
   * Do NOT parse the result through the JSON client — it is binary content.
   *
   * @param journeyId - Optional journey numeric ID to export a single journey.
   */
  exportCsvUrl(journeyId?: number): string {
    const base = `${BASE}/export/csv`;
    return journeyId !== undefined
      ? `${base}?journey=${encodeURIComponent(String(journeyId))}`
      : base;
  },
};
