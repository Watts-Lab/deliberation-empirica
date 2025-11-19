/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
import * as fs from "fs";
import { error, info } from "@empirica/core/console";
import { pushDataToGithub } from "../providers/github";

function getKeys(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const keys = scopes.map((item) => Array.from(item.keys())).flat();
  const setKeys = new Set(keys); // get unique keys;
  return [...setKeys];
}

function filterByKey(player, game, filter) {
  const allKeys = getKeys(player);
  const filteredKeys = allKeys.filter(filter);
  const entries = [];
  for (const key of filteredKeys) {
    try {
      // get from the player object
      const value = player.get(key);
      if (value) {
        entries.push([key, value]);
        continue;
      }
    } catch (err) {
      error(`Error getting key from player: ${key}`, err);
    }

    if (!game) {
      // warn(
      //   `No value found for key: ${key} on the player object, and no game. Cannot save this data point.`
      // );
      continue;
    }

    try {
      // get from rounds
      let found = false;
      for (const round of game.rounds) {
        const roundValue = round.get(key);
        // console.log("key", key, "roundValue", roundValue);
        if (roundValue) {
          entries.push([key, roundValue]);
          found = true;
        }
      }
      if (found) {
        continue;
      }
    } catch (err) {
      error(`Error getting key from rounds: ${key}`, err);
    }

    try {
      // get from game object
      const value = game.get(key);
      if (value) {
        entries.push([key, value]);
        continue;
      }
    } catch (err) {
      error(`Error getting key from game: ${key}`, err);
    }

    // warn(
    //   `No value found for key: ${key} in either game or player. Cannot save this data point.`
    // );
  }
  return Object.fromEntries(entries);
}

export async function exportScienceData({ player, batch, game }) {
  try {
    const batchId = batch?.id;
    const gameId = game?.id;
    const exportErrors = [];

    if (batchId !== player?.get("batchId")) {
      const errString = `Batch ID: ${batchId} does not match player assigned batch: ${player?.get(
        "batchId"
      )}`;
      error(errString);
      exportErrors.push(errString);
    }

    if (gameId !== player?.get("gameId")) {
      const errString = `Game ID ${gameId} does not match player assigned game ${player?.get(
        "gameId"
      )}`;
      error(errString);
      exportErrors.push(errString);
    }

    const outFileName = batch.get("scienceDataFilename");
    const participantData = player?.get("participantData");

    // some intro surveys might go into the player record for future use?
    const surveys = filterByKey(player, game, (key) =>
      key.startsWith("survey_")
    );
    const prompts = filterByKey(player, game, (key) =>
      key.startsWith("prompt_")
    );
    const qualtrics = filterByKey(player, game, (key) =>
      key.startsWith("qualtrics_")
    );
    const stageSubmissions = filterByKey(player, game, (key) =>
      key.startsWith("submitButton_")
    );
    const stageDurations = filterByKey(player, game, (key) =>
      key.startsWith("duration_")
    );
    const trackedLinks = filterByKey(player, game, (key) =>
      key.startsWith("trackedLink_")
    ); // includes click + time-away metrics captured by the tracked link element

    // get all speaker events
    const speakerEvents = {};
    const chatActions = {};
    game?.stages?.forEach((stage) => {
      speakerEvents[stage.get("name")] = stage.get("speakerEvents");
      // Get chat actions
      const newChat = stage.get("chat");
      if (newChat) {
        chatActions[stage.get("name")] = newChat;
      }
    });

    // Take the excess out of the batch config
    const batchConfig = batch?.get("validatedConfig");
    const condensedBatchConfig = batchConfig
      ? JSON.parse(JSON.stringify(batchConfig))
      : "missing";

    if (
      condensedBatchConfig !== "missing" &&
      condensedBatchConfig.knockdowns !== "none"
    ) {
      const input = condensedBatchConfig.knockdowns;
      let shape;
      if (typeof input === "number") {
        shape = [1]; // Single number has "shape" of [1]
      } else if (Array.isArray(input) && Array.isArray(input[0])) {
        shape = [input.length, input[0].length]; // 2D array shape
      } else {
        shape = [input.length]; // 1D array shape
      }

      let flatArray;
      if (typeof input === "number") {
        // Convert a single number to a single-element array
        flatArray = [input];
      } else if (Array.isArray(input)) {
        // Flatten the input if it's a nested array
        flatArray = input.flat(Infinity); // Flatten to a 1D array
      } else {
        const errString = `Knockdowns must be a number or an array, but got ${typeof input}`;
        error(errString);
      }
      const sum = flatArray.reduce((acc, val) => acc + val, 0);
      const std = Math.sqrt(
        flatArray.reduce((acc, val) => acc + (val - sum) ** 2, 0) /
          flatArray.length
      );
      const max = Math.max(...flatArray);
      const min = Math.min(...flatArray);

      condensedBatchConfig.knockdownDetails = {
        shape,
        sum,
        std,
        max,
        min,
      };
      condensedBatchConfig.knockdowns = undefined;
    }

    /* 
    To add:
    - dispatches participated in
    - audio mute history
    - video mute history
    - recruitment information (what service, what qualifications, size, timing, etc.)
    - stage timings
    */
    const playerData = {
      containerTag: process.env.CONTAINER_IMAGE_VERSION_TAG ?? "missing",
      deliberationId: participantData.deliberationId,
      sampleId: player?.get("sampleId") ?? "missing",
      browserInfo: player?.get("browserInfo") ?? "missing",
      connectionInfo: player?.get("connectionInfo") ?? "missing",
      batchId,
      config: condensedBatchConfig,
      trackedLinks, // exported so researchers can analyze external-task compliance
      times: {
        batchInitialized: batch?.get("timeInitialized") ?? "missing",
        playerArrived: player?.get("timeArrived") ?? "missing",
        playerEnteredCountdown:
          player?.get("timeEnteredCountdown") ?? "missing",
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
      surveys,
      prompts,
      qualtrics,
      stageSubmissions,
      stageDurations,
      QCSurvey: player?.get("QCSurvey") ?? "missing",
      exitStatus: player?.get("exitStatus") ?? "missing",
      connectionHistory: player?.get("connectionHistory") ?? "missing",
      speakerEvents,
      reports: player?.get("reports") ?? [],
      checkIns: player?.get("checkIns") ?? [],
      chatActions,
      cumulativeSpeakingTime: player.get("cumulativeSpeakingTime") ?? "missing",
      exportErrors,
    };

    fs.appendFileSync(outFileName, `${JSON.stringify(playerData)}\n`, (err) => {
      if (err) {
        error(
          `Failed to write science data for player ${player.id} to ${outFileName}`,
          err
        );
      } else {
        info(`Writing science data for player ${player.id} to ${outFileName}`);
      }
    });
    await pushDataToGithub({ batch });
  } catch (err) {
    error("Uncaught exception in exportScienceData.js :", err);
  }
}
