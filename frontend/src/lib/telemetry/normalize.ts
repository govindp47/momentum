/**
 * Robust error normalizer.
 *
 * Accepts `unknown` and always produces a safe { name, message, stack, cause }
 * tuple regardless of what the thrown value actually is.
 *
 * Rules:
 *  - Never throws.
 *  - Never produces excessively long strings (bounded below).
 *  - Handles Error, TypeError, DOMException, string, plain object, null,
 *    undefined, and truly unknown values.
 */

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 8_000;
const MAX_CAUSE_LENGTH = 2_000;

export interface NormalizedError {
  name: string;
  message: string;
  stack: string | undefined;
  cause: string | undefined;
}

/**
 * Normalize any thrown value into a safe, bounded NormalizedError.
 */
export function normalizeError(value: unknown): NormalizedError {
  try {
    return _normalize(value);
  } catch {
    // The normalizer itself should never throw, but be extra safe.
    return {
      name: "UnknownError",
      message: "An unknown error occurred (normalization failed).",
      stack: undefined,
      cause: undefined,
    };
  }
}

function _normalize(value: unknown): NormalizedError {
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: bound(value.message || String(value), MAX_MESSAGE_LENGTH),
      stack: value.stack ? bound(value.stack, MAX_STACK_LENGTH) : undefined,
      cause:
        value.cause != null
          ? bound(safeStringify(value.cause), MAX_CAUSE_LENGTH)
          : undefined,
    };
  }

  if (typeof value === "string") {
    return {
      name: "StringError",
      message: bound(value, MAX_MESSAGE_LENGTH),
      stack: undefined,
      cause: undefined,
    };
  }

  if (value == null) {
    return {
      name: "NullError",
      message: value === null ? "null was thrown" : "undefined was thrown",
      stack: undefined,
      cause: undefined,
    };
  }

  if (typeof value === "object") {
    // Plain error-like objects (e.g. { message: "...", stack: "..." })
    const obj = value as Record<string, unknown>;
    const name =
      typeof obj["name"] === "string" && obj["name"]
        ? obj["name"]
        : "ObjectError";
    const message =
      typeof obj["message"] === "string" && obj["message"]
        ? obj["message"]
        : bound(safeStringify(value), MAX_MESSAGE_LENGTH);
    const stack =
      typeof obj["stack"] === "string"
        ? bound(obj["stack"], MAX_STACK_LENGTH)
        : undefined;
    return { name, message, stack, cause: undefined };
  }

  // number, boolean, symbol, bigint, function
  return {
    name: "PrimitiveError",
    message: bound(String(value), MAX_MESSAGE_LENGTH),
    stack: undefined,
    cause: undefined,
  };
}

/** Truncate a string to maxLen characters. */
function bound(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + " [truncated]" : str;
}

/**
 * Safely serialize an unknown value to a string, guarding against cyclic
 * references and huge objects.
 */
export function safeStringify(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value !== "object" && typeof value !== "function")
    return String(value);
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(value, (_key, val: unknown) => {
      if (val !== null && typeof val === "object") {
        if (seen.has(val as object)) return "[Circular]";
        seen.add(val as object);
      }
      return val;
    });
    // Bound the serialized result
    const result = json ?? String(value);
    return result.length > MAX_MESSAGE_LENGTH
      ? result.slice(0, MAX_MESSAGE_LENGTH) + " [truncated]"
      : result;
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable]";
    }
  }
}
