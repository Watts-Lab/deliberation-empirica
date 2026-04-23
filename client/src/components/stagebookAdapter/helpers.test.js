import { describe, test, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  getReferenceKeyAndPath,
  getNestedValueByPath,
} from "stagebook";
import {
  joinRelativeToDir,
  getFromEmpiricaState,
  saveToEmpiricaState,
  resolveAssetURL,
  fetchTextContent,
  buildStagebookContextValue,
} from "./helpers";

vi.mock("axios", () => ({
  default: { get: vi.fn() },
}));

// ---------- Test fixture helpers ----------

// Shallow Empirica-style object: exposes `.get(key)` backed by a plain object.
function makePlayer(attrs = {}) {
  return {
    id: attrs.id ?? "player1",
    get: vi.fn((key) => attrs[key]),
    set: vi.fn(),
  };
}
function makeGame(attrs = {}) {
  return {
    get: vi.fn((key) => attrs[key]),
    set: vi.fn(),
  };
}

// ---------- joinRelativeToDir ----------

describe("joinRelativeToDir", () => {
  test("joins a simple filename with a directory", () => {
    expect(joinRelativeToDir("projects/example", "prompt.md")).toBe(
      "projects/example/prompt.md"
    );
  });

  test("returns the path unchanged when dir is empty", () => {
    expect(joinRelativeToDir("", "prompt.md")).toBe("prompt.md");
  });

  test("returns empty string for null/undefined filePath", () => {
    expect(joinRelativeToDir("a/b", null)).toBe("");
    expect(joinRelativeToDir("a/b", undefined)).toBe("");
  });

  test("collapses `.` segments", () => {
    expect(joinRelativeToDir("projects", "./x")).toBe("projects/x");
  });

  test("collapses `..` to climb into sibling directories", () => {
    expect(joinRelativeToDir("projects/example", "../shared/a.png")).toBe(
      "projects/shared/a.png"
    );
  });

  test("silently drops `..` segments that would escape the root", () => {
    expect(joinRelativeToDir("a", "../../../x")).toBe("x");
  });

  test("collapses double slashes and empty segments", () => {
    expect(joinRelativeToDir("projects//example", "prompt.md")).toBe(
      "projects/example/prompt.md"
    );
  });

  test("preserves filenames with dots", () => {
    expect(joinRelativeToDir("projects/example", "multi.prompt.md")).toBe(
      "projects/example/multi.prompt.md"
    );
  });
});

// ---------- getFromEmpiricaState ----------

describe("getFromEmpiricaState (stagebook scope → Empirica state translation)", () => {
  test("returns the current player's value when scope is undefined", () => {
    const player = makePlayer({ foo: 42 });
    const game = makeGame();
    const result = getFromEmpiricaState("foo", undefined, {
      player,
      game,
      players: [],
    });
    expect(result).toEqual([42]);
    expect(player.get).toHaveBeenCalledWith("foo");
  });

  test("returns the current player's value when scope is 'player'", () => {
    const player = makePlayer({ foo: "bar" });
    expect(
      getFromEmpiricaState("foo", "player", {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual(["bar"]);
  });

  test("returns the game's value when scope is 'shared'", () => {
    const player = makePlayer({ foo: "player-value" });
    const game = makeGame({ foo: "shared-value" });
    const result = getFromEmpiricaState("foo", "shared", {
      player,
      game,
      players: [player],
    });
    expect(result).toEqual(["shared-value"]);
    expect(game.get).toHaveBeenCalledWith("foo");
    expect(player.get).not.toHaveBeenCalledWith("foo");
  });

  test("returns one value per player when scope is 'all'", () => {
    const p0 = makePlayer({ id: "p0", foo: "A", position: "0" });
    const p1 = makePlayer({ id: "p1", foo: "B", position: "1" });
    const p2 = makePlayer({ id: "p2", foo: "C", position: "2" });
    expect(
      getFromEmpiricaState("foo", "all", {
        player: p0,
        game: makeGame(),
        players: [p0, p1, p2],
      })
    ).toEqual(["A", "B", "C"]);
  });

  test("filters by numeric position when scope is a position index", () => {
    const p0 = makePlayer({ id: "p0", foo: "A", position: "0" });
    const p1 = makePlayer({ id: "p1", foo: "B", position: "1" });
    const p2 = makePlayer({ id: "p2", foo: "C", position: "2" });
    expect(
      getFromEmpiricaState("foo", "1", {
        player: p0,
        game: makeGame(),
        players: [p0, p1, p2],
      })
    ).toEqual(["B"]);
  });

  test("returns empty array when no player matches the requested position", () => {
    const p0 = makePlayer({ id: "p0", foo: "A", position: "0" });
    expect(
      getFromEmpiricaState("foo", "99", {
        player: p0,
        game: makeGame(),
        players: [p0],
      })
    ).toEqual([]);
  });

  test("handles a missing player gracefully (returns [undefined])", () => {
    expect(
      getFromEmpiricaState("foo", undefined, {
        player: undefined,
        game: makeGame(),
        players: [],
      })
    ).toEqual([undefined]);
  });

  test("handles a missing game gracefully (returns [undefined])", () => {
    expect(
      getFromEmpiricaState("foo", "shared", {
        player: makePlayer(),
        game: undefined,
        players: [],
      })
    ).toEqual([undefined]);
  });

  test("handles an empty players array for 'all' scope", () => {
    expect(
      getFromEmpiricaState("foo", "all", {
        player: makePlayer(),
        game: makeGame(),
        players: [],
      })
    ).toEqual([]);
  });

  test("handles a null players array (defaults to empty)", () => {
    expect(
      getFromEmpiricaState("foo", "all", {
        player: makePlayer(),
        game: makeGame(),
        players: null,
      })
    ).toEqual([]);
  });
});

// ---------- getFromEmpiricaState: synthesized participantInfo namespace ----------

describe("getFromEmpiricaState('participantInfo')", () => {
  test("synthesizes {name, sampleId, deliberationId} from flat attrs", () => {
    const player = makePlayer({
      name: "Alice",
      sampleId: "sample-42",
      participantData: { deliberationId: "delib-7" },
    });
    expect(
      getFromEmpiricaState("participantInfo", undefined, {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual([
      { name: "Alice", sampleId: "sample-42", deliberationId: "delib-7" },
    ]);
  });

  test("populates fields that exist and leaves the rest undefined", () => {
    // name set pre-preregister, before sampleId has arrived from the server.
    const player = makePlayer({ name: "Bob" });
    expect(
      getFromEmpiricaState("participantInfo", undefined, {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual([
      { name: "Bob", sampleId: undefined, deliberationId: undefined },
    ]);
  });

  test("returns one synthesized object per player under 'all' scope", () => {
    const p0 = makePlayer({ id: "p0", name: "A", position: "0" });
    const p1 = makePlayer({
      id: "p1",
      name: "B",
      sampleId: "s1",
      position: "1",
    });
    expect(
      getFromEmpiricaState("participantInfo", "all", {
        player: p0,
        game: makeGame(),
        players: [p0, p1],
      })
    ).toEqual([
      { name: "A", sampleId: undefined, deliberationId: undefined },
      { name: "B", sampleId: "s1", deliberationId: undefined },
    ]);
  });

  test("filters by position when scope is a position index", () => {
    const p0 = makePlayer({ id: "p0", name: "A", position: "0" });
    const p1 = makePlayer({ id: "p1", name: "B", position: "1" });
    expect(
      getFromEmpiricaState("participantInfo", "1", {
        player: p0,
        game: makeGame(),
        players: [p0, p1],
      })
    ).toEqual([{ name: "B", sampleId: undefined, deliberationId: undefined }]);
  });

  test("falls back to the current player when scope is 'shared'", () => {
    // participantInfo is always per-player; 'shared' has no sensible meaning
    // but stagebook may pass it, so we degrade to the current player rather
    // than returning an empty/undefined result that would surprise callers.
    const player = makePlayer({ name: "Alice" });
    expect(
      getFromEmpiricaState("participantInfo", "shared", {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual([
      { name: "Alice", sampleId: undefined, deliberationId: undefined },
    ]);
  });

  test("returns [undefined] when the current player is missing", () => {
    expect(
      getFromEmpiricaState("participantInfo", undefined, {
        player: undefined,
        game: makeGame(),
        players: [],
      })
    ).toEqual([undefined]);
  });
});

// ---------- End-to-end reference resolution (stagebook ⟷ adapter) ----------
//
// These pin the contract where stagebook and our adapter meet: stagebook
// takes a textual reference like "participantInfo.name" from a treatment
// file, parses it with getReferenceKeyAndPath, calls our get(key, scope),
// then navigates the returned value with getNestedValueByPath.
//
// When the original `participantInfo.name` regression slipped through to
// Cypress, it was precisely because this join point wasn't covered at the
// unit level. Resolving real references here (not just the raw get())
// would have caught it immediately — and will catch any future drift on
// either side without needing a running browser.
describe("stagebook reference resolution ⟷ adapter", () => {
  // Mirror what stagebook's StagebookProvider does internally when it
  // evaluates `reference: <string>` in treatment configs.
  function resolveReference(reference, { player, game, players }) {
    const { referenceKey, path } = getReferenceKeyAndPath(reference);
    const values = getFromEmpiricaState(referenceKey, undefined, {
      player,
      game,
      players,
    });
    return values
      .map((v) => getNestedValueByPath(v, path))
      .filter((v) => v !== undefined);
  }

  test("participantInfo.name resolves to the player's nickname", () => {
    // The bug that motivated this test: stagebook treats participantInfo
    // as a namespace (it calls get("participantInfo") and then navigates
    // .name), but before the synthesize fix our adapter returned
    // [undefined] for get("participantInfo"). A trackedLink with
    // `reference: participantInfo.name` would render participant= (empty).
    const player = makePlayer({
      name: "nickname_playerA",
      sampleId: "s-1",
      participantData: { deliberationId: "delib-1" },
    });
    expect(
      resolveReference("participantInfo.name", {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual(["nickname_playerA"]);
  });

  test("participantInfo.deliberationId resolves through participantData", () => {
    const player = makePlayer({
      name: "n",
      participantData: { deliberationId: "delib-xyz" },
    });
    expect(
      resolveReference("participantInfo.deliberationId", {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual(["delib-xyz"]);
  });

  test("participantInfo.sampleId resolves to the flat sampleId attr", () => {
    const player = makePlayer({ name: "n", sampleId: "s-42" });
    expect(
      resolveReference("participantInfo.sampleId", {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual(["s-42"]);
  });

  test("participantInfo.name yields [] when no nickname has been saved", () => {
    // Pre-intro state: participantData may have arrived but name hasn't.
    // filter(v !== undefined) in stagebook's resolve() drops the missing
    // value; callers see an empty array.
    const player = makePlayer({
      participantData: { deliberationId: "delib-1" },
    });
    expect(
      resolveReference("participantInfo.name", {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual([]);
  });

  test("urlParams.playerKey round-trip (non-participantInfo namespace, regression anchor)", () => {
    // Sanity check: the other namespaces should keep working. urlParams is
    // stored as a real flat object by Consent.jsx, so resolution is the
    // vanilla path (no synthesis).
    const player = makePlayer({
      urlParams: { playerKey: "pk-1", MyId: "mine" },
    });
    expect(
      resolveReference("urlParams.playerKey", {
        player,
        game: makeGame(),
        players: [player],
      })
    ).toEqual(["pk-1"]);
  });
});

// ---------- saveToEmpiricaState ----------

describe("saveToEmpiricaState (stagebook save scope → Empirica set)", () => {
  test("writes to player by default", () => {
    const player = makePlayer();
    const game = makeGame();
    saveToEmpiricaState("key", { a: 1 }, undefined, { player, game });
    expect(player.set).toHaveBeenCalledWith("key", { a: 1 });
    expect(game.set).not.toHaveBeenCalled();
  });

  test("writes to player explicitly when scope is 'player'", () => {
    const player = makePlayer();
    const game = makeGame();
    saveToEmpiricaState("key", 42, "player", { player, game });
    expect(player.set).toHaveBeenCalledWith("key", 42);
    expect(game.set).not.toHaveBeenCalled();
  });

  test("writes to game when scope is 'shared'", () => {
    const player = makePlayer();
    const game = makeGame();
    saveToEmpiricaState("key", [1, 2], "shared", { player, game });
    expect(game.set).toHaveBeenCalledWith("key", [1, 2]);
    expect(player.set).not.toHaveBeenCalled();
  });

  test("no-ops gracefully when player is unset for a player scope", () => {
    const game = makeGame();
    expect(() =>
      saveToEmpiricaState("key", "v", undefined, { player: undefined, game })
    ).not.toThrow();
    expect(game.set).not.toHaveBeenCalled();
  });

  test("no-ops gracefully when game is unset for shared scope", () => {
    const player = makePlayer();
    expect(() =>
      saveToEmpiricaState("key", "v", "shared", { player, game: undefined })
    ).not.toThrow();
    expect(player.set).not.toHaveBeenCalled();
  });
});

// ---------- resolveAssetURL ----------

describe("resolveAssetURL (stagebook path → CDN URL)", () => {
  test("joins a relative path with the treatment file's directory", () => {
    expect(
      resolveAssetURL("hello.prompt.md", {
        batchConfig: {
          cdnURL: "http://localhost:9091",
          treatmentFile: "projects/example/study.treatments.yaml",
        },
      })
    ).toBe("http://localhost:9091/projects/example/hello.prompt.md");
  });

  test("resolves `..` segments relative to the treatment file", () => {
    expect(
      resolveAssetURL("../../shared/icon.png", {
        batchConfig: {
          cdnURL: "http://localhost:9091",
          treatmentFile: "projects/example/study.treatments.yaml",
        },
      })
    ).toBe("http://localhost:9091/shared/icon.png");
  });

  test("returns the path unchanged when no CDN URL is set yet", () => {
    expect(resolveAssetURL("a.png", { batchConfig: undefined })).toBe("a.png");
    expect(resolveAssetURL("a.png", { batchConfig: {} })).toBe("a.png");
  });

  test("handles a treatment file at the CDN root (no directory)", () => {
    expect(
      resolveAssetURL("a.png", {
        batchConfig: { cdnURL: "http://localhost:9091", treatmentFile: "t.yaml" },
      })
    ).toBe("http://localhost:9091/a.png");
  });

  test("percent-encodes unsafe characters in the final URL", () => {
    expect(
      resolveAssetURL("has spaces.prompt.md", {
        batchConfig: { cdnURL: "http://localhost:9091", treatmentFile: "d/t.yaml" },
      })
    ).toBe("http://localhost:9091/d/has%20spaces.prompt.md");
  });

  test("handles null treatmentFile by treating dir as empty", () => {
    expect(
      resolveAssetURL("a.png", {
        batchConfig: { cdnURL: "http://localhost:9091", treatmentFile: undefined },
      })
    ).toBe("http://localhost:9091/a.png");
  });
});

// ---------- fetchTextContent ----------

describe("fetchTextContent (stagebook's Promise<string> contract)", () => {
  const ctx = {
    batchConfig: {
      cdnURL: "http://localhost:9091",
      treatmentFile: "projects/example/study.yaml",
    },
  };

  beforeEach(() => {
    axios.get.mockReset();
  });

  test("returns string responses unchanged", async () => {
    axios.get.mockResolvedValue({ data: "hello world" });
    const result = await fetchTextContent("hello.md", ctx);
    expect(result).toBe("hello world");
    expect(axios.get).toHaveBeenCalledWith(
      "http://localhost:9091/projects/example/hello.md"
    );
  });

  test("JSON-stringifies object responses (some CDNs auto-parse JSON)", async () => {
    axios.get.mockResolvedValue({ data: { a: 1, b: [2, 3] } });
    expect(await fetchTextContent("data.json", ctx)).toBe('{"a":1,"b":[2,3]}');
  });

  test("stringifies numeric/boolean responses too", async () => {
    axios.get.mockResolvedValue({ data: 42 });
    expect(await fetchTextContent("n.txt", ctx)).toBe("42");
  });

  test("propagates fetch errors", async () => {
    axios.get.mockRejectedValue(new Error("network down"));
    await expect(fetchTextContent("x.md", ctx)).rejects.toThrow("network down");
  });

  test("throws before batchConfig arrives instead of fetching a relative URL", async () => {
    // batchConfig undefined (pre-boot). If we quietly called
    // axios.get("hello.md"), the dev server would return its own HTML and
    // stagebook would surface a misleading "must have three sections" parse
    // error. We want a loud failure + stagebook refetches once globals land.
    await expect(
      fetchTextContent("hello.md", { batchConfig: undefined })
    ).rejects.toThrow(/not loaded/);
    await expect(
      fetchTextContent("hello.md", { batchConfig: {} })
    ).rejects.toThrow(/not loaded/);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

// ---------- buildStagebookContextValue ----------

describe("buildStagebookContextValue (full StagebookContext assembly)", () => {
  function makeCtxPlayer({ id = "p1", attrs = {}, submit = false } = {}) {
    const stage = {
      get: vi.fn((key) => (key === "submit" ? submit : undefined)),
      set: vi.fn(),
    };
    return {
      id,
      get: vi.fn((key) => attrs[key]),
      set: vi.fn(),
      stage,
    };
  }

  const baseDeps = {
    progressLabel: "game_1_discussion",
    getElapsedTime: () => 12.5,
    setAllowIdle: vi.fn(),
    batchConfig: { cdnURL: "http://cdn.test", treatmentFile: "p/e/t.yaml" },
    renderDiscussion: vi.fn(() => "discussion"),
    renderSharedNotepad: vi.fn(() => "notepad"),
    renderSurvey: vi.fn(() => "survey"),
  };

  beforeEach(() => {
    axios.get.mockReset();
  });

  test("exposes progressLabel, playerId, playerCount, position", () => {
    const player = makeCtxPlayer({ id: "p9", attrs: { position: "2" } });
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player,
      game: {},
      players: [player, {}, {}],
    });
    expect(ctx.progressLabel).toBe("game_1_discussion");
    expect(ctx.playerId).toBe("p9");
    expect(ctx.position).toBe("2");
    expect(ctx.playerCount).toBe(3);
  });

  test("isSubmitted reflects player.stage.get('submit')", () => {
    const submitted = buildStagebookContextValue({
      ...baseDeps,
      player: makeCtxPlayer({ submit: true }),
      game: {},
      players: [],
    });
    const unsubmitted = buildStagebookContextValue({
      ...baseDeps,
      player: makeCtxPlayer({ submit: false }),
      game: {},
      players: [],
    });
    expect(submitted.isSubmitted).toBe(true);
    expect(unsubmitted.isSubmitted).toBe(false);
  });

  test("submit() writes submit=true to player.stage", () => {
    const player = makeCtxPlayer();
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player,
      game: {},
      players: [],
    });
    ctx.submit();
    expect(player.stage.set).toHaveBeenCalledWith("submit", true);
  });

  test("get() delegates to getFromEmpiricaState with the real deps", () => {
    const player = makeCtxPlayer({ attrs: { foo: "bar" } });
    const game = { get: vi.fn((k) => (k === "shared_x" ? "g" : undefined)) };
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player,
      game,
      players: [player],
    });
    expect(ctx.get("foo")).toEqual(["bar"]);
    expect(ctx.get("shared_x", "shared")).toEqual(["g"]);
  });

  test("save() routes to player by default and game for 'shared'", () => {
    const player = makeCtxPlayer();
    const game = { set: vi.fn() };
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player,
      game,
      players: [],
    });
    ctx.save("k", 1);
    ctx.save("k", 2, "shared");
    expect(player.set).toHaveBeenCalledWith("k", 1);
    expect(game.set).toHaveBeenCalledWith("k", 2);
  });

  test("getAssetURL applies treatment-relative resolution", () => {
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player: makeCtxPlayer(),
      game: {},
      players: [],
    });
    expect(ctx.getAssetURL("hello.md")).toBe("http://cdn.test/p/e/hello.md");
  });

  test("getTextContent stringifies object responses", async () => {
    axios.get.mockResolvedValue({ data: { foo: 1 } });
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player: makeCtxPlayer(),
      game: {},
      players: [],
    });
    expect(await ctx.getTextContent("x.json")).toBe('{"foo":1}');
  });

  test("render slots are wired through to the context value", () => {
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player: makeCtxPlayer(),
      game: {},
      players: [],
    });
    expect(ctx.renderDiscussion).toBe(baseDeps.renderDiscussion);
    expect(ctx.renderSharedNotepad).toBe(baseDeps.renderSharedNotepad);
    expect(ctx.renderSurvey).toBe(baseDeps.renderSurvey);
  });

  test("setAllowIdle is passed through", () => {
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player: makeCtxPlayer(),
      game: {},
      players: [],
    });
    expect(ctx.setAllowIdle).toBe(baseDeps.setAllowIdle);
  });

  test("tolerates a missing player (returns undefined metadata, not a throw)", () => {
    const ctx = buildStagebookContextValue({
      ...baseDeps,
      player: undefined,
      game: undefined,
      players: [],
    });
    expect(ctx.playerId).toBeUndefined();
    expect(ctx.position).toBeUndefined();
    expect(ctx.isSubmitted).toBe(false);
    // submit() should not throw
    expect(() => ctx.submit()).not.toThrow();
  });

  test("contentVersion flips 0 -> 1 when CDN URL arrives in batchConfig", () => {
    const preBoot = buildStagebookContextValue({
      ...baseDeps,
      batchConfig: undefined,
      player: makeCtxPlayer(),
      game: {},
      players: [],
    });
    const postBoot = buildStagebookContextValue({
      ...baseDeps,
      player: makeCtxPlayer(),
      game: {},
      players: [],
    });
    expect(preBoot.contentVersion).toBe(0);
    expect(postBoot.contentVersion).toBe(1);
  });
});
