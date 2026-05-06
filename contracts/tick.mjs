import { z } from "zod";
import { participantProgression } from "./buckets.mjs";

/**
 * Tick payload schema for the runtime → manager channel.
 *
 * The unified 60s tick (per manager ADR 0006) carries everything the
 * manager needs to know: a heartbeat (its arrival), a status (the
 * runtime's view of its own lifecycle), an optional save (one tracked
 * file per tick), a state snapshot, and optional structured errors.
 *
 * Shape mirrors manager/src/lib/tickContract.ts. The manager's CI
 * drift check syncs against this file; do not let the two diverge.
 */

/**
 * Runtime-reportable lifecycle states.
 *
 * The full Instance state machine on the manager side is wider —
 * preparing → provisioning → running → sealed → draining →
 * awaiting-teardown → complete | failed (per manager interface-contract.md).
 * The runtime only owns the subset it can directly observe:
 *
 * - `running`   — Empirica batch is admitting; participants are arriving.
 * - `draining`  — Empirica batch terminated; post-flight callbacks running;
 *                 runtime flushing remaining data; not admitting.
 * - `complete`  — Contractual: emitted only after every save has been
 *                 ack'd AND post-flight is done. Anchor for the
 *                 manager's BL-14 verification gate.
 * - `failed`    — Unrecoverable error; runtime stops or stays alive
 *                 quiescent for teardown.
 *
 * `sealed` and `awaiting-teardown` are derived states the manager
 * computes from runtime ticks plus capacity / verification gates;
 * they never appear on the wire from the runtime.
 */
export const tickStatus = z.enum(["running", "draining", "complete", "failed"]);

// Runtime-relative paths only — the manager prepends its own per-Batch
// prefix (`{pilots,data}/{batchId}/{instanceId}/`) before committing,
// so a leading `/` or any `..` traversal segment is a contract
// violation that would let a runtime escape its destination prefix.
// Reject at the schema boundary rather than relying on the manager
// to defend against it.
const safeRelativePath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/"), {
    message: "Path must be relative (no leading slash)",
  })
  .refine((p) => !p.split("/").some((seg) => seg === ".." || seg === "."), {
    message: "Path must not contain `.` or `..` segments",
  });

export const tickSave = z.object({
  // Runtime-relative path. The manager prepends a per-Batch
  // destination prefix (`{pilots,data}/{batchId}/{instanceId}/`) per
  // manager ADR 0005 §"Pass-through data flow".
  path: safeRelativePath,
  // sha256 hex of the file content. Manager dedupes saves by
  // (instance_id, path, contentHash) and uses the hash for the DA-8
  // attestation manifest.
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  // Base64-encoded file content. JSONL files are opaque to the
  // manager — only audit metadata is recorded server-side per
  // manager ADR 0005. The base64 check catches obvious malformations
  // at the boundary; downstream consumers don't need to defend.
  contentBase64: z.string().base64(),
});

export const tickError = z.object({
  // Runtime-generated unique id, monotonic per Instance. Used for
  // (instance_id, error.id) dedup so a replay on a later tick is a
  // no-op rather than a duplicate row.
  id: z.string().min(1),
  // High-level bucket per manager interface-contract.md §"Error
  // surfacing: two pipelines". `validation` errors are
  // researcher-actionable (rendered via DR-1's friendly-error UI);
  // `platform-error` errors are platform-team triage.
  kind: z.enum(["validation", "platform-error"]),
  // Stable identifier from the catalog in errors.mjs. The manager's
  // friendly-error renderer keys on `code` to pick a per-code UI
  // component; codes the renderer doesn't have a specific UI for
  // fall back to plain `message` (degraded but still usable).
  code: z.string().min(1),
  // JSON-pointer-style path into the offending config / treatment
  // file, when relevant for shape errors.
  path: z.string().optional(),
  // Human-readable fallback string. Required so the manager always
  // has something to surface when its renderer doesn't have a
  // per-code component (e.g. a newer runtime emits a code the
  // manager hasn't shipped UI for yet). The renderer uses `details`
  // for affordances and `message` as the safety net.
  message: z.string().min(1),
  // Per-code structured payload. Schema lives in errors.mjs alongside
  // the code definitions; manager treats the field as opaque JSON for
  // storage and relay.
  details: z.record(z.string(), z.unknown()).optional(),
  // Whether the runtime considers this error retryable. Validation
  // errors land as `retryable: false`; transient asset-fetch issues
  // land as `retryable: true`.
  retryable: z.boolean(),
});

/**
 * Snapshot of runtime state. Overwrites the manager's
 * InstanceLiveState row for this Instance on every tick.
 */
export const tickState = z
  .object({
    participants: participantProgression.optional(),
    // Treatment / stage counts — opaque shape for now; the manager
    // displays whatever the runtime emits. Will firm up alongside
    // deliberation-lab#73 as summarizePlayerProgression moves into
    // server/src.
  })
  .passthrough();

export const tickPayload = z.object({
  // Monotonic per-Instance, starting at 0 or 1. Manager replies with
  // `ackedSequence === sequence` on success. Replays of an already-
  // ack'd sequence are no-ops.
  sequence: z.number().int().nonnegative(),
  status: tickStatus,
  // Present only when a tracked file's hash differs from the per-path
  // last-acked value. At most one save per tick — multi-file
  // post-flight bursts ride out-of-band ticks, one per file, per
  // manager ADR 0005 §"Batch close".
  save: tickSave.optional(),
  // Latest snapshot. Manager overwrites InstanceLiveState; no delta
  // accumulation at MVP per manager ADR 0006 §"Polling-first".
  state: tickState.optional(),
  // Runtime-detected issues to surface. Manager dedupes by
  // (instance_id, error.id) on receipt.
  errors: z.array(tickError).optional(),
});
