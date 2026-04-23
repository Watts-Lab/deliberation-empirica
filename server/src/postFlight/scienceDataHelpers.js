/**
 * Pure helpers that back exportScienceData.
 *
 * These are extracted so we can unit-test the JSONL contract (which
 * researchers rely on) without mocking the filesystem or GitHub client.
 * The orchestrator in exportScienceData.js imports and wires them up.
 *
 * Player/game fixtures in tests follow Empirica's shape:
 *   - `.get(key)` returns the stored value (or undefined)
 *   - `.attributes.attrs` is a Map of scope→Map(key→attribute) used to
 *     enumerate every key ever written under any scope
 */

/* eslint-disable no-continue, no-restricted-syntax */
import { error } from "@empirica/core/console";
import { condenseBatchConfig } from "../utils/batchConfig";

// Collect every unique key ever written under any scope on the player.
// This is how we discover keys like `prompt_foo` / `survey_bar` without
// having to know them upfront.
export function getKeys(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const keys = scopes.map((item) => Array.from(item.keys())).flat();
  return [...new Set(keys)];
}

// Filter player/game keys by predicate, returning a { key: value } object.
// Lookup order: player.get → each round.get → game.get. First hit wins.
// This lets stages write under either scope and have the data surface.
export function filterByKey(player, game, filter) {
  const filteredKeys = getKeys(player).filter(filter);
  const entries = [];
  for (const key of filteredKeys) {
    let found = false;

    try {
      const value = player.get(key);
      if (value) {
        entries.push([key, value]);
        found = true;
      }
    } catch (err) {
      error(`Error getting key from player: ${key}`, err);
    }
    if (found) continue;

    if (!game) continue;

    try {
      let roundHit = false;
      for (const round of game.rounds || []) {
        const roundValue = round.get(key);
        if (roundValue) {
          entries.push([key, roundValue]);
          roundHit = true;
        }
      }
      if (roundHit) continue;
    } catch (err) {
      error(`Error getting key from rounds: ${key}`, err);
    }

    try {
      const value = game.get(key);
      if (value) {
        entries.push([key, value]);
      }
    } catch (err) {
      error(`Error getting key from game: ${key}`, err);
    }
  }
  return Object.fromEntries(entries);
}

// Collect per-stage speakerEvents and chat actions from a game's stages.
// Returns { speakerEvents, chatActions }; values default to whatever
// `stage.get()` returns so missing-state behaves like the original code.
export function collectStageAggregates(game) {
  const speakerEvents = {};
  const chatActions = {};
  game?.stages?.forEach((stage) => {
    speakerEvents[stage.get("name")] = stage.get("speakerEvents");
    const newChat = stage.get("chat");
    if (newChat) {
      chatActions[stage.get("name")] = newChat;
    }
  });
  return { speakerEvents, chatActions };
}

// Validate that a completed player has one dailyIdHistory entry per video
// stage they went through. Returns null when everything looks right, or a
// structured report object when there's a mismatch — intended to be fed
// into Sentry.captureMessage by the orchestrator. Pure: no Sentry import
// so this file stays testable without initializing Sentry.
//
// Expected invariant: each stage with `discussion.chatType === "video"` in
// the treatment's gameStages should append one entry to the player's
// dailyIdHistory (driven by useDailyIdTracking on each Daily join). A
// shortfall on a COMPLETED player means we lost the stage→dailyId mapping
// and the video-composition pipeline won't be able to match recordings to
// stages — the exact failure mode that affected 156 participants before
// the coherence gate was added.
//
// Dropouts are excluded: `exitStatus !== "complete"` players are expected
// to be short of entries.
export function validateDailyIdHistory({ player, game }) {
  if (player?.get("exitStatus") !== "complete") return null;
  const treatment = game?.get("treatment");
  const gameStages = Array.isArray(treatment?.gameStages) ? treatment.gameStages : [];
  const expectedMin = gameStages.filter(
    (s) => s?.discussion?.chatType === "video"
  ).length;
  if (expectedMin === 0) return null;
  const history = player?.get("dailyIdHistory") || [];
  const actual = Array.isArray(history) ? history.length : 0;
  if (actual >= expectedMin) return null;
  return {
    playerId: player?.id,
    gameId: game?.id,
    expectedMin,
    actual,
    loggedStages: Array.isArray(history)
      ? history.map((h) => h?.progressLabel ?? null)
      : [],
  };
}


// Build the serializable player-data object that exportScienceData writes
// as a JSONL line. Every scalar defaults to "missing" so researchers can
// distinguish absent values from explicit nulls. Collections default to
// empty structures.
export function buildPlayerData({
  player,
  batch,
  game,
  containerTag,
  exportErrors = [],
}) {
  const batchId = batch?.id;
  const gameId = game?.id;
  const participantData = player?.get("participantData") || {};
  const { speakerEvents, chatActions } = collectStageAggregates(game);

  return {
    containerTag: containerTag ?? "missing",
    deliberationId: participantData.deliberationId,
    sampleId: player?.get("sampleId") ?? "missing",
    browserInfo: player?.get("browserInfo") ?? "missing",
    connectionInfo: player?.get("connectionInfo") ?? "missing",
    batchId,
    // Pin the state of deliberation-assets at batch init; `git show <sha>:<path>`
    // recovers what a participant actually saw (issue #10).
    assetsRepoSha: batch?.get("assetsRepoSha") ?? "missing",
    config: condenseBatchConfig(batch?.get("validatedConfig")),
    trackedLinks: filterByKey(player, game, (k) => k.startsWith("trackedLink_")),
    times: {
      batchInitialized: batch?.get("timeInitialized") ?? "missing",
      playerArrived: player?.get("timeArrived") ?? "missing",
      playerEnteredCountdown: player?.get("timeEnteredCountdown") ?? "missing",
      playerIntroDone: player?.get("timeIntroDone") ?? "missing",
      gameStarted: game?.get("timeGameStarted") ?? "missing",
      gameEnded: game?.get("timeGameEnded") ?? "missing",
      playerComplete: player?.get("timeComplete") ?? "missing",
    },
    consent: player?.get("consent") ?? "missing",
    introSequence: player?.get("introSequence") || "missing",
    setupSteps: player?.get("setupSteps") || "missing",
    gameId,
    treatment: player?.get("treatment") ?? "missing",
    position: player?.get("position") ?? "missing",
    recordingsFolder: game?.get("recordingsFolder") ?? "missing",
    recordingRoomName: game?.get("dailyRoomName") ?? "missing",
    recordingsPath: game?.get("recordingsPath") ?? "missing",
    recordingIds: player?.get("dailyIds") ?? "missing",
    dailyIdHistory: player?.get("dailyIdHistory") ?? "missing",
    surveys: filterByKey(player, game, (k) => k.startsWith("survey_")),
    prompts: filterByKey(player, game, (k) => k.startsWith("prompt_")),
    qualtrics: filterByKey(player, game, (k) => k.startsWith("qualtrics_")),
    stageSubmissions: filterByKey(player, game, (k) =>
      k.startsWith("submitButton_")
    ),
    stageDurations: filterByKey(player, game, (k) => k.startsWith("duration_")),
    audioEvents: filterByKey(player, game, (k) => k.startsWith("audio_")),
    videoEvents: filterByKey(player, game, (k) => k.startsWith("video_")),
    QCSurvey: player?.get("QCSurvey") ?? "missing",
    exitStatus: player?.get("exitStatus") ?? "missing",
    connectionHistory: player?.get("connectionHistory") ?? "missing",
    speakerEvents,
    reports: player?.get("reports") ?? [],
    checkIns: player?.get("checkIns") ?? [],
    chatActions,
    cumulativeSpeakingTime: player?.get("cumulativeSpeakingTime") ?? "missing",
    exportErrors,
  };
}

