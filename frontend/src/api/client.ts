/**
 * Shared Momentum API HTTP client.
 *
 * - Base URL is read from the VITE_API_BASE_URL environment variable.
 *   In local development this is `/api`, forwarded by the Vite proxy to
 *   http://127.0.0.1:8000.
 * - Non-2xx responses throw an ApiError with the HTTP status and parsed message.
 * - Network failures throw an ApiError with status 0.
 * - JSON parse failures throw an ApiError with status -1.
 * - Unexpected failures (5xx, network, parse) are captured by frontend telemetry.
 */

import { frontendLogger, getCurrentRoute } from "@/lib/telemetry/logger";

const API_BASE_URL: string = import.meta.env["VITE_API_BASE_URL"] ?? "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status code, 0 for network failure, -1 for parse failure. */
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Determine whether an API failure is an unexpected bug (vs. normal user-facing
 * validation or business logic error).
 *
 * Expected:
 *   - 4xx errors (user input validation, not-found, conflicts, etc.)
 *
 * Unexpected (captured by telemetry):
 *   - 5xx errors (server failure)
 *   - Network failures (status === 0)
 *   - JSON parse failures (status === -1)
 */
function isUnexpectedApiFailure(status: number): boolean {
  // Status 0 = network error, -1 = parse error, 5xx = server error
  return status === 0 || status === -1 || status >= 500;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const init: RequestInit =
    body !== undefined
      ? {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { method };

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    const apiError = new ApiError(`Network error: ${message}`, 0);

    // Network failures are always unexpected — capture for telemetry.
    frontendLogger.error({
      source: "api",
      message: apiError.message,
      error: apiError,
      route: getCurrentRoute(),
      http_method: method,
      endpoint: path,
      status_code: 0,
    });

    throw apiError;
  }

  if (!response.ok) {
    let detail: string = response.statusText;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      }
    } catch {
      // Ignore JSON parse failure for error bodies; use statusText.
    }
    const apiError = new ApiError(detail, response.status);

    // Only capture unexpected (5xx) failures — not normal validation errors.
    if (isUnexpectedApiFailure(response.status)) {
      frontendLogger.error({
        source: "api",
        message: `API error ${response.status}: ${detail}`,
        error: apiError,
        route: getCurrentRoute(),
        http_method: method,
        endpoint: path,
        status_code: response.status,
      });
    }

    throw apiError;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    const apiError = new ApiError(`Failed to parse response: ${message}`, -1);

    // Parse failures are always unexpected.
    frontendLogger.error({
      source: "api",
      message: apiError.message,
      error: apiError,
      route: getCurrentRoute(),
      http_method: method,
      endpoint: path,
      status_code: -1,
    });

    throw apiError;
  }

  return data as T;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>("POST", path, body);
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },
  delete<T>(path: string): Promise<T> {
    return request<T>("DELETE", path);
  },
};
