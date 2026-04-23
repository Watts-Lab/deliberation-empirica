import { describe, test, expect } from "vitest";
import { computeStageCoherent, diagnoseStageCoherent } from "./compute";

// Build a minimal scope fixture. `stageID` on player.stage / peer.stage
// mirrors what real Empirica seeds via `createPlayerStage` — see the
// attribute setter in @empirica/core/src/admin/classic/models.ts.
function scope(id, attrs = {}) {
  return {
    id,
    get: (key) => (key in attrs ? attrs[key] : null),
  };
}

function makePlayer(
  id,
  stageId,
  { playerGame = true, playerRound = true, playerStage = true } = {},
) {
  return {
    id,
    game: playerGame ? scope(`pg-${id}`) : null,
    round: playerRound ? scope(`pr-${id}`) : null,
    stage: playerStage
      ? scope(`ps-${id}-${stageId}`, { stageID: stageId })
      : null,
  };
}

function coherentFixture({
  stageId = "s-A",
  selfId = "p0",
  peerIds = ["p1"],
} = {}) {
  const self = makePlayer(selfId, stageId);
  const peers = peerIds.map((id) => makePlayer(id, stageId));
  return {
    player: self,
    players: [self, ...peers],
    game: scope("g-1"),
    stage: scope(stageId),
    round: scope("r-1"),
  };
}

describe("computeStageCoherent — existence checks", () => {
  test("returns true when all scopes exist and ids agree", () => {
    expect(computeStageCoherent(coherentFixture())).toBe(true);
  });

  test.each([["player"], ["players"], ["game"], ["stage"], ["round"]])(
    "returns false when %s is missing (Race 2)",
    (scopeName) => {
      const fx = coherentFixture();
      fx[scopeName] = null;
      expect(computeStageCoherent(fx)).toBe(false);
    },
  );

  test.each([["game"], ["round"], ["stage"]])(
    "returns false when self.%s has not hydrated (Race 3)",
    (attr) => {
      const fx = coherentFixture();
      fx.player[attr] = null;
      expect(computeStageCoherent(fx)).toBe(false);
    },
  );

  test.each([["game"], ["round"], ["stage"]])(
    "returns false when a peer's %s has not hydrated (Race 3)",
    (attr) => {
      const fx = coherentFixture();
      // mutate the peer (second entry in players)
      fx.players[1][attr] = null;
      expect(computeStageCoherent(fx)).toBe(false);
    },
  );
});

describe("computeStageCoherent — identity checks", () => {
  test("returns false when self.stage.stageID lags useStage().id (Race 1)", () => {
    const fx = coherentFixture({ stageId: "s-B" });
    // Simulate mutable ctx pointing at B while useStage observable still holds A.
    // In the real race, player.stage has already swapped to PlayerStage-for-B
    // (stageID=B) because player.stage reads through ctx; meanwhile
    // useStage() still returns stage A.
    fx.stage = scope("s-A");
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns false when a peer's stageID lags (Race 1 for peer)", () => {
    const fx = coherentFixture();
    // self aligned, peer lagging: peer.stage points at the previous stage.
    fx.players[1].stage = scope("ps-p1-old", { stageID: "s-OLD" });
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns false when self.stage.stageID is null (attribute not yet hydrated)", () => {
    const fx = coherentFixture();
    // PlayerStage scope exists but its stageID attribute hasn't streamed yet.
    fx.player.stage = scope("ps-p0", { stageID: null });
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns false when self.stage.stageID is undefined (attribute key absent)", () => {
    // Real Empirica `.get()` returns the raw attribute value; an unset
    // attribute resolves to undefined, not null. Both should fail the
    // identity equality check.
    const fx = coherentFixture();
    fx.player.stage = {
      id: "ps-p0",
      get: (key) => (key === "stageID" ? undefined : null),
    };
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns false when stage.id is null", () => {
    const fx = coherentFixture();
    fx.stage = scope(null);
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns false when stage.id is empty string", () => {
    const fx = coherentFixture();
    fx.stage = scope("");
    expect(computeStageCoherent(fx)).toBe(false);
  });
});

describe("computeStageCoherent — players array shapes", () => {
  test("returns true for solo player (players = [self])", () => {
    const fx = coherentFixture({ peerIds: [] });
    expect(fx.players).toHaveLength(1);
    expect(fx.players[0]).toBe(fx.player);
    expect(computeStageCoherent(fx)).toBe(true);
  });

  test("returns false when players is empty (self not yet in array)", () => {
    // In a real fan-out race, `players` could briefly be [] while player
    // and stage are already set. Without the self-in-players guard, the
    // existing `.some(...)` checks trivially return false, making the
    // gate wrongly report coherent.
    const fx = coherentFixture();
    fx.players = [];
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns false when self is missing from non-empty players array", () => {
    // Another variant: players has peers but self itself hasn't landed.
    const fx = coherentFixture();
    fx.players = fx.players.filter((p) => p.id !== fx.player.id);
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns false with 3 peers if exactly one has a mismatch (regression: .some vs .every)", () => {
    const fx = coherentFixture({ peerIds: ["p1", "p2", "p3"] });
    // Only p2 has a lagging stageID; p1 and p3 are fine.
    fx.players[2].stage = scope("ps-p2-old", { stageID: "s-OLD" });
    expect(computeStageCoherent(fx)).toBe(false);
  });

  test("returns true with 3 peers when all align", () => {
    const fx = coherentFixture({ peerIds: ["p1", "p2", "p3"] });
    expect(computeStageCoherent(fx)).toBe(true);
  });
});

describe("diagnoseStageCoherent — reason codes", () => {
  test("coherent fixture reports { coherent: true }", () => {
    expect(diagnoseStageCoherent(coherentFixture())).toEqual({
      coherent: true,
    });
  });

  test.each([
    ["player", "noPlayer"],
    ["players", "noPlayers"],
    ["game", "noGame"],
    ["stage", "noStage"],
    ["round", "noRound"],
  ])("missing %s -> reason %s", (scopeName, reason) => {
    const fx = coherentFixture();
    fx[scopeName] = null;
    expect(diagnoseStageCoherent(fx)).toEqual({ coherent: false, reason });
  });

  test("missing self.stage -> noPlayerStage", () => {
    const fx = coherentFixture();
    fx.player.stage = null;
    expect(diagnoseStageCoherent(fx)).toEqual({
      coherent: false,
      reason: "noPlayerStage",
    });
  });

  test("missing peer.stage -> noPeerStage with peerId", () => {
    const fx = coherentFixture();
    fx.players[1].stage = null;
    expect(diagnoseStageCoherent(fx)).toEqual({
      coherent: false,
      reason: "noPeerStage",
      peerId: "p1",
    });
  });

  test("self stage id mismatch -> selfStageIdMismatch with both ids", () => {
    const fx = coherentFixture({ stageId: "s-B" });
    fx.stage = scope("s-A");
    expect(diagnoseStageCoherent(fx)).toEqual({
      coherent: false,
      reason: "selfStageIdMismatch",
      selfStageID: "s-B",
      stageId: "s-A",
    });
  });

  test("peer stage id mismatch -> peerStageIdMismatch with peer id", () => {
    const fx = coherentFixture();
    fx.players[1].stage = scope("ps-p1-old", { stageID: "s-OLD" });
    expect(diagnoseStageCoherent(fx)).toEqual({
      coherent: false,
      reason: "peerStageIdMismatch",
      peerId: "p1",
      peerStageID: "s-OLD",
      stageId: "s-A",
    });
  });

  test("first failing peer wins when multiple peers are mismatched", () => {
    const fx = coherentFixture({ peerIds: ["p1", "p2", "p3"] });
    fx.players[2].stage = scope("ps-p2-old", { stageID: "s-OLD" });
    fx.players[3].stage = scope("ps-p3-old", { stageID: "s-ALSO-OLD" });
    const result = diagnoseStageCoherent(fx);
    expect(result.reason).toBe("peerStageIdMismatch");
    expect(result.peerId).toBe("p2"); // first-failing player wins
    expect(result.peerStageID).toBe("s-OLD");
  });
});
