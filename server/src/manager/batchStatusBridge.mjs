/**
 * Bridges the Tajriba-side `batch.status` attribute into the
 * manager-runtime's internal `TickStatus` (per `manager/index.mjs`).
 *
 * Two parallel state stores exist in the runtime:
 *
 *   1. **`batch.status`** — a Tajriba scope attribute. The manager's
 *      early-close flow flips this to `"terminated"` via
 *      `setAttributes`; Empirica itself flips it to `"failed"` on
 *      runtime errors. The runtime observes via `Empirica.on("batch",
 *      "status", …)` and runs `closeBatch(...)`.
 *
 *   2. **`TickStatus`** — module-scoped state inside
 *      `manager/index.mjs:initManagerRuntime`. The per-tick payload's
 *      `status` field comes from this. Defaults to `"running"`,
 *      advances via `setStatus(next)`. Validates transitions per
 *      `tickStatus.mjs:TRANSITIONS`.
 *
 * Pre-#158, the batch-status handler updated (1) and ran
 * Empirica's normal teardown but never advanced (2). The runtime
 * kept emitting `status: "running"` forever after early-close, the
 * manager's silence detector never tripped (ticks were arriving
 * happily), and the Railway service stayed alive indefinitely.
 *
 * Mapping (note: `terminated` and `failed` are NOT equivalent):
 *
 *   - `batch.status === "terminated"` → `setStatus("draining")`.
 *     The manager-driven graceful-close path: a researcher hit
 *     early-close, the runtime should drain in-flight participants
 *     before transitioning to complete via the runtime's existing
 *     `setStatus("complete")` callsites once all saves are ack'd.
 *
 *   - `batch.status === "failed"` → `setStatus("failed")`.
 *     The terminal-error path. Note that `reportTerminalError` may
 *     ALREADY have flipped TickStatus to `"failed"` before Empirica
 *     emitted the batch-status change; `setStatus`'s same-state
 *     re-set is a no-op (per `tickStatus.mjs:50`), so this is
 *     idempotent. The earlier draft mapped both to `"draining"`,
 *     which would throw `"Invalid transition: failed → draining"`
 *     in the report-error-then-batch-fail ordering. Caught in
 *     code review pre-merge.
 *
 * Ordering: callsite invokes the bridge AFTER `closeBatch`
 * resolves so the post-flight report has actually started before
 * the runtime claims `draining` on the wire. Either order is
 * functionally fine (next tick fires on the 60s scheduler cadence,
 * not synchronously), but post-`closeBatch` is the more
 * semantically honest order.
 *
 * Pulled out into a pure function (vs. inlining inside the
 * `Empirica.on` handler) so the (status → setStatus-arg) mapping
 * has a unit-test surface that doesn't require Empirica's
 * ClassicListenersCollector.
 */

const TERMINAL_BATCH_STATUSES = new Map([
  ["terminated", "draining"],
  ["failed", "failed"],
]);

export function advanceManagerStatusOnBatchStatusChange({
  status,
  setManagerStatus,
}) {
  const target = TERMINAL_BATCH_STATUSES.get(status);
  if (target === undefined) return;
  setManagerStatus(target);
}
