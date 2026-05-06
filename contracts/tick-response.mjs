import { z } from "zod";

/**
 * Manager's response to a tick POST.
 *
 * The runtime advances `lastAckedSequence` and per-path content
 * hashes ONLY on `ok: true`. On `ok: false retryable: true` the
 * runtime leaves both untouched — the next scheduled tick re-peeks
 * the same payload (same sequence, same save, same errors). On
 * `ok: false retryable: false` the runtime advances state, logs the
 * rejection to operator stderr, and captures it to Sentry with full
 * context (sequence, status, code, validation issues, instance/batch/
 * study/workspace tags). The non-retryable case usually indicates a
 * runtime bug (malformed tick, premature `status: complete`, contract
 * violation) or an upstream-infrastructure blip producing a non-
 * conformant response — both are platform-developer-actionable per
 * manager interface-contract.md §"Error surfacing: two pipelines",
 * not researcher-facing. Advancing the cursor prevents the runtime
 * from looping on a payload the manager has permanently rejected.
 *
 * Shape mirrors manager/src/lib/tickContract.ts.
 */
export const tickResponseOk = z.object({
  ok: z.literal(true),
  // Echoes the sequence the manager just ack'd. Lets the runtime
  // catch protocol drift (manager ack'd a sequence the runtime
  // didn't send) and detect skipped acks.
  ackedSequence: z.number().int().nonnegative(),
  // Present when the tick carried a save and the manager committed
  // it to the destination repo. The runtime stores this for the
  // dashboard's per-save provenance display (BL-22).
  commitSha: z.string().optional(),
});

export const tickResponseFail = z.object({
  ok: z.literal(false),
  // Whether the runtime should retry on the next scheduled tick.
  // `false` means the manager has decided the payload is permanently
  // unacceptable (schema violation, contract breach, etc.); `true`
  // means a transient failure (rate limit, downstream blip).
  retryable: z.boolean(),
  // Stable identifier from manager's error catalog (e.g.
  // `RUNTIME_PROTOCOL_VIOLATION_PREMATURE_COMPLETE`). Surfaces in
  // the runtime's logs and Sentry breadcrumbs.
  code: z.string().min(1),
  // Human-readable diagnostic.
  message: z.string().optional(),
});

export const tickResponse = z.discriminatedUnion("ok", [
  tickResponseOk,
  tickResponseFail,
]);
