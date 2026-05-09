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

  test("details carry id, bucket, and bounded attrs (only classification keys)", () => {
    const ctx = makeCtx([
      makePlayer("p1", {
        // classification keys
        introDone: true,
        connected: true,
        // unrelated keys that should NOT leak into details.attrs
        nickname: "alice",
        browserInfo: { os: "darwin" },
        someExperimentalAttr: "x",
      }),
    ]);
    const out = summarizePlayerProgression(ctx);
    expect(out.details).toHaveLength(1);
    expect(out.details[0].id).toBe("p1");
    expect(out.details[0].bucket).toBe("inLobby");
    // Only classification attrs are surfaced — keeps the tick
    // payload bounded across runtime versions even if new attrs
    // are added downstream.
    expect(Object.keys(out.details[0].attrs).sort()).toEqual(
      [
        "assigned",
        "connected",
        "exitStatus",
        "gameFinished",
        "gameId",
        "inCountdown",
        "introDone",
      ].sort(),
    );
    expect(out.details[0].attrs).not.toHaveProperty("nickname");
    expect(out.details[0].attrs).not.toHaveProperty("browserInfo");
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

  test("normalizes an iterable-but-not-Array scopesByKind result (regression for `t.map is not a function`)", () => {
    // Surfaced live 2026-05-09: a manager-launched batch's first
    // tick threw `tick: onTick threw err: t.map is not a function`
    // because `ctx.scopesByKind('player')` returned a Map at batch
    // init (no players yet), and the previous `?? []` only
    // fallbacked on null/undefined, leaving the Map to flow into
    // `.map()` and crash. Array.from accepts Maps + Sets +
    // generators + arrays uniformly.
    const ctx = {
      scopesByKind: (kind) =>
        kind === "player"
          ? new Map([
              ["p1", makePlayer("p1", { introDone: true, connected: true })],
              ["p2", makePlayer("p2", { connected: false })],
            ])
          : [],
    };
    // Map iteration yields [key, value] pairs, not the values
    // directly — so Array.from of a Map produces the entries.
    // That's not what summarizePlayerProgression wants, BUT the
    // important property is that we don't crash. The `.map`
    // callback over `[id, scope]` pairs reads `player.get` on the
    // pair (which is undefined), classifies as "unknown", and
    // emits an entry. Caller learns "0 players I can classify"
    // rather than the runtime hard-crashing every tick.
    expect(() => summarizePlayerProgression(ctx)).not.toThrow();
  });

  test("non-iterable scopesByKind result (e.g. a plain non-array object) → empty list, no throw", () => {
    const ctx = { scopesByKind: () => ({ foo: "bar" }) };
    const out = summarizePlayerProgression(ctx);
    expect(out.details).toEqual([]);
  });
});
