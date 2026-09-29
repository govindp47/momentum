/**
 * TypeScript types for the Momentum Stride API.
 *
 * All field names and types match the backend Pydantic schemas exactly:
 *   src/momentum/stride/api/schemas.py
 *   src/momentum/stride/domain/models.py
 *   src/momentum/stride/domain/enums.py
 *
 * - Date-only fields are ISO-8601 date strings "YYYY-MM-DD".
 * - Datetime fields are ISO-8601 strings with timezone offset.
 * - `percentage` in ProgressSummaryResponse is 0..100 (as returned by the backend).
 * - Enum values are the Python StrEnum string values.
 *
 * UI-only concerns (icons, labels, formatting) belong in presentation components,
 * not here.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * How a journey tracks its progress.
 * Matches TrackingMethod StrEnum.
 */
export type TrackingMethod = "milestone" | "count" | "quantity" | "duration";

/**
 * Lifecycle state of a journey.
 * Matches JourneyStatus StrEnum.
 */
export type JourneyStatus = "active" | "paused" | "completed" | "archived";

/**
 * Completion state of a milestone.
 * Matches MilestoneStatus StrEnum.
 */
export type MilestoneStatus = "pending" | "completed";

/**
 * Classification of a progress event.
 * Matches EventType StrEnum.
 */
export type EventType = "progress" | "milestone_completed";

/**
 * Preset date range names accepted by the backend stats endpoints.
 * These are the exact string values the backend recognises.
 */
export type DateRangePreset =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year";

// ---------------------------------------------------------------------------
// Journey
// ---------------------------------------------------------------------------

/** Full journey representation returned by the API. */
export interface JourneyResponse {
  id: number;
  name: string;
  description: string;
  tracking_method: TrackingMethod;
  target_value: number;
  unit: string | null;
  status: JourneyStatus;
  /** ISO date string "YYYY-MM-DD" */
  start_date: string;
  /** ISO date string "YYYY-MM-DD" or null */
  target_date: string | null;
  /** ISO datetime string */
  created_at: string;
  /** ISO datetime string */
  updated_at: string;
  is_active: boolean;
  is_paused: boolean;
  is_completed: boolean;
  is_archived: boolean;
  is_milestone_based: boolean;
  is_count_based: boolean;
  is_quantity_based: boolean;
  is_duration_based: boolean;
  accepts_progress: boolean;
}

/** Request body for POST /stride/journeys. */
export interface JourneyCreateRequest {
  name: string;
  description?: string;
  tracking_method: TrackingMethod;
  /** Must be > 0 */
  target_value: number;
  unit?: string | null;
  /** ISO date string "YYYY-MM-DD" */
  start_date?: string | null;
  /** ISO date string "YYYY-MM-DD" */
  target_date?: string | null;
  milestone_names?: string[] | null;
}

/** Request body for PATCH /stride/journeys/{journey}. */
export interface JourneyUpdateRequest {
  name?: string | null;
  description?: string | null;
  /** Must be > 0 */
  target_value?: number | null;
  unit?: string | null;
  clear_unit?: boolean;
  /** ISO date string "YYYY-MM-DD" */
  target_date?: string | null;
  clear_target_date?: boolean;
}

// ---------------------------------------------------------------------------
// Milestone
// ---------------------------------------------------------------------------

/** Milestone representation returned by the API. */
export interface MilestoneResponse {
  id: number;
  journey_id: number;
  name: string;
  description: string;
  position: number;
  target_value: number | null;
  unit: string | null;
  status: MilestoneStatus;
  /** ISO datetime string */
  created_at: string;
  /** ISO datetime string or null */
  completed_at: string | null;
  is_completed: boolean;
  is_pending: boolean;
}

/** Request body for POST /stride/journeys/{journey}/milestones. */
export interface MilestoneCreateRequest {
  name: string;
  description?: string;
  /** 1-based position; appended to end when omitted. */
  position?: number | null;
}

/** Request body for PATCH /stride/journeys/{journey}/milestones/{milestone_id}. */
export interface MilestoneUpdateRequest {
  name?: string | null;
  description?: string | null;
}

/** Request body for POST /stride/journeys/{journey}/milestones/reorder. */
export interface MilestoneReorderRequest {
  ordered_ids: number[];
}

/** Request body for POST /stride/journeys/{journey}/milestones/{milestone_id}/complete. */
export interface MilestoneCompletionRequest {
  /** ISO datetime string; defaults to now when omitted. */
  occurred_at?: string | null;
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Progress events
// ---------------------------------------------------------------------------

/** Progress event representation returned by the API. */
export interface ProgressEventResponse {
  id: number;
  journey_id: number;
  milestone_id: number | null;
  event_type: EventType;
  value: number | null;
  duration_seconds: number | null;
  /** ISO datetime string */
  occurred_at: string;
  note: string | null;
  /** ISO datetime string */
  created_at: string;
}

/** Request body for POST /stride/journeys/{journey}/progress. */
export interface ProgressCreateRequest {
  value?: number | null;
  /** Must be > 0 */
  duration_seconds?: number | null;
  /** ISO datetime string; defaults to now when omitted. */
  occurred_at?: string | null;
  note?: string | null;
}

/** Request body for PATCH /stride/progress/{event_id}. */
export interface ProgressUpdateRequest {
  value?: number | null;
  clear_value?: boolean;
  /** Must be > 0 */
  duration_seconds?: number | null;
  clear_duration?: boolean;
  /** ISO datetime string */
  occurred_at?: string | null;
  note?: string | null;
  clear_note?: boolean;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/** Current journey progress summary. */
export interface ProgressSummaryResponse {
  journey: JourneyResponse;
  current_value: number;
  target_value: number;
  remaining: number;
  /** 0..100 — this IS a percentage as returned by the backend. */
  percentage: number;
  event_count: number;
  milestones_completed: number;
  milestones_total: number;
}

/** Journey streak information. */
export interface StreakResponse {
  current_streak: number;
  longest_streak: number;
  active_days: number;
  /** ISO date string "YYYY-MM-DD" or null */
  last_active_date: string | null;
}

/** Journey pace and trajectory information. */
export interface PaceResponse {
  days_elapsed: number;
  days_remaining: number | null;
  actual_daily_rate: number;
  required_daily_rate: number | null;
  /** ISO date string "YYYY-MM-DD" or null */
  projected_completion_date: string | null;
  is_on_pace: boolean | null;
}

/** Statistics for a journey over a selected date range. */
export interface JourneyStatsResponse {
  journey: JourneyResponse;
  total_value: number;
  event_count: number;
  active_days: number;
  average_per_event: number;
  average_per_active_day: number;
  best_day_value: number;
  /** ISO date string "YYYY-MM-DD" or null */
  best_day_date: string | null;
  period_label: string;
}

/** Complete journey analytics: progress + streak + pace + stats. */
export interface JourneyAnalyticsResponse {
  progress: ProgressSummaryResponse;
  streak: StreakResponse;
  pace: PaceResponse;
  stats: JourneyStatsResponse;
}

// ---------------------------------------------------------------------------
// Calendar / activity
// ---------------------------------------------------------------------------

/** Aggregated activity for a single calendar day. */
export interface DailyActivityResponse {
  /** ISO date string "YYYY-MM-DD" */
  date: string;
  total_value: number;
  total_duration_seconds: number;
  event_count: number;
  event_type: EventType;
}

/** Calendar activity response for a full year. */
export interface CalendarResponse {
  year: number;
  journey: JourneyResponse;
  activity: DailyActivityResponse[];
}

// ---------------------------------------------------------------------------
// Dashboard (Stride-specific)
// ---------------------------------------------------------------------------

/** Per-journey summary shown on the Stride dashboard. */
export interface DashboardJourneyResponse {
  journey: JourneyResponse;
  progress: ProgressSummaryResponse;
  streak: StreakResponse;
}

/**
 * Stride dashboard response from GET /api/v1/stride/dashboard.
 *
 * today_activity keys are journey IDs as strings (JSON object keys are always strings).
 */
export interface StrideDashboardResponse {
  journeys: DashboardJourneyResponse[];
  today_activity: Record<string, DailyActivityResponse>;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/** Derived motivational achievement. */
export interface AchievementResponse {
  key: string;
  title: string;
  description: string;
  journey_id: number | null;
  journey_name: string | null;
  /** ISO datetime string or null */
  unlocked_at: string | null;
  is_unlocked: boolean;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** JSON export response from GET /api/v1/stride/export/json. */
export interface ExportJsonResponse {
  journey_count: number;
  /** JSON-encoded export content as a string. */
  content: string;
}
