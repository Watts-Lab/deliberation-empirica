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

// Attribute names classifyPlayer reads. Listing them explicitly here
// (rather than letting classifyPlayer do its own .get() calls)
// minimizes the API surface a test mock has to implement and keeps
// the wire-format `details[i].attrs` payload bounded — so the
// manager's tick `state` snapshot doesn't accidentally swell with
// every new attribute the runtime starts setting on a player.
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
  const players = ctx?.scopesByKind?.("player") ?? [];
  const buckets = ZERO_BUCKETS();
  const details = players.map((player) => {
    const attrs = readAttrs(player, CLASSIFICATION_ATTRS);
    const bucket = classifyPlayer(attrs);
    buckets[bucket] += 1;
    return { id: player.id, bucket, attrs };
  });
  return { buckets, details };
}
