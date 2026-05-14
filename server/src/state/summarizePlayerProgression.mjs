// Promoted from playwright/e2e/_helpers/empiricaAdminAPI.mjs (per
// deliberation-lab#73) so the manager's tick channel can include a
// real `state` snapshot instead of mocking one.
//
// Two surfaces:
//
//   - `classifyPlayer(attrs)` — pure classification from a plain
//     attribute map to a bucket name. The Playwright test helper
//     re-exports this; `logPlayerCounts` (server/src/utils/logging.js)
//     calls `summarizePlayerProgression` directly for its bucket
//     counts. Three consumers (manager tick payload, operator log
//     line, api-driven test helper) all key on the same function so
//     they cannot drift on the definition of "in lobby" / "in game"
//     / etc. The "unknown" bucket catches players whose `connected`
//     attribute is unset (rather than explicit `false`) — distinct
//     from "disconnected" so an operator can tell "never connected"
//     from "connected and then dropped."
//
//   - `summarizePlayerProgression(ctx)` — production summarizer.
//     Reads in-process Empirica scopes via `ctx.scopesByKind("player")`
//     and produces the `{ buckets, details }` shape the manager's
//     tick payload carries. Output matches contracts/buckets.mjs
//     `participantProgression` (which is loose during the migration:
//     `count` and `buckets` are optional; this helper always emits
//     `buckets` and omits `count`, matching the test helper's
//     historical output shape that #73's contract preserves).
//
// The output shape is stable across the migration:
//
//   { buckets: { completed, inExitSequence, inGame, inLobby,
//                inCountdown, inIntro, disconnected, unknown },
//     details: [{ id, bucket, attrs }, ...] }

const ZERO_BUCKETS = () => ({
  completed: 0,
  inExitSequence: 0,
  inGame: 0,
  inLobby: 0,
  inCountdown: 0,
  inIntro: 0,
  disconnected: 0,
  unknown: 0,
});

// Pure: maps a plain attribute object to a bucket name. Single source
// of truth for the priority order — `logPlayerCounts` and the
// playwright test helper both delegate here, so changing the order
// here changes it for every consumer. Tests in
// summarizePlayerProgression.test.js pin the order explicitly.
export function classifyPlayer(attrs) {
  if (attrs.exitStatus === "complete") return "completed";
  if (attrs.gameFinished && attrs.connected) return "inExitSequence";
  if ((attrs.gameId || attrs.assigned) && attrs.connected) return "inGame";
  if (attrs.introDone && attrs.connected) return "inLobby";
  if (attrs.inCountdown && attrs.connected) return "inCountdown";
  if (attrs.connected) return "inIntro";
  if (attrs.connected === false) return "disconnected";
  return "unknown";
}

// Bucket names in classification-priority order. Exposed for tests
// that want to enumerate without re-typing the list.
export const BUCKET_KEYS = Object.keys(ZERO_BUCKETS());

// Read an attribute off a player scope. Empirica's classic-runtime
// player scopes expose a `get(key)` method; some test harnesses pass
// a plain attribute map instead. Support both so unit tests don't
// need to construct a full mock player object just to drive
// classification.
function readAttrs(player, keys) {
  const out = {};
  const reader =
    typeof player.get === "function"
      ? (key) => player.get(key)
      : (key) => player[key];
  keys.forEach((key) => {
    out[key] = reader(key);
  });
  return out;
}

// Attribute names classifyPlayer reads. Listed explicitly here
// (rather than letting classifyPlayer do its own .get() calls) to
// minimize the API surface a test mock has to implement.
//
// Pre-#262 these attrs ALSO got forwarded on the wire as
// `details[i].attrs`, which was the leak that motivated the digest
// trim. Today they're internal-only: read for classification,
// dropped after. The wire shape carries typed `treatmentName`,
// `gameId`, `lastCompletedAt` fields instead.
const CLASSIFICATION_ATTRS = [
  "exitStatus",
  "gameFinished",
  "connected",
  "gameId",
  "assigned",
  "introDone",
  "inCountdown",
];

// Normalize `ctx.scopesByKind("player")` into a plain array of
// player scopes. Empirica's classic-admin returns:
//   - an array (steady state)
//   - a Map-like (`.values` + `.get`, not an Array) — production
//     incident on 2026-05-09 surfaced this; `Array.from(map)` would
//     yield `[id, scope]` tuples and `tuple.id === undefined` would
//     silently classify every player as "unknown".
//   - null/undefined briefly around batch init before any players
//     exist.
//   - some future non-iterable revision — caught by try/catch and
//     handed back as empty (better to emit `count: 0` than to crash
//     every tick until shutdown).
//
// Exported for testing — both `pumpHeartbeats` and
// `summarizePlayerProgression` use this internally (they share the
// same module so the export isn't required for production wiring),
// but the unit tests in summarizePlayerProgression.test.js exercise
// it directly to pin the Map-vs-array normalization without going
// through a full summarize/pump round-trip.
export function readPlayersFromCtx(ctx) {
  const rawPlayers = ctx?.scopesByKind?.("player");
  try {
    if (rawPlayers == null) {
      return [];
    }
    if (
      typeof rawPlayers === "object" &&
      !Array.isArray(rawPlayers) &&
      typeof rawPlayers.values === "function" &&
      typeof rawPlayers.get === "function"
    ) {
      // Map-like — iterate values, not entries.
      return Array.from(rawPlayers.values());
    }
    return Array.from(rawPlayers);
  } catch {
    return [];
  }
}

/**
 * Per-tick heartbeat pump (dl#190). For every connected player on
 * the ctx, sets `player.set("lastSeenAt", nowFn())` so the next
 * `summarizePlayerProgression` surfaces it on the participant
 * digest. Disconnected players keep their last-known `lastSeenAt` —
 * which is exactly the staleness signal BL-20 wants ("when did we
 * last see this person").
 *
 * "Connected" here is **socket-state**: it tracks WebSocket
 * liveness as Empirica's classic-runtime sees it, not user
 * activity. An open-but-idle tab will look fresh on the dashboard
 * even if the participant hasn't touched the keyboard in an hour.
 * That's intentional for v1 — BL-20 needs to distinguish "we lost
 * the connection" from "we still have the connection" first;
 * activity-vs-idle is a later refinement.
 *
 * Called from the runtime's tick loop BEFORE `buildTickPayload` so
 * the heartbeat reflects the moment the tick fires, not a prior
 * tick's snapshot. `nowFn` is injectable for tests; production
 * defaults to wall-clock. The pre-`buildTickPayload` ordering is
 * regression-pinned by a test in `server/src/manager/index.test.js`.
 *
 * Staleness bound: a participant who disconnects mid-tick keeps
 * the `lastSeenAt` value stamped at the start of the current tick.
 * That value can be up to one tick cadence stale before the
 * dashboard reads it (e.g. a 60s tick → up to ~60s of "we last saw
 * them" before the bucket flips to `disconnected` on the next
 * tick). BL-20's color thresholds account for this bound.
 *
 * Shed-and-retry interaction: when the manager rejects with
 * PAYLOAD_TOO_LARGE the runtime re-runs `buildTickPayload` at a
 * higher shedLevel within the same tick. `pumpHeartbeats` is NOT
 * called again on the retry — it fires once per tick, before the
 * first build. Re-stamping on the retry would mask the staleness
 * signal (the digest would show "we just saw them" even if we
 * spent the retry budget shedding state).
 *
 * Bounded cost: at ~200 connected players × 60s cadence that's
 * ~3 player.set calls per second. Empirica's `set` is in-memory +
 * eventually-flushed; no per-set I/O.
 *
 * The set fires regardless of whether the player's classification
 * bucket would actually surface `lastSeenAt` in the digest (e.g. an
 * `inIntro` player). The summarizer reads whatever the player has;
 * a disconnected-then-reconnected player will pick up the new
 * timestamp on their next connected tick, which is what we want.
 *
 * Test-stub players that lack `.set()` (only `.get()`) skip
 * silently — the unit tests for summarizer pass plain attribute
 * maps that don't implement `set`, and we don't want pumping to
 * break those.
 */
export function pumpHeartbeats(
  ctx,
  { nowFn = () => new Date().toISOString() } = {},
) {
  const players = readPlayersFromCtx(ctx);
  if (players.length === 0) return;
  const now = nowFn();
  // Plain `.forEach` instead of `for...of` to satisfy the repo's
  // airbnb-base lint config (no-restricted-syntax / no-continue).
  // The set-check guard becomes an `if` filter rather than a
  // `continue` — same semantics.
  players.forEach((player) => {
    if (typeof player.set !== "function") return;
    const reader =
      typeof player.get === "function"
        ? (key) => player.get(key)
        : (key) => player[key];
    if (reader("connected") === true) {
      player.set("lastSeenAt", now);
    }
  });
}

export function summarizePlayerProgression(ctx) {
  const players = readPlayersFromCtx(ctx);
  const buckets = ZERO_BUCKETS();
  const details = players.map((player) => {
    // `CLASSIFICATION_ATTRS` stays the internal bucket-classifier
    // input. It used to be emitted on the wire as `attrs` — that's
    // the surface manager#262 closed because it was an unbounded
    // forwarding slot dressed as a 7-field projection. Today the
    // classifier reads them, classifies, and discards.
    const classifierAttrs = readAttrs(player, CLASSIFICATION_ATTRS);
    const bucket = classifyPlayer(classifierAttrs);
    buckets[bucket] += 1;

    // Wire-side digest. Each field is OPTIONAL on the contract;
    // we only emit when the player has a concrete value, so the
    // payload doesn't pay for keys that aren't set yet (e.g.
    // `gameId` before matching). Manager treats absent fields as
    // "not yet known" for the dashboard's rendering.
    const detail = { id: player.id, bucket };
    const reader =
      typeof player.get === "function"
        ? (key) => player.get(key)
        : (key) => player[key];

    const treatmentName = reader("treatmentName");
    if (typeof treatmentName === "string" && treatmentName.length > 0) {
      detail.treatmentName = treatmentName;
    }

    // `gameId` is already read above for classification; re-use the
    // same value (no second player.get call). When non-empty, it
    // surfaces top-level for BL-20 (which match-group is this
    // person in) instead of being buried in the legacy `attrs`.
    if (
      typeof classifierAttrs.gameId === "string" &&
      classifierAttrs.gameId.length > 0
    ) {
      detail.gameId = classifierAttrs.gameId;
    }

    // `timeComplete` is the canonical "this participant finished
    // the study" timestamp the runtime sets in callbacks.js's
    // `onPlayerEnd`. ISO string per the source; contract requires
    // `z.string().datetime()`. Only present for players that
    // reached the exit sequence.
    const timeComplete = reader("timeComplete");
    if (typeof timeComplete === "string" && timeComplete.length > 0) {
      detail.lastCompletedAt = timeComplete;
    }

    // `lastSeenAt` is the per-tick heartbeat for BL-20's staleness
    // color-coding. `pumpHeartbeats` (called from the tick loop
    // before this summarizer) sets it on every currently-connected
    // player; disconnected players keep their last-known value
    // (which is what makes the staleness signal useful: "we last
    // saw this person 4 minutes ago"). Players who have never
    // connected — or test stubs without `.set()` — won't have the
    // field, and it stays absent on the wire.
    const lastSeenAt = reader("lastSeenAt");
    if (typeof lastSeenAt === "string" && lastSeenAt.length > 0) {
      detail.lastSeenAt = lastSeenAt;
    }

    return detail;
  });
  return { buckets, details };
}
