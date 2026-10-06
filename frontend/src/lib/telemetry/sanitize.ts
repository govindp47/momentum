/**
 * Metadata sanitization for frontend telemetry.
 *
 * Guards against:
 *  - Sensitive fields (auth headers, tokens, passwords, etc.)
 *  - Cyclic references
 *  - Excessively large payloads
 */

import { safeStringify } from "./normalize";

/** Sensitive key patterns that must never be persisted. */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /auth/i,
  /authorization/i,
  /token/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /api.?key/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /private/i,
];

const MAX_METADATA_KEYS = 20;
const MAX_VALUE_LENGTH = 500;

/**
 * Sanitize a caller-supplied metadata object for safe persistence.
 *
 * - Removes sensitive keys
 * - Bounds the number of entries
 * - Converts values to safe primitives (bounded strings or numbers/booleans)
 * - Never throws
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (metadata == null) return undefined;

  try {
    const result: Record<string, unknown> = {};
    let count = 0;

    for (const [key, value] of Object.entries(metadata)) {
      if (count >= MAX_METADATA_KEYS) break;
      if (isSensitiveKey(key)) continue;

      result[key] = sanitizeValue(value);
      count++;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeValue(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return value.length > MAX_VALUE_LENGTH
      ? value.slice(0, MAX_VALUE_LENGTH) + "[…]"
      : value;
  }
  // Objects / arrays: serialize to bounded string
  const str = safeStringify(value);
  return str.length > MAX_VALUE_LENGTH
    ? str.slice(0, MAX_VALUE_LENGTH) + "[…]"
    : str;
}

/**
 * Sanitize a URL for storage.
 * Strips query parameters that may contain sensitive tokens.
 * Preserves the path and host so the route is still identifiable.
 */
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    // Remove all query params — they may contain tokens
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // If it's not a valid URL (e.g. a relative path), just strip anything after "?"
    return url.split("?")[0];
  }
}
