import crypto from "node:crypto";
import { reportError, setStatus, fireTickNow } from "./index.mjs";

/**
 * Standard-shape "the runtime hit an unrecoverable error" emit.
 *
 * Builds a `tickError` (per `contracts/tick.mjs`), pushes it onto
 * the manager-runtime's pending-error queue, marks the runtime
 * status as `failed`, and fires a tick out-of-band so the manager
 * hears about the failure within seconds rather than within the
 * next 60s tick cadence.
 *
 * No-op in solo-dev mode (`USE_MANAGER_SAVE !== "true"`): all
 * three underlying calls (`reportError`, `setStatus`, `fireTickNow`)
 * are no-ops when no runtime is cached, so callers don't need to
 * branch on `isManagerLaunched()` themselves.
 *
 * Caller responsibilities:
 *
 * - `code` — short stable identifier (CONST_CASE). Used by manager-
 *   side dashboards / alerts to bucket failures. Codes wired
 *   today: `INVALID_BATCH_CONFIG` (researcher-actionable),
 *   `BATCH_INIT_FAILED` (platform-team-actionable),
 *   `BATCH_NOT_INITIALIZED`. (Will graduate to a contract enum in
 *   `contracts/errors.mjs` once the catalog stabilizes — see #139
 *   for the next-up call sites.)
 * - `message` — human-readable fallback. Manager renders this when
 *   it doesn't have a per-code UI component.
 * - `kind` — `platform-error` (default) routes to platform-team
 *   triage via Sentry; `validation` routes to the researcher's
 *   dashboard friendly-error UI.
 * - `batchId` — included in `details` for traceability. Optional
 *   but strongly recommended at terminal sites that have access.
 * - `path` — JSON-pointer-style location of the offending field
 *   (only relevant for shape errors).
 * - `details` — caller-provided fields merged into the manager-
 *   visible payload. Manager treats this as opaque.
 *
 * Returns the constructed tickError object so the caller can log
 * its `id` for cross-referencing manager-side rows.
 */
export async function reportTerminalError({
  code,
  message,
  kind = "platform-error",
  batchId,
  path,
  details,
}) {
  if (!code) {
    throw new Error("reportTerminalError: code is required");
  }
  if (!message) {
    throw new Error("reportTerminalError: message is required");
  }

  const tickError = {
    id: crypto.randomUUID(),
    kind,
    code,
    message,
    retryable: false,
  };
  if (path) {
    tickError.path = path;
  }
  // Always include batchId in details when present, then merge any
  // caller-provided fields. Filter out undefined values BEFORE the
  // emptiness check — without the filter, a caller passing
  // `details: { stack: undefined }` (e.g. an error with no stack
  // property) would produce a non-empty `Object.keys` count, set
  // `tickError.details = { stack: undefined }`, and JSON-serialize
  // to `{}` on the wire. Filter so the dropped-when-empty intent
  // actually holds.
  const rawMerged =
    batchId !== undefined ? { batchId, ...(details || {}) } : details;
  const mergedDetails = rawMerged
    ? Object.fromEntries(
        Object.entries(rawMerged).filter(([, v]) => v !== undefined),
      )
    : undefined;
  if (mergedDetails && Object.keys(mergedDetails).length > 0) {
    tickError.details = mergedDetails;
  }

  reportError(tickError);
  setStatus("failed");
  await fireTickNow();

  return tickError;
}
