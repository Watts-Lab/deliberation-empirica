import * as fs from "fs";
import { error, warn, info } from "@empirica/core/console";
import { pushDataToGithub } from "../providers/github";

function getKeys(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const keys = scopes.map((item) => Array.from(item.keys())).flat();
  const setKeys = new Set(keys); // get unique keys;
  return [...setKeys];
}

function filterByKey(player, game, filter) {
  try {
    const allKeys = getKeys(player);
    const filteredKeys = allKeys.filter(filter);
    const entries = filteredKeys
      .map((key) => {
        const value = player.get(key);
        if (value) return [key, value];

        // eslint-disable-next-line no-restricted-syntax
        for (const round of game.rounds) {
          const roundValue = round.get(key);
          if (roundValue) {
            return [key, roundValue];
          }
        }

        const gameValue = game.get(key);
        if (gameValue) return [key, gameValue];

        warn(`No value found for key: ${key} Cannot save this data point.`);
        return undefined;
      })
      .filter((entry) => entry !== undefined);

    return Object.fromEntries(entries);
  } catch (err) {
    warn(
      `Failed to get attributes from player ${player.id} matching filter:`,
      filter?.toString()
    );
    return undefined;
  }
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

    // get all speaker events
    const speakerEvents = {};
    const textChats = {};
    game?.stages?.forEach((stage) => {
      speakerEvents[stage.get("name")] = stage.get("speakerEvents");
      textChats[stage.get("name")] = stage.get("textChat");
    });

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
      config: batch?.get("validatedConfig") ?? "missing",
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
      textChats,
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
