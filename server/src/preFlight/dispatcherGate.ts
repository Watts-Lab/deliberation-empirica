/**
 * Decide whether to (re-)create a dispatcher for a batch in the
 * `Empirica.on("batch", ...)` kind handler.
 *
 * The kind handler (`Empirica.on("batch", cb)`) subscribes via
 * Empirica's internal `startKind`, which fires `cb` once per NEW
 * batch scope and does NOT re-fire on subsequent attribute changes
 * to existing scopes. So this gate runs at most once per batch in
 * the handler's lifetime (modulo server restarts, which re-fire
 * the handler for each existing batch as it's re-subscribed).
 *
 * Two predicates:
 *
 *  1. **Status is not terminal.** Skip dispatcher creation for
 *     batches in `terminated` or `failed` — those batches will
 *     never accept players, so the dispatcher is dead weight.
 *     Crucially we do NOT require status to be `created`/`running`
 *     because manager-launched batches arrive with status
 *     `undefined` or `initializing` at scope-creation time (per
 *     deliberation-lab/deliberation-lab#162 + the manager-side
 *     handshake at deliberation-lab/manager#203). The classic-admin
 *     path sets status atomically with config (so it's `created`
 *     immediately); the manager-launched path sets it later via
 *     `setAttributes`. Both pass this predicate.
 *
 *  2. **No dispatcher already exists for this batch.** Idempotency —
 *     don't replace a working dispatcher with a fresh one mid-flight.
 *
 * Returns `true` iff both predicates hold.
 */
export function shouldCreateDispatcher({
  status,
  hasDispatcher,
}: {
  status: unknown;
  hasDispatcher: boolean;
}): boolean {
  if (hasDispatcher) return false;
  if (status === "terminated" || status === "failed") return false;
  return true;
}
