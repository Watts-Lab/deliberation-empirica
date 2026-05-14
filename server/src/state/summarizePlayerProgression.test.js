import { describe, test, expect } from "vitest";
import {
  classifyPlayer,
  summarizePlayerProgression,
  pumpHeartbeats,
  readPlayersFromCtx,
  BUCKET_KEYS,
} from "./summarizePlayerProgression.mjs";

// Build an Empirica-shaped player scope (id + get + set) from a
// plain attrs object — what the production helper consumes via
// ctx.scopesByKind("player"). `set` mutates the attrs map in place
// so pumpHeartbeats's write is visible to subsequent `.get` calls
// from the summarizer.
const makePlayer = (id, attrs) => ({
  id,
  get: (key) => attrs[key],
  set: (key, value) => {
    // eslint-disable-next-line no-param-reassign
    attrs[key] = value;
  },
});

// Read-only player stub used by tests that explicitly want to
// exercise the "no `.set()`" branch in pumpHeartbeats (the
// summarizer-only tests in this file used to construct stubs like
// this; pumpHeartbeats must tolerate them silently).
const makeReadOnlyPlayer = (id, attrs) => ({
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

  test("lastSeenAt surfaces from player.get('lastSeenAt') — set by pumpHeartbeats (dl#190)", () => {
    // The runtime's tick loop calls `pumpHeartbeats(ctx)` BEFORE
    // building the payload, which stamps `lastSeenAt = now()` on
    // every currently-connected player. This test simulates the
    // post-pump state by passing the timestamp directly through
    // the makePlayer attribute map; the integration with
    // `pumpHeartbeats` is exercised separately below.
    const seenAt = "2026-05-14T15:30:00.000Z";
    const ctx = makeCtx([
      makePlayer("p1", { connected: true, lastSeenAt: seenAt }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0].lastSeenAt).toBe(seenAt);
  });

  test("lastSeenAt absent when never set (e.g., player never connected)", () => {
    // pumpHeartbeats only sets lastSeenAt on `connected: true`
    // players. A player who's never connected — or whose Empirica
    // scope predates this PR's deploy — has no field, and the
    // summarizer omits it from the wire shape.
    const ctx = makeCtx([makePlayer("p1", { connected: false })]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0]).not.toHaveProperty("lastSeenAt");
  });

  test("combination: all five optional fields populated together (no field-collision)", () => {
    // A completed player who was matched into a treatment, with a
    // recent heartbeat. Pins the exact wire shape so a future
    // field-collision (e.g. a refactor overwrites `bucket` with a
    // derived value, or doubles a field name) shows up as a test
    // failure with a clear diff.
    const completedAt = "2026-05-14T16:42:00.000Z";
    const seenAt = "2026-05-14T16:43:00.000Z";
    const ctx = makeCtx([
      makePlayer("p1", {
        exitStatus: "complete",
        connected: true,
        gameId: "g42",
        treatmentName: "abortion-control",
        timeComplete: completedAt,
        lastSeenAt: seenAt,
      }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0]).toEqual({
      id: "p1",
      bucket: "completed",
      treatmentName: "abortion-control",
      gameId: "g42",
      lastCompletedAt: completedAt,
      lastSeenAt: seenAt,
    });
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

describe("pumpHeartbeats (dl#190)", () => {
  test("stamps lastSeenAt on every connected player", () => {
    const FIXED_NOW = "2026-05-14T17:00:00.000Z";
    const attrs1 = { connected: true };
    const attrs2 = { connected: true };
    const ctx = makeCtx([makePlayer("p1", attrs1), makePlayer("p2", attrs2)]);
    pumpHeartbeats(ctx, { nowFn: () => FIXED_NOW });
    expect(attrs1.lastSeenAt).toBe(FIXED_NOW);
    expect(attrs2.lastSeenAt).toBe(FIXED_NOW);
  });

  test("does NOT touch disconnected players — their last-known lastSeenAt sticks", () => {
    // Disconnected staleness is exactly the signal BL-20 needs:
    // "we last saw this person 4 minutes ago." If pumpHeartbeats
    // updated disconnected players too, the dashboard would
    // always show green and never flag anyone as stuck.
    const FIXED_NOW = "2026-05-14T17:00:00.000Z";
    const STALE = "2026-05-14T16:55:00.000Z";
    const attrs = { connected: false, lastSeenAt: STALE };
    const ctx = makeCtx([makePlayer("p1", attrs)]);
    pumpHeartbeats(ctx, { nowFn: () => FIXED_NOW });
    expect(attrs.lastSeenAt).toBe(STALE);
  });

  test("does NOT touch players without a connected=true attribute", () => {
    // Pre-connection (no `connected` set yet) or weird states
    // where the attr is something other than the boolean `true` —
    // skip rather than stamp something a future revision might
    // interpret differently.
    const FIXED_NOW = "2026-05-14T17:00:00.000Z";
    const attrs = {};
    const ctx = makeCtx([makePlayer("p1", attrs)]);
    pumpHeartbeats(ctx, { nowFn: () => FIXED_NOW });
    expect(attrs.lastSeenAt).toBeUndefined();
  });

  test("silently tolerates player stubs without `.set()` (test ergonomics)", () => {
    // Read-only player stubs (no .set) should be skipped silently
    // rather than crashing the pump for the whole ctx.
    const ctx = makeCtx([makeReadOnlyPlayer("p1", { connected: true })]);
    expect(() =>
      pumpHeartbeats(ctx, { nowFn: () => "2026-05-14T17:00:00.000Z" }),
    ).not.toThrow();
  });

  test("no-op on an empty ctx (early boot, no players yet)", async () => {
    const { vi } = await import("vitest");
    const nowFn = vi.fn(() => "2026-05-14T17:00:00.000Z");
    pumpHeartbeats({ scopesByKind: () => [] }, { nowFn });
    // Don't even bother calling nowFn when there's nothing to stamp.
    expect(nowFn).not.toHaveBeenCalled();
  });

  test("uses real wall-clock when nowFn is omitted (production default)", () => {
    const attrs = { connected: true };
    const ctx = makeCtx([makePlayer("p1", attrs)]);
    const before = new Date().toISOString();
    pumpHeartbeats(ctx);
    const after = new Date().toISOString();
    expect(attrs.lastSeenAt).toBeDefined();
    expect(attrs.lastSeenAt >= before).toBe(true);
    expect(attrs.lastSeenAt <= after).toBe(true);
  });

  test("end-to-end: pump → summarize surfaces lastSeenAt on the digest", () => {
    // Integration of the two helpers as the tick loop calls them:
    // pump first, then summarize. The summarizer reads the
    // just-stamped value off the same player scope.
    const FIXED_NOW = "2026-05-14T17:00:00.000Z";
    const ctx = makeCtx([makePlayer("p1", { connected: true })]);
    pumpHeartbeats(ctx, { nowFn: () => FIXED_NOW });
    const out = summarizePlayerProgression(ctx);
    expect(out.details[0].lastSeenAt).toBe(FIXED_NOW);
  });
});

describe("readPlayersFromCtx (exported normalization helper)", () => {
  test("array input passes through unchanged", () => {
    const players = [makePlayer("p1", {}), makePlayer("p2", {})];
    const out = readPlayersFromCtx({ scopesByKind: () => players });
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  test("Map-like input yields VALUES, not entries", () => {
    // Production incident on 2026-05-09: Empirica started returning
    // a Map. `Array.from(map)` yields `[id, scope]` tuples, which
    // caused `tuple.id === undefined` and silently classified
    // every player as unknown. The helper uses `.values()`.
    const p1 = makePlayer("p1", { connected: true });
    const map = new Map([["p1", p1]]);
    const out = readPlayersFromCtx({ scopesByKind: () => map });
    expect(out[0]).toBe(p1);
  });

  test("null / undefined input → empty array (early boot)", () => {
    expect(readPlayersFromCtx({ scopesByKind: () => null })).toEqual([]);
    expect(readPlayersFromCtx({ scopesByKind: () => undefined })).toEqual([]);
    expect(readPlayersFromCtx({})).toEqual([]);
    expect(readPlayersFromCtx(undefined)).toEqual([]);
  });

  test("non-iterable input → empty (defensive)", () => {
    const out = readPlayersFromCtx({ scopesByKind: () => 42 });
    expect(out).toEqual([]);
  });
});
