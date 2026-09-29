/**
 * Shared Momentum API HTTP client.
 *
 * - Base URL is read from the VITE_API_BASE_URL environment variable.
 *   In local development this is `/api`, forwarded by the Vite proxy to
 *   http://127.0.0.1:8000.
 * - Non-2xx responses throw an ApiError with the HTTP status and parsed message.
 * - Network failures throw an ApiError with status 0.
 * - JSON parse failures throw an ApiError with status -1.
 */

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
    throw new ApiError(`Network error: ${message}`, 0);
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
    throw new ApiError(detail, response.status);
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
    throw new ApiError(`Failed to parse response: ${message}`, -1);
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
