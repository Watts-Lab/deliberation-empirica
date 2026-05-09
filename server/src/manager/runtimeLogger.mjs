/**
 * Adapt the runtime's pino-style `(obj, msg)` logger call shape to
 * Empirica's variadic `info`/`warn`/`error` (`@empirica/core/console`).
 *
 * Without this adapter, every `logger?.info?.(...)` inside
 * `initManagerRuntime` either no-ops (when `logger` is the prior
 * default of `null`) or, if Empirica's logger is passed verbatim,
 * dumps the context object as the first positional arg with the
 * human-readable message lost in the second slot. Either way, tick
 * results — `acked`/`retry`/`discarded`/`fetch-failed` — vanish from
 * the runtime's log stream.
 *
 * Format: `<msg> <json>` so a grep for the message string finds the
 * line and the JSON context is one parse step away. Falls back to
 * plain forwarding if the call doesn't match the (obj, msg) shape
 * (e.g. a future single-arg logger call).
 *
 * Surfaced as a real production bug 2026-05-08: a freshly-spawned
 * Instance reached Running successfully, but the manager observed
 * `lastTickAt: null` for ~2 minutes until the silence detector
 * marked it Failed, with the runtime logs containing zero tick
 * lines — making the failure mode opaque. Wiring the runtime's own
 * console through this adapter restores per-tick visibility.
 */

export function makeManagerRuntimeLogger({ info, warn, error }) {
  const wrap =
    (sink) =>
    (...args) => {
      if (
        args.length === 2 &&
        typeof args[0] === "object" &&
        args[0] !== null &&
        typeof args[1] === "string"
      ) {
        let serializedDetails;
        try {
          serializedDetails = JSON.stringify(args[0]);
        } catch {
          // Cyclic / non-serializable — best-effort fallback.
          serializedDetails = String(args[0]);
        }
        sink(`${args[1]} ${serializedDetails}`);
        return;
      }
      sink(...args);
    };
  return { info: wrap(info), warn: wrap(warn), error: wrap(error) };
}
