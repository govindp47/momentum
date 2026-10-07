export interface FrontendErrorEventResponse {
  db_id: number;
  created_at: string;
  id: string;
  timestamp: string;
  fingerprint: string;
  level: string;
  source: string;
  error_name: string | null;
  message: string;
  route: string | null;
  url: string | null;
  component: string | null;
  operation: string | null;
  stack: string | null;
  component_stack: string | null;
  cause: string | null;
  filename: string | null;
  error_lineno: number | null;
  error_colno: number | null;
  http_method: string | null;
  endpoint: string | null;
  status_code: number | null;
  app_version: string;
  user_agent: string;
  viewport_width: number;
  viewport_height: number;
  online_status: boolean;
  metadata: Record<string, unknown> | null;
}

export interface BackendLogEventResponse {
  db_id: number;
  timestamp: string;
  level: string;
  logger_name: string;
  source: string;
  fingerprint: string;
  request_id: string | null;
  method: string | null;
  path: string | null;
  route: string | null;
  status_code: number | null;
  operation: string | null;
  component: string | null;
  module: string;
  function: string;
  exception_type: string | null;
  message: string;
  traceback: string | null;
  application_version: string;
  environment: string;
  process_id: number;
  thread_id: number;
  python_version: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type EventDaysFilter = "7d" | "30d" | "all";

export interface FrontendErrorFilters {
  source: string;
  level: string;
  days: EventDaysFilter;
}

export interface BackendLogFilters {
  level: string;
  days: EventDaysFilter;
}
