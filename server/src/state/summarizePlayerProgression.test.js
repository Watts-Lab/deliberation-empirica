import { describe, test, expect } from "vitest";
import {
  classifyPlayer,
  summarizePlayerProgression,
  BUCKET_KEYS,
} from "./summarizePlayerProgression.mjs";

// Build an Empirica-shaped player scope (id + get) from a plain attrs
// object — what the production helper consumes via
// ctx.scopesByKind("player").
const makePlayer = (id, attrs) => ({
  id,
  get: (key) => attrs[key],
});

const makeCtx = (players) => ({
  scopesByKind: (kind) => (kind === "player" ? players : []),
});

describe("classifyPlayer (pure attribute-map classification)", () => {
  test("exitStatus=complete → completed (priority over everything else)", () => {
    expect(
      classifyPlayer({
        exitStatus: "complete",
        gameFinished: true,
        connected: true,
        gameId: "g1",
      }),
    ).toBe("completed");
  });

  test("gameFinished && connected → inExitSequence", () => {
    expect(
      classifyPlayer({ gameFinished: true, connected: true, gameId: "g1" }),
    ).toBe("inExitSequence");
  });

  test("gameId && connected → inGame", () => {
    expect(classifyPlayer({ gameId: "g1", connected: true })).toBe("inGame");
  });

  test("assigned && connected → inGame (alternative to gameId)", () => {
    expect(classifyPlayer({ assigned: true, connected: true })).toBe("inGame");
  });

  test("introDone && connected → inLobby", () => {
    expect(classifyPlayer({ introDone: true, connected: true })).toBe(
      "inLobby",
    );
  });

  test("inCountdown && connected → inCountdown", () => {
    expect(classifyPlayer({ inCountdown: true, connected: true })).toBe(
      "inCountdown",
    );
  });

  test("connected (nothing else) → inIntro", () => {
    expect(classifyPlayer({ connected: true })).toBe("inIntro");
  });

  test("connected === false → disconnected", () => {
    expect(classifyPlayer({ connected: false })).toBe("disconnected");
  });

  test("connected undefined and no other signal → unknown", () => {
    expect(classifyPlayer({})).toBe("unknown");
  });

  test("priority: completed wins over inExitSequence", () => {
    expect(
      classifyPlayer({
        exitStatus: "complete",
        gameFinished: true,
        connected: true,
      }),
    ).toBe("completed");
  });

  test("priority: inExitSequence wins over inGame", () => {
    expect(
      classifyPlayer({
        gameFinished: true,
        connected: true,
        gameId: "g1",
      }),
    ).toBe("inExitSequence");
  });

  test("priority: inGame wins over inLobby", () => {
    expect(
      classifyPlayer({
        gameId: "g1",
        connected: true,
        introDone: true,
      }),
    ).toBe("inGame");
  });

  test("priority: inLobby wins over inIntro", () => {
    expect(classifyPlayer({ introDone: true, connected: true })).toBe(
      "inLobby",
    );
  });
});

describe("summarizePlayerProgression (reads from Empirica ctx)", () => {
  test("empty ctx returns zero counts and empty details", () => {
    const out = summarizePlayerProgression(makeCtx([]));
    BUCKET_KEYS.forEach((k) => expect(out.buckets[k]).toBe(0));
    expect(out.details).toEqual([]);
  });

  test("ctx with one player in each bucket totals correctly", () => {
    const ctx = makeCtx([
      makePlayer("p-completed", { exitStatus: "complete" }),
      makePlayer("p-exitSeq", { gameFinished: true, connected: true }),
      makePlayer("p-inGame", { gameId: "g1", connected: true }),
      makePlayer("p-inLobby", { introDone: true, connected: true }),
      makePlayer("p-countdown", { inCountdown: true, connected: true }),
      makePlayer("p-intro", { connected: true }),
      makePlayer("p-disconnected", { connected: false }),
      makePlayer("p-unknown", {}),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.buckets).toEqual({
      completed: 1,
      inExitSequence: 1,
      inGame: 1,
      inLobby: 1,
      inCountdown: 1,
      inIntro: 1,
      disconnected: 1,
      unknown: 1,
    });
    expect(out.details).toHaveLength(8);
  });

  test("details emit closed-shape digest — no `attrs`, only typed fields", () => {
    // Post-manager#262 / dl#187: the wire payload no longer carries
    // an open-ended `attrs` slot. The runtime still reads the seven
    // classification attrs internally (to classify the bucket), but
    // discards them after classification rather than forwarding.
    // Unrelated keys on the player scope are inert by construction.
    const ctx = makeCtx([
      makePlayer("p1", {
        // classification keys (consumed for bucket, then dropped).
        // gameId + connected → inGame per classifyPlayer rules; we
        // want a player whose gameId is set so the gameId-surfacing
        // assertion below has something to surface.
        connected: true,
        gameId: "g42",
        // unrelated keys that used to risk leaking through attrs —
        // now structurally impossible because the wire shape is
        // closed.
        nickname: "alice",
        browserInfo: { os: "darwin" },
        someExperimentalAttr: "x",
      }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details).toHaveLength(1);
    expect(out.details[0].id).toBe("p1");
    expect(out.details[0].bucket).toBe("inGame");
    // No more `attrs` slot.
    expect(out.details[0]).not.toHaveProperty("attrs");
    // gameId is surfaced top-level (it's the Empirica "matched
    // group" identifier, useful for BL-20's "which cohort is this
    // person in" surface).
    expect(out.details[0].gameId).toBe("g42");
    // Unrelated keys never make it onto the wire shape.
    expect(out.details[0]).not.toHaveProperty("nickname");
    expect(out.details[0]).not.toHaveProperty("browserInfo");
    expect(out.details[0]).not.toHaveProperty("someExperimentalAttr");
  });

  test("treatmentName surfaces top-level from player.get('treatmentName')", () => {
    const ctx = makeCtx([
      makePlayer("p1", {
        connected: true,
        gameId: "g1",
        treatmentName: "abortion-control",
      }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0].treatmentName).toBe("abortion-control");
  });

  test("treatmentName/gameId omitted when not set (BL-20 renders as 'not assigned')", () => {
    // Pre-matching / pre-assignment: player exists but has no
    // treatment/game yet. The wire shape leaves the fields absent
    // rather than emitting empty-string sentinels.
    const ctx = makeCtx([
      makePlayer("p1", {
        connected: true,
        // no gameId, no treatmentName
      }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0]).not.toHaveProperty("treatmentName");
    expect(out.details[0]).not.toHaveProperty("gameId");
  });

  test("lastCompletedAt surfaces from player.get('timeComplete') — the runtime's exit timestamp", () => {
    const completedAt = "2026-05-14T16:42:00.000Z";
    const ctx = makeCtx([
      makePlayer("p1", {
        connected: true,
        exitStatus: "complete",
        timeComplete: completedAt,
      }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0].bucket).toBe("completed");
    expect(out.details[0].lastCompletedAt).toBe(completedAt);
  });

  test("lastCompletedAt absent for participants who haven't completed yet", () => {
    const ctx = makeCtx([
      makePlayer("p1", { connected: true, introDone: true }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0]).not.toHaveProperty("lastCompletedAt");
  });

  test("lastSeenAt is intentionally absent (heartbeat tracker is a future addition)", () => {
    // Documented in the helper: Empirica doesn't expose a continuous
    // heartbeat timestamp. `timeArrived` (first-connect) and
    // `timeIntroDone` (lifecycle transition) aren't accurate
    // staleness signals for BL-20's red/yellow/green color-coding,
    // so the runtime emits the field as absent until there's a
    // genuine per-tick heartbeat source. Test pins the current
    // contract — when heartbeat lands, this test gets updated
    // alongside.
    const ctx = makeCtx([
      makePlayer("p1", {
        connected: true,
        timeArrived: "2026-05-14T15:00:00.000Z",
        timeIntroDone: "2026-05-14T15:05:00.000Z",
      }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0]).not.toHaveProperty("lastSeenAt");
  });

  test("counts match details length (per-bucket)", () => {
    const ctx = makeCtx([
      makePlayer("a", { introDone: true, connected: true }),
      makePlayer("b", { introDone: true, connected: true }),
      makePlayer("c", { introDone: true, connected: true }),
      makePlayer("d", { connected: false }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.buckets.inLobby).toBe(3);
    expect(out.buckets.disconnected).toBe(1);
    expect(out.details.filter((d) => d.bucket === "inLobby")).toHaveLength(3);
    expect(out.details.filter((d) => d.bucket === "disconnected")).toHaveLength(
      1,
    );
  });

  test("tolerates a ctx without scopesByKind (returns empty)", () => {
    const out = summarizePlayerProgression({});
    expect(out.details).toEqual([]);
    expect(out.buckets.unknown).toBe(0);
  });

  test("accepts a player with plain attributes (no .get) — useful for tests", () => {
    const ctx = {
      scopesByKind: () => [
        { id: "p1", introDone: true, connected: true },
        { id: "p2", connected: false },
      ],
    };
    const out = summarizePlayerProgression(ctx);
    expect(out.buckets.inLobby).toBe(1);
    expect(out.buckets.disconnected).toBe(1);
  });

  test("Map-like scopesByKind result: iterates values, not [id, scope] entries (regression for `t.map is not a function`)", () => {
    // Surfaced live 2026-05-09: a manager-launched batch's first
    // tick threw `tick: onTick threw err: t.map is not a function`
    // because `ctx.scopesByKind('player')` returned a Map at batch
    // init (no players yet), and the previous code only fell back
    // on null/undefined, leaving the Map to flow into `.map()` and
    // crash. The fix detects Map-likes (`.values` + `.get`, not an
    // Array) and iterates `.values()` so the actual scope objects
    // reach the classifier — `Array.from(map)` would yield
    // `[id, scope]` entry tuples and silently classify every
    // player as `unknown`.
    const ctx = {
      scopesByKind: (kind) =>
        kind === "player"
          ? new Map([
              ["p1", makePlayer("p1", { introDone: true, connected: true })],
              ["p2", makePlayer("p2", { connected: false })],
            ])
          : [],
    };
    const out = summarizePlayerProgression(ctx);
    expect(out.buckets.inLobby).toBe(1);
    expect(out.buckets.disconnected).toBe(1);
    expect(out.details.map((d) => d.id).sort()).toEqual(["p1", "p2"]);
  });

  test("non-iterable scopesByKind result → empty list via try/catch (no throw)", () => {
    // `Array.from({ foo: 'bar' })` returns `[]` (treated as array-
    // like with length=0) and would NOT exercise the try/catch.
    // Use an object whose `Symbol.iterator` is non-callable so
    // `Array.from` actually throws inside the iteration protocol —
    // that's the path the catch is there to handle.
    const ctx = {
      scopesByKind: () => ({
        // Non-callable: throws TypeError when Array.from invokes it.
        [Symbol.iterator]: "not a function",
      }),
    };
    const out = summarizePlayerProgression(ctx);
    expect(out.details).toEqual([]);
    expect(out.buckets.unknown).toBe(0);
  });
});
