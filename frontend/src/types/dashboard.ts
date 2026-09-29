/**
 * TypeScript types for the Momentum dashboard API response.
 *
 * Field names and types match the backend Pydantic schemas exactly:
 *   src/momentum/dashboard/schemas.py
 *   src/momentum/ledger/api/schemas.py
 *   src/momentum/stride/api/schemas.py
 *
 * - Date fields remain as transport strings (ISO-8601 date/datetime).
 * - Rates (avg_rate, completion_rate, etc.) are ratios 0..1, NOT percentages.
 * - Enum values are the Python StrEnum string values.
 */

// ---------------------------------------------------------------------------
// Ledger types
// ---------------------------------------------------------------------------

/** Ledger task tracking trend. Values are literal unicode symbols from the backend Trend enum. */
export type Trend = "↑" | "↓" | "→" | "—";

export interface TaskResponse {
  id: number;
  name: string;
  cutoff_message: string;
  created_at: string; // ISO datetime string
  archived_at: string | null; // ISO datetime string or null
  is_active: boolean;
}

export interface TaskStatsResponse {
  task: TaskResponse;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  completed: number;
  missed: number;
  recorded: number;
  completion_rate: number | null; // 0..1 ratio
  current_streak: number;
  longest_streak: number;
  recent_7d_rate: number | null; // 0..1 ratio
  recent_30d_rate: number | null; // 0..1 ratio
  recent_90d_rate: number | null; // 0..1 ratio
  trend: Trend;
}

export interface DashboardLedgerResponse {
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  task_stats: TaskStatsResponse[];
  avg_rate: number | null; // 0..1 ratio
  min_rate: number | null; // 0..1 ratio
  max_rate: number | null; // 0..1 ratio
  spread: number | null; // 0..1 ratio
  tracked_days: number;
  total_days: number;
}

// ---------------------------------------------------------------------------
// Stride types
// ---------------------------------------------------------------------------

/** Stride tracking methods. Matches TrackingMethod StrEnum. */
export type TrackingMethod = "milestone" | "count" | "quantity" | "duration";

/** Stride journey lifecycle states. Matches JourneyStatus StrEnum. */
export type JourneyStatus = "active" | "paused" | "completed" | "archived";

/** Stride event types. Matches EventType StrEnum. */
export type EventType = "progress" | "milestone_completed";

export interface JourneyResponse {
  id: number;
  name: string;
  description: string;
  tracking_method: TrackingMethod;
  target_value: number;
  unit: string | null;
  status: JourneyStatus;
  start_date: string; // ISO date string
  target_date: string | null; // ISO date string or null
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
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

export interface ProgressSummaryResponse {
  journey: JourneyResponse;
  current_value: number;
  target_value: number;
  remaining: number;
  percentage: number; // 0..100 (this field IS a percentage per backend)
  event_count: number;
  milestones_completed: number;
  milestones_total: number;
}

export interface StreakResponse {
  current_streak: number;
  longest_streak: number;
  active_days: number;
  last_active_date: string | null; // ISO date string or null
}

export interface DailyActivityResponse {
  date: string; // ISO date string
  total_value: number;
  total_duration_seconds: number;
  event_count: number;
  event_type: EventType;
}

// ---------------------------------------------------------------------------
// Dashboard composite types
// ---------------------------------------------------------------------------

export interface DashboardJourneyResponse {
  journey: JourneyResponse;
  progress: ProgressSummaryResponse;
  streak: StreakResponse;
}

/**
 * Top-level response from GET /api/v1/dashboard.
 *
 * today_activity keys are journey IDs as strings (JSON keys are always strings).
 */
export interface DashboardResponse {
  as_of: string; // ISO date string
  ledger: DashboardLedgerResponse;
  journeys: DashboardJourneyResponse[];
  today_activity: Record<string, DailyActivityResponse>;
}
