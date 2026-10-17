/**
 * TypeScript types for the Momentum Ledger API.
 *
 * All field names and types match the backend Pydantic schemas exactly:
 *   src/momentum/ledger/api/schemas.py
 *   src/momentum/ledger/domain/models.py
 *
 * - Date fields are transport strings (ISO-8601).
 * - Datetime fields are ISO-8601 strings with timezone.
 * - Rates (completion_rate, avg_rate, etc.) are 0..1 ratios — NOT percentages.
 * - Trend values are the Python Trend enum's unicode string values.
 *
 * UI-only category metadata is kept in lib/commitment-categories.ts.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Trend direction — matches backend Trend enum unicode values. */
export type Trend = "↑" | "↓" | "→" | "—";

/** Stable commitment category values from the backend. */
export type CommitmentCategory =
  | "health_fitness"
  | "learning_growth"
  | "career_work"
  | "personal_projects"
  | "reading_knowledge"
  | "mental_wellbeing"
  | "nutrition_self_care"
  | "relationships_social"
  | "home_responsibilities"
  | "habits_discipline";

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export interface TaskResponse {
  id: number;
  name: string;
  cutoff_message: string;
  category: CommitmentCategory;
  created_at: string; // ISO datetime string
  archived_at: string | null; // ISO datetime string or null
  is_active: boolean;
}

export interface TaskCreateRequest {
  name: string;
  cutoff_message: string;
  category: CommitmentCategory;
}

export interface TaskUpdateRequest {
  name?: string | null;
  cutoff_message?: string | null;
  category?: CommitmentCategory | null;
}

// ---------------------------------------------------------------------------
// Daily entries
// ---------------------------------------------------------------------------

export interface DailyEntryResponse {
  task_id: number;
  date: string; // ISO date string
  completed: boolean;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface DailyEntryRecordRequest {
  task_id: number;
  date: string; // ISO date string YYYY-MM-DD
  completed: boolean;
}

export interface DailyEntryBatchItemRequest {
  task_id: number;
  completed: boolean;
}

export interface DailyEntryBatchRecordRequest {
  date: string; // ISO date string YYYY-MM-DD
  entries: DailyEntryBatchItemRequest[];
}

/** Task + optional entry for a given calendar date (from GET /ledger/entries?date=...). */
export interface DayEntryResponse {
  task: TaskResponse;
  entry: DailyEntryResponse | null;
}

/** Historical entry + its task (from GET /ledger/history). */
export interface HistoryEntryResponse {
  task: TaskResponse;
  entry: DailyEntryResponse;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

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

export interface OverallStatsResponse {
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

/** Calendar-based view mode for the Insights trend. */
export type InsightsTrendMode = "monthly" | "cumulative";

export interface InsightsCommitmentStatsResponse {
  task: TaskResponse;
  completed_days: number;
  not_completed_days: number;
  recorded_days: number;
  completion_percentage: number; // 0..100 percentage
  distribution_percentage: number; // 0..100 percentage
}

export interface InsightsSummaryResponse {
  start_date: string; // ISO date string, inclusive
  end_date: string; // ISO date string, inclusive
  calendar_days: number;
  /** Distinct dates containing an entry for at least one selected commitment. */
  days_with_any_entry: number;
  selected_commitment_ids: number[];
  total_completed_days: number;
  commitment_stats: InsightsCommitmentStatsResponse[];
}

export interface InsightsTrendPointResponse {
  start_date: string; // ISO date string, inclusive
  end_date: string; // ISO date string, inclusive
  completed_days: number;
  recorded_days: number;
  completion_percentage: number; // 0..100 percentage
  distribution_percentage: number; // 0..100 share of selected commitments' completions
}

export interface InsightsTrendSeriesResponse {
  task: TaskResponse;
  points: InsightsTrendPointResponse[];
}

export interface InsightsTrendResponse {
  reference_date: string;
  year: number;
  available_years: number[];
  mode: InsightsTrendMode;
  period_count: number;
  selected_commitment_ids: number[];
  series: InsightsTrendSeriesResponse[];
}
