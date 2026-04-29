import { describe, test, expect, vi } from "vitest";
import { buildPreregData } from "./preFlight/preregisterHelpers";
import { buildPlayerData } from "./postFlight/scienceDataHelpers";

/**
 * Cross-helper invariant: every preregistered player who later
 * appears in scienceData has a matching sampleId in both rows.
 *
 * Pinned by cypress 01:1009-1018:
 *   const dataSampleIds = dataObjects.map((d) => d.sampleId);
 *   const preregSampleIds = preregistrationObjects.map((p) => p.sampleId);
 *   expect(dataSampleIds).to.include.members(preregSampleIds);
 *
 * The structural setup (preregister.js:17,29) mints a UUID once,
 * passes it as `sampleId` to `buildPreregData`, then `player.set`s
 * it on the player. `buildPlayerData` reads `player.get("sampleId")`.
 * So as long as both helpers source from the player's sampleId
 * attribute, the join holds.
 *
 * This file pins that contract — a regression that diverges either
 * helper's sampleId source (e.g. switching scienceData to
 * `participantData.deliberationId`) would surface here without
 * needing to run a full L3 e2e.
 */

const makePlayer = (attrs = {}) => ({
  id: "p1",
  get: vi.fn((key) => attrs[key]),
  set: vi.fn(),
  attributes: {
    attrs: new Map([
      [
        "scope0",
        new Map(Object.keys(attrs).map((k) => [k, { value: attrs[k] }])),
      ],
    ]),
  },
});

const makeGame = (attrs = {}) => ({
  id: "g1",
  get: vi.fn((key) => attrs[key]),
  set: vi.fn(),
  rounds: [],
  stages: [],
});

const makeBatch = (attrs = {}) => ({
  id: "b1",
  get: vi.fn((key) => attrs[key]),
});

describe("sampleId join — prereg ↔ scienceData", () => {
  test("when the orchestrator passes sampleId X to buildPreregData and player.set('sampleId', X), both rows carry X", () => {
    // Mirrors preregister.js:17-29 — orchestrator mints sampleId,
    // passes to buildPreregData, then sets it on the player. After
    // that, scienceData export reads `player.get('sampleId')`.
    const sampleId = "sample-uuid-X";

    const treatment = {
      name: "study_A",
      desc: "two-player",
      playerCount: 2,
      gameStages: [
        { name: "s1", duration: 10, elements: [{ type: "submitButton" }] },
      ],
    };
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      timeArrived: "2024-01-01T00:00:00Z",
      treatment,
      sampleId, // simulating `player.set("sampleId", sampleId)` post-prereg
      // Minimal browserInfo / connectionInfo so buildPlayerData
      // doesn't trip on missing optional fields.
      browserInfo: {},
      connectionInfo: {},
      participantData: { deliberationId: "delib-1" },
    });
    const batch = makeBatch({
      label: "batch-label-1",
      assetsRepoSha: "0".repeat(40),
    });
    const game = makeGame({ treatment });

    const preregRow = buildPreregData({
      sampleId,
      player,
      batch,
      game,
      exportErrors: [],
    });
    const scienceRow = buildPlayerData({ player, batch, game });

    expect(preregRow.sampleId).toBe(sampleId);
    expect(scienceRow.sampleId).toBe(sampleId);
    // The contract: if the orchestrator follows the
    // mint-pass-then-set sequence, the rows MUST agree.
    expect(scienceRow.sampleId).toBe(preregRow.sampleId);
  });

  test("when player.sampleId is unset, scienceData uses the 'missing' fallback (and prereg never ran)", () => {
    // The reverse of the join: a scienceData row can exist without a
    // matching prereg row (e.g. preregistration was skipped or
    // failed). In that case scienceDataHelpers.js:150 falls back to
    // "missing". Pin the asymmetry — the cypress 01 assertion
    // (`include.members`) explicitly tolerates this direction.
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      timeArrived: "2024-01-01T00:00:00Z",
      treatment: { name: "x", playerCount: 1 },
      browserInfo: {},
      connectionInfo: {},
      // sampleId intentionally absent
    });
    const batch = makeBatch({ label: "b" });
    const game = makeGame({ treatment: { name: "x" } });

    const scienceRow = buildPlayerData({ player, batch, game });
    expect(scienceRow.sampleId).toBe("missing");
  });

  test("buildPreregData reflects whatever sampleId the orchestrator passes (independent of player.sampleId)", () => {
    // Sanity check on the input contract: buildPreregData takes
    // sampleId as a positional param, not from the player. So the
    // helper itself doesn't enforce the join — preregister.js's
    // orchestrator does. Pin that the helper is loyal to its input
    // even when the player attribute disagrees, so a regression that
    // re-routed the helper to read `player.get('sampleId')` would be
    // caught here.
    const player = makePlayer({
      batchId: "b1",
      gameId: "g1",
      timeArrived: "2024-01-01T00:00:00Z",
      treatment: { name: "x", playerCount: 1 },
      participantData: { deliberationId: "delib-1" },
      sampleId: "stale-from-player",
    });
    const batch = makeBatch({ label: "b" });
    const game = makeGame({ treatment: { name: "x" } });

    const row = buildPreregData({
      sampleId: "fresh-from-orchestrator",
      player,
      batch,
      game,
      exportErrors: [],
    });
    expect(row.sampleId).toBe("fresh-from-orchestrator");
    expect(row.sampleId).not.toBe("stale-from-player");
  });
});
