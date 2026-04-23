import { describe, test, expect, vi } from "vitest";
import {
  getKeys,
  filterByKey,
  collectStageAggregates,
  buildPlayerData,
  validateDailyIdHistory,
} from "./scienceDataHelpers";

// ---------- Fixture builders ----------

// Build an Empirica-style player where:
//   attrs  — the store for `.get(key)` lookups
//   keyScopes — arbitrary grouping of keys so getKeys can enumerate them
function makePlayer({ id = "p1", attrs = {}, keyScopes } = {}) {
  const effectiveScopes = keyScopes ?? [Object.keys(attrs)]; // default: one scope holding all keys
  const attributeScopes = new Map(
    effectiveScopes.map((keys, idx) => [
      `scope${idx}`,
      new Map(keys.map((k) => [k, { value: attrs[k] }])),
    ]),
  );
  return {
    id,
    get: vi.fn((key) => attrs[key]),
    set: vi.fn(),
    attributes: { attrs: attributeScopes },
  };
}

function makeGame({ id = "g1", attrs = {}, rounds = [], stages = [] } = {}) {
  return {
    id,
    get: vi.fn((key) => attrs[key]),
    set: vi.fn(),
    rounds,
    stages,
  };
}

function makeRound(attrs = {}) {
  return { get: vi.fn((key) => attrs[key]) };
}

function makeStage(attrs = {}) {
  return { get: vi.fn((key) => attrs[key]) };
}

function makeBatch({ id = "b1", attrs = {} } = {}) {
  return { id, get: vi.fn((key) => attrs[key]) };
}

// ---------- getKeys ----------

describe("getKeys", () => {
  test("returns unique keys across all scopes", () => {
    const player = makePlayer({
      attrs: { a: 1, b: 2, c: 3 },
      keyScopes: [
        ["a", "b"],
        ["b", "c"], // `b` appears twice but should be deduped
      ],
    });
    expect(getKeys(player).sort()).toEqual(["a", "b", "c"]);
  });

  test("returns an empty array when no scopes are present", () => {
    const player = makePlayer({ attrs: {}, keyScopes: [] });
    expect(getKeys(player)).toEqual([]);
  });
});

// ---------- filterByKey ----------

describe("filterByKey", () => {
  test("returns player values for matching keys", () => {
    const player = makePlayer({
      attrs: {
        prompt_a: { value: "A" },
        prompt_b: { value: "B" },
        survey_x: { value: "ignore" },
      },
    });
    const game = makeGame();
    expect(filterByKey(player, game, (k) => k.startsWith("prompt_"))).toEqual({
      prompt_a: { value: "A" },
      prompt_b: { value: "B" },
    });
  });

  test("falls through to rounds when player value is missing", () => {
    const player = makePlayer({
      attrs: { shared_x: undefined }, // registered but empty
    });
    const round = makeRound({ shared_x: { fromRound: true } });
    const game = makeGame({ rounds: [round] });
    expect(filterByKey(player, game, (k) => k.startsWith("shared_"))).toEqual({
      shared_x: { fromRound: true },
    });
  });

  test("falls through to game when player and rounds are both empty", () => {
    const player = makePlayer({ attrs: { shared_x: undefined } });
    const game = makeGame({
      rounds: [makeRound({ shared_x: undefined })],
      attrs: { shared_x: { fromGame: true } },
    });
    expect(filterByKey(player, game, (k) => k.startsWith("shared_"))).toEqual({
      shared_x: { fromGame: true },
    });
  });

  test("skips keys that have no value anywhere", () => {
    const player = makePlayer({ attrs: { lost: undefined } });
    const game = makeGame();
    expect(filterByKey(player, game, () => true)).toEqual({});
  });

  test("handles a missing game gracefully", () => {
    const player = makePlayer({
      attrs: { prompt_a: { value: 1 } },
    });
    expect(filterByKey(player, null, (k) => k.startsWith("prompt_"))).toEqual({
      prompt_a: { value: 1 },
    });
  });

  test("respects the filter predicate", () => {
    const player = makePlayer({
      attrs: { prompt_a: 1, survey_b: 2, audio_c: 3, video_d: 4 },
    });
    expect(
      Object.keys(
        filterByKey(
          player,
          null,
          (k) => k.startsWith("audio_") || k.startsWith("video_"),
        ),
      ).sort(),
    ).toEqual(["audio_c", "video_d"]);
  });
});

// ---------- collectStageAggregates ----------

describe("collectStageAggregates", () => {
  test("collects speakerEvents per stage name", () => {
    const game = makeGame({
      stages: [
        makeStage({ name: "intro", speakerEvents: ["i1"] }),
        makeStage({ name: "main", speakerEvents: ["m1", "m2"] }),
      ],
    });
    expect(collectStageAggregates(game)).toEqual({
      speakerEvents: { intro: ["i1"], main: ["m1", "m2"] },
      chatActions: {},
    });
  });

  test("only includes chatActions for stages that have chat", () => {
    const game = makeGame({
      stages: [
        makeStage({ name: "intro" }),
        makeStage({ name: "main", chat: [{ type: "send" }] }),
      ],
    });
    const result = collectStageAggregates(game);
    expect(result.chatActions).toEqual({ main: [{ type: "send" }] });
    expect(result.chatActions).not.toHaveProperty("intro");
  });

  test("returns empty aggregates when game is missing", () => {
    expect(collectStageAggregates(undefined)).toEqual({
      speakerEvents: {},
      chatActions: {},
    });
  });
});

// computeKnockdownDetails + condenseBatchConfig tests moved to
// ../utils/batchConfig.test.js alongside the helpers.
// collectExportErrors tests moved to ../utils/exportErrors.test.js.

// ---------- buildPlayerData (the JSONL contract) ----------

describe("buildPlayerData", () => {
  // A fairly complete fixture so every top-level field is exercised.
  const fullFixture = () => {
    const player = makePlayer({
      id: "p1",
      attrs: {
        // identity
        participantData: { deliberationId: "delib-1" },
        sampleId: "sample-1",
        browserInfo: { userAgent: "ua" },
        connectionInfo: { country: "US" },
        batchId: "b1",
        gameId: "g1",
        treatment: "t1",
        position: "0",
        consent: { granted: true },
        introSequence: { name: "intro_a" },
        setupSteps: [{ step: "audio", event: "passed" }],
        // timing
        timeArrived: 1,
        timeEnteredCountdown: 2,
        timeIntroDone: 3,
        timeComplete: 4,
        // recordings
        dailyIds: ["d1"],
        dailyIdHistory: [{ id: "d1", at: 1 }],
        // state written by stagebook elements (migration-sensitive)
        prompt_q1: { value: "yes", step: "game_0_s1", stageTimeElapsed: 10 },
        survey_s1: { responses: { a: 1 }, step: "intro_0_s1" },
        qualtrics_q1: { step: "game_0_s2", surveyId: "SV_1" },
        submitButton_b1: { step: "intro_1_step", stageTimeElapsed: 5 },
        duration_consent: { time: 12 },
        trackedLink_t1: { events: [{ type: "click" }] },
        audio_a1: { events: [{ type: "play" }], step: "game_0_s1" },
        video_v1: {
          events: [{ type: "autoplaySucceeded" }],
          step: "game_3_v",
        },
        // post-experiment
        QCSurvey: { adequate: "yes" },
        exitStatus: "complete",
        connectionHistory: [{ ts: 1, event: "connected" }],
        reports: [{ code: "onlyOne", stage: "game_0" }],
        checkIns: [{ stage: "game_0", timestamp: 3 }],
        cumulativeSpeakingTime: 42,
      },
    });
    const batch = makeBatch({
      id: "b1",
      attrs: {
        timeInitialized: 0,
        scienceDataFilename: "/tmp/out.jsonl",
        assetsRepoSha: "abcdef0123456789abcdef0123456789abcdef01",
        validatedConfig: {
          name: "batch",
          knockdowns: [0.5, 0.6],
          extraField: "kept",
        },
      },
    });
    const game = makeGame({
      id: "g1",
      attrs: {
        timeGameStarted: 10,
        timeGameEnded: 20,
        recordingsFolder: "/recs",
        dailyRoomName: "room1",
        recordingsPath: "s3://recs/",
      },
      stages: [
        makeStage({
          name: "game_0_discussion",
          speakerEvents: [{ playerId: "p1", duration: 3 }],
          chat: [{ type: "send", text: "hi" }],
        }),
        makeStage({
          name: "game_1_exit",
          speakerEvents: [],
        }),
      ],
    });
    return { player, batch, game };
  };

  test("produces the full playerData shape with all fields populated", () => {
    const { player, batch, game } = fullFixture();
    const data = buildPlayerData({
      player,
      batch,
      game,
      containerTag: "v1.2.3",
    });

    // Top-level identity + timing
    expect(data.containerTag).toBe("v1.2.3");
    expect(data.deliberationId).toBe("delib-1");
    expect(data.sampleId).toBe("sample-1");
    expect(data.batchId).toBe("b1");
    expect(data.gameId).toBe("g1");
    expect(data.treatment).toBe("t1");
    expect(data.position).toBe("0");

    // All stagebook-saved prefixes are surfaced as maps from key→value
    expect(data.prompts).toHaveProperty("prompt_q1");
    expect(data.surveys).toHaveProperty("survey_s1");
    expect(data.qualtrics).toHaveProperty("qualtrics_q1");
    expect(data.stageSubmissions).toHaveProperty("submitButton_b1");
    expect(data.stageDurations).toHaveProperty("duration_consent");
    expect(data.trackedLinks).toHaveProperty("trackedLink_t1");
    expect(data.audioEvents).toHaveProperty("audio_a1");
    expect(data.videoEvents).toHaveProperty("video_v1");

    // Aggregates from stages
    expect(data.speakerEvents).toMatchObject({
      game_0_discussion: [{ playerId: "p1", duration: 3 }],
      game_1_exit: [],
    });
    expect(data.chatActions).toEqual({
      game_0_discussion: [{ type: "send", text: "hi" }],
    });

    // Condensed config keeps extras, strips raw knockdowns
    expect(data.config.extraField).toBe("kept");
    expect(data.config.knockdowns).toBeUndefined();
    expect(data.config.knockdownDetails).toMatchObject({ shape: [2] });

    // Assets repo sha is stamped from batch.assetsRepoSha
    expect(data.assetsRepoSha).toBe("abcdef0123456789abcdef0123456789abcdef01");

    // Times block
    expect(data.times).toEqual({
      batchInitialized: 0,
      playerArrived: 1,
      playerEnteredCountdown: 2,
      playerIntroDone: 3,
      gameStarted: 10,
      gameEnded: 20,
      playerComplete: 4,
    });
  });

  test("substitutes 'missing' for every absent scalar field", () => {
    const player = makePlayer({
      attrs: { participantData: {} }, // only the one field buildPlayerData requires
    });
    const batch = makeBatch({ attrs: {} });
    const game = makeGame({ attrs: {}, stages: [] });
    const data = buildPlayerData({ player, batch, game });

    expect(data.containerTag).toBe("missing");
    expect(data.sampleId).toBe("missing");
    expect(data.browserInfo).toBe("missing");
    expect(data.connectionInfo).toBe("missing");
    expect(data.treatment).toBe("missing");
    expect(data.position).toBe("missing");
    expect(data.consent).toBe("missing");
    expect(data.recordingsFolder).toBe("missing");
    expect(data.QCSurvey).toBe("missing");
    expect(data.exitStatus).toBe("missing");
    expect(data.cumulativeSpeakingTime).toBe("missing");
    expect(data.assetsRepoSha).toBe("missing");
  });

  test("defaults collection fields to empty structures", () => {
    const player = makePlayer({ attrs: { participantData: {} } });
    const batch = makeBatch({ attrs: {} });
    const game = makeGame({ attrs: {}, stages: [] });
    const data = buildPlayerData({ player, batch, game });

    expect(data.prompts).toEqual({});
    expect(data.surveys).toEqual({});
    expect(data.qualtrics).toEqual({});
    expect(data.stageSubmissions).toEqual({});
    expect(data.stageDurations).toEqual({});
    expect(data.trackedLinks).toEqual({});
    expect(data.audioEvents).toEqual({});
    expect(data.videoEvents).toEqual({});
    expect(data.reports).toEqual([]);
    expect(data.checkIns).toEqual([]);
    expect(data.speakerEvents).toEqual({});
    expect(data.chatActions).toEqual({});
  });

  test("includes exportErrors verbatim", () => {
    const player = makePlayer({ attrs: { participantData: {} } });
    const batch = makeBatch({ attrs: {} });
    const game = makeGame({ attrs: {}, stages: [] });
    const data = buildPlayerData({
      player,
      batch,
      game,
      exportErrors: ["batch-id mismatch", "other"],
    });
    expect(data.exportErrors).toEqual(["batch-id mismatch", "other"]);
  });

  test("exportErrors defaults to [] when not provided", () => {
    const player = makePlayer({ attrs: { participantData: {} } });
    const batch = makeBatch({ attrs: {} });
    const game = makeGame({ attrs: {}, stages: [] });
    expect(buildPlayerData({ player, batch, game }).exportErrors).toEqual([]);
  });

  test("serializes losslessly through JSON.stringify", () => {
    const { player, batch, game } = fullFixture();
    const data = buildPlayerData({
      player,
      batch,
      game,
      containerTag: "v1",
    });
    // The JSONL contract relies on stringify not throwing and round-tripping.
    const json = JSON.stringify(data);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.batchId).toBe("b1");
    expect(parsed.prompts.prompt_q1).toMatchObject({ value: "yes" });
  });

  test("records stagebook-added metadata on prompt/survey/etc entries", () => {
    // The stagebook migration added `step` and `stageTimeElapsed` to every
    // saved object via wrappedSave. Verify the export carries those through
    // so downstream analysis code keeps working.
    const { player, batch, game } = fullFixture();
    const data = buildPlayerData({
      player,
      batch,
      game,
      containerTag: "v1",
    });
    expect(data.prompts.prompt_q1).toMatchObject({
      value: "yes",
      step: "game_0_s1",
      stageTimeElapsed: 10,
    });
    expect(data.stageSubmissions.submitButton_b1).toMatchObject({
      step: "intro_1_step",
      stageTimeElapsed: 5,
    });
  });
});

// ---------- validateDailyIdHistory ----------

describe("validateDailyIdHistory", () => {
  const treatmentWithVideoStages = (count) => ({
    gameStages: Array.from({ length: count }, (_, i) => ({
      name: `stage${i}`,
      discussion: { chatType: "video" },
    })),
  });

  test("returns null when dropout (exitStatus !== complete)", () => {
    const player = makePlayer({
      attrs: { exitStatus: "dropout", dailyIdHistory: [] },
    });
    const game = makeGame({
      attrs: { treatment: treatmentWithVideoStages(3) },
    });
    expect(validateDailyIdHistory({ player, game })).toBeNull();
  });

  test("returns null when no video stages in treatment", () => {
    const player = makePlayer({
      attrs: { exitStatus: "complete", dailyIdHistory: [] },
    });
    const game = makeGame({
      attrs: {
        treatment: {
          gameStages: [{ name: "s1", discussion: { chatType: "text" } }],
        },
      },
    });
    expect(validateDailyIdHistory({ player, game })).toBeNull();
  });

  test("returns null when entries match video-stage count", () => {
    const player = makePlayer({
      attrs: {
        exitStatus: "complete",
        dailyIdHistory: [
          { dailyId: "a", progressLabel: "game_1_s1" },
          { dailyId: "b", progressLabel: "game_2_s2" },
          { dailyId: "c", progressLabel: "game_3_s3" },
        ],
      },
    });
    const game = makeGame({
      attrs: { treatment: treatmentWithVideoStages(3) },
    });
    expect(validateDailyIdHistory({ player, game })).toBeNull();
  });

  test("returns null when entries exceed minimum (reconnects are fine)", () => {
    const player = makePlayer({
      attrs: {
        exitStatus: "complete",
        dailyIdHistory: Array.from({ length: 5 }, () => ({})),
      },
    });
    const game = makeGame({
      attrs: { treatment: treatmentWithVideoStages(3) },
    });
    expect(validateDailyIdHistory({ player, game })).toBeNull();
  });

  test("returns a report when completed player is short on entries (the bug)", () => {
    const player = makePlayer({
      id: "p0",
      attrs: {
        exitStatus: "complete",
        dailyIdHistory: [
          { dailyId: "a", progressLabel: "game_4_storytelling_1" },
        ],
      },
    });
    const game = makeGame({
      attrs: { treatment: treatmentWithVideoStages(3) },
    });
    game.id = "g1";
    expect(validateDailyIdHistory({ player, game })).toEqual({
      playerId: "p0",
      gameId: "g1",
      expectedMin: 3,
      actual: 1,
      loggedStages: ["game_4_storytelling_1"],
    });
  });

  test("handles missing dailyIdHistory gracefully", () => {
    const player = makePlayer({ attrs: { exitStatus: "complete" } });
    const game = makeGame({
      attrs: { treatment: treatmentWithVideoStages(2) },
    });
    const report = validateDailyIdHistory({ player, game });
    expect(report).toMatchObject({
      expectedMin: 2,
      actual: 0,
      loggedStages: [],
    });
  });

  test("handles dailyIdHistory as string (legacy 'missing' sentinel)", () => {
    const player = makePlayer({
      attrs: { exitStatus: "complete", dailyIdHistory: "missing" },
    });
    const game = makeGame({
      attrs: { treatment: treatmentWithVideoStages(2) },
    });
    const report = validateDailyIdHistory({ player, game });
    expect(report).toMatchObject({
      expectedMin: 2,
      actual: 0,
      loggedStages: [],
    });
  });

  test("handles missing treatment gracefully", () => {
    const player = makePlayer({
      attrs: { exitStatus: "complete", dailyIdHistory: [] },
    });
    const game = makeGame({});
    expect(validateDailyIdHistory({ player, game })).toBeNull();
  });
});
