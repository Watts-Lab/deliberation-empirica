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

// Compute summary statistics for a knockdowns value (number, 1D or 2D array)
// so the exported config stays compact. Returns null when the input can't be
// interpreted as numbers — callers decide what to do with that.
export function computeKnockdownDetails(input) {
  let shape;
  let flatArray;
  if (typeof input === "number") {
    shape = [1];
    flatArray = [input];
  } else if (Array.isArray(input) && Array.isArray(input[0])) {
    shape = [input.length, input[0].length];
    flatArray = input.flat(Infinity);
  } else if (Array.isArray(input)) {
    shape = [input.length];
    flatArray = input.flat(Infinity);
  } else {
    return null;
  }
  const sum = flatArray.reduce((acc, val) => acc + val, 0);
  const std = Math.sqrt(
    flatArray.reduce((acc, val) => acc + (val - sum) ** 2, 0) /
      flatArray.length
  );
  const max = Math.max(...flatArray);
  const min = Math.min(...flatArray);
  return { shape, sum, std, max, min };
}

// Produce a copy of the batch's validated config with the knockdown matrix
// replaced by summary stats. Matches the shape the science-data export has
// shipped since before the stagebook migration.
export function condenseBatchConfig(batchConfig) {
  if (!batchConfig) return "missing";
  const condensed = JSON.parse(JSON.stringify(batchConfig));
  if (condensed.knockdowns !== "none") {
    const details = computeKnockdownDetails(condensed.knockdowns);
    if (details) {
      condensed.knockdownDetails = details;
      condensed.knockdowns = undefined;
    }
  }
  return condensed;
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

