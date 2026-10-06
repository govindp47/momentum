/**
 * Deterministic fingerprinting for frontend error events.
 *
 * A fingerprint must be:
 *  - Stable across repeated occurrences of the same logical error.
 *  - Different for different errors.
 *  - Independent of timestamp, event ID, or any volatile value.
 *
 * Strategy: concatenate { source, error_name, normalizedMessage, route,
 * stackSignature, endpoint } and produce a short non-cryptographic hash.
 *
 * The stack signature is the first 3 unique stack frames, stripped of
 * absolute line numbers so minor refactors don't change the fingerprint.
 */

/**
 * Inputs used to derive the fingerprint.
 * All fields are optional — the fingerprinter handles any combination.
 */
export interface FingerprintInput {
  source: string;
  error_name?: string;
  message?: string;
  route?: string;
  /** Raw stack string — we extract a signature from it. */
  stack?: string;
  /** API endpoint, when applicable. */
  endpoint?: string;
}

/**
 * Generate a stable fingerprint string for the given input.
 * Returns a short lowercase hex string.
 */
export function generateFingerprint(input: FingerprintInput): string {
  const parts: string[] = [
    input.source,
    input.error_name ?? "",
    normalizeMessage(input.message ?? ""),
    input.route ?? "",
    extractStackSignature(input.stack),
    input.endpoint ?? "",
  ];

  const raw = parts.join("|");
  return shortHash(raw);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a message for fingerprinting by stripping values that change
 * between occurrences (IDs, timestamps, numbers).
 */
function normalizeMessage(msg: string): string {
  return (
    msg
      // Strip numeric IDs / line numbers / status codes
      .replace(/\b\d+\b/g, "N")
      // Strip UUIDs
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "UUID",
      )
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
      // Limit length so very long messages don't inflate the hash input
      .slice(0, 300)
  );
}

/**
 * Extract a stable signature from a stack trace.
 * Takes up to 3 frames, strips line/column numbers (which vary with build).
 * Strips file paths to just the filename to avoid absolute-path volatility.
 */
function extractStackSignature(stack: string | undefined): string {
  if (!stack) return "";

  const frames = stack
    .split("\n")
    // Keep lines that look like stack frames
    .filter((line) => /at\s/.test(line))
    // Strip line:col info
    .map((line) =>
      line
        .trim()
        // Remove line/col: "at foo (file.ts:12:34)" → "at foo (file.ts)"
        .replace(/:\d+:\d+\)?$/, ")")
        .replace(/:\d+\)?$/, ")")
        // Keep only the filename, not the full path
        .replace(/\(.*[\\/]([^/\\]+)\)/, "($1)"),
    )
    .slice(0, 3);

  return frames.join(";");
}

/**
 * djb2 non-cryptographic hash, output as 8-char hex.
 * Fast, dependency-free, and stable across JS engines for the same input.
 */
function shortHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 ^ charCode
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash & hash; // force 32-bit integer
  }
  // Convert to unsigned hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}
