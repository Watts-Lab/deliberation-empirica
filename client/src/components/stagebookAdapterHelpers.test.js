import { describe, test, expect, vi } from "vitest";
import {
  joinRelativeToDir,
  getFromEmpiricaState,
  saveToEmpiricaState,
  resolveAssetURL,
  resolveCdnBaseURL,
} from "./stagebookAdapterHelpers";

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

// ---------- resolveCdnBaseURL ----------

describe("resolveCdnBaseURL (CDN key / literal / fallback lookup)", () => {
  const cdnList = {
    prod: "https://cdn.example.com",
    test: "http://localhost:9091",
  };

  test("returns the URL at the named key", () => {
    expect(
      resolveCdnBaseURL({ batchConfig: { cdn: "test" }, cdnList })
    ).toBe("http://localhost:9091");
  });

  test("treats an unknown cdn value as a literal URL", () => {
    expect(
      resolveCdnBaseURL({
        batchConfig: { cdn: "https://custom.cdn.org" },
        cdnList: {},
      })
    ).toBe("https://custom.cdn.org");
  });

  test("falls back to cdnList.prod when no cdn is set", () => {
    expect(resolveCdnBaseURL({ batchConfig: {}, cdnList })).toBe(
      "https://cdn.example.com"
    );
  });

  test("returns undefined when nothing resolves", () => {
    expect(
      resolveCdnBaseURL({ batchConfig: undefined, cdnList: undefined })
    ).toBeUndefined();
  });
});

// ---------- resolveAssetURL ----------

describe("resolveAssetURL (stagebook path → CDN URL)", () => {
  const cdnList = {
    prod: "https://cdn.example.com",
    test: "http://localhost:9091",
  };

  test("joins a relative path with the treatment file's directory", () => {
    expect(
      resolveAssetURL("hello.prompt.md", {
        batchConfig: {
          cdn: "test",
          treatmentFile: "projects/example/study.treatments.yaml",
        },
        cdnList,
      })
    ).toBe("http://localhost:9091/projects/example/hello.prompt.md");
  });

  test("resolves `..` segments relative to the treatment file", () => {
    expect(
      resolveAssetURL("../../shared/icon.png", {
        batchConfig: {
          cdn: "test",
          treatmentFile: "projects/example/study.treatments.yaml",
        },
        cdnList,
      })
    ).toBe("http://localhost:9091/shared/icon.png");
  });

  test("falls back to cdnList.prod when batchConfig.cdn is absent", () => {
    expect(
      resolveAssetURL("a.png", {
        batchConfig: { treatmentFile: "d/t.yaml" },
        cdnList,
      })
    ).toBe("https://cdn.example.com/d/a.png");
  });

  test("treats batchConfig.cdn as a literal URL when it's not a known key", () => {
    // `cdn` that isn't in `cdnList` is used as-is (the lookup chain is
    // `cdnList[cdn] || cdn || cdnList.prod`). This lets callers point at
    // an arbitrary URL without registering it in `cdnList`.
    expect(
      resolveAssetURL("a.png", {
        batchConfig: {
          cdn: "https://custom.cdn.org",
          treatmentFile: "d/t.yaml",
        },
        cdnList: {}, // none of the known keys match
      })
    ).toBe("https://custom.cdn.org/d/a.png");
  });

  test("returns the path unchanged when no CDN can be resolved", () => {
    expect(
      resolveAssetURL("a.png", { batchConfig: undefined, cdnList: undefined })
    ).toBe("a.png");
  });

  test("handles a treatment file at the CDN root (no directory)", () => {
    expect(
      resolveAssetURL("a.png", {
        batchConfig: { cdn: "test", treatmentFile: "t.yaml" },
        cdnList,
      })
    ).toBe("http://localhost:9091/a.png");
  });

  test("percent-encodes unsafe characters in the final URL", () => {
    expect(
      resolveAssetURL("has spaces.prompt.md", {
        batchConfig: { cdn: "test", treatmentFile: "d/t.yaml" },
        cdnList,
      })
    ).toBe("http://localhost:9091/d/has%20spaces.prompt.md");
  });

  test("handles null treatmentFile by treating dir as empty", () => {
    expect(
      resolveAssetURL("a.png", {
        batchConfig: { cdn: "test", treatmentFile: undefined },
        cdnList,
      })
    ).toBe("http://localhost:9091/a.png");
  });
});
