import type {
  BackendLogFilters,
  EventDaysFilter,
  FrontendErrorFilters,
} from "@/types/developer";

export const DEFAULT_FRONTEND_FILTERS: FrontendErrorFilters = {
  source: "",
  level: "",
  days: "7d",
};

export const DEFAULT_BACKEND_FILTERS: BackendLogFilters = {
  level: "",
  days: "7d",
};

export function getEventSince(days: EventDaysFilter): string {
  if (days === "all") return "";

  const duration = days === "7d" ? 7 : 30;
  return new Date(Date.now() - duration * 24 * 60 * 60 * 1000).toISOString();
}
