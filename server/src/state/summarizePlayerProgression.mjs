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

export function summarizePlayerProgression(ctx) {
  // `ctx.scopesByKind("player")` returns the live scope collection
  // for the kind. Empirica's classic-admin sometimes returns an
  // array, sometimes a Map-like keyed by id (with `.values()` /
  // `.get()` methods), and sometimes (briefly, around batch init
  // before any players exist) an iterable that isn't a true Array.
  // The `?? []` fallback only fires for null/undefined, NOT for
  // "non-array but truthy" — so a Map slipped through and made
  // `.map()` throw `t.map is not a function`, which surfaced as a
  // hard tick failure in production 2026-05-09.
  //
  // Two-level normalization:
  //
  //  1. If the value looks Map-like (`.values` + `.get`, not an
  //     Array), iterate `.values()` — `Array.from(map)` would yield
  //     `[id, scope]` entry tuples, which the classifier would read
  //     as `tuple.id === undefined` and silently classify every
  //     player as "unknown". The values-iterator yields the actual
  //     scope objects.
  //  2. Otherwise feed straight into `Array.from(...)`, which
  //     accepts arrays, Sets, generators, and any iterable. A
  //     non-iterable input (some future Empirica revision) lands
  //     in the catch below and falls back to empty — better to
  //     emit a tick with `participants.count: 0` than to crash
  //     every tick until shutdown.
  const rawPlayers = ctx?.scopesByKind?.("player");
  let players = [];
  try {
    if (rawPlayers == null) {
      players = [];
    } else if (
      typeof rawPlayers === "object" &&
      !Array.isArray(rawPlayers) &&
      typeof rawPlayers.values === "function" &&
      typeof rawPlayers.get === "function"
    ) {
      // Map-like — iterate values, not entries.
      players = Array.from(rawPlayers.values());
    } else {
      players = Array.from(rawPlayers);
    }
  } catch {
    players = [];
  }
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

    // `lastSeenAt` (per-tick heartbeat for BL-20's staleness
    // color-coding) is reserved for a future per-player heartbeat
    // tracker. Empirica's `connected` is a boolean, not a
    // timestamp; `timeArrived` is first-connect, not last-seen.
    // Filed as a follow-up: until then, the manager's dashboard
    // renders `lastSeenAt: absent` as "unknown staleness".

    return detail;
  });
  return { buckets, details };
}
