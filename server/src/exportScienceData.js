import * as fs from "fs";
import { pushDataToGithub } from "./github";

function getKeys(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const keys = scopes.map((item) => Array.from(item.keys())).flat();
  const setKeys = new Set(keys); // get unique keys;
  return [...setKeys];
}

function filterByKey(player, filter) {
  try {
    const allKeys = getKeys(player);
    const filteredKeys = allKeys.filter(filter);
    const entries = filteredKeys.map((key) => [key, player.get(key)]);
    return Object.fromEntries(entries);
  } catch (err) {
    console.log(
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
      console.error(errString);
      exportErrors.push(errString);
    }

    if (gameId !== player?.get("gameId")) {
      const errString = `Game ID ${gameId} does not match player assigned game ${player?.get(
        "gameId"
      )}`;
      console.error(errString);
      exportErrors.push(errString);
    }

    const outFileName = batch.get("scienceDataFilename");
    const participantData = player?.get("participantData");

    // some intro surveys might go into the player record for future use?
    const surveys = filterByKey(player, (key) => key.startsWith("survey_"));
    const prompts = filterByKey(player, (key) => key.startsWith("prompt_"));
    const qualtrics = filterByKey(player, (key) =>
      key.startsWith("qualtrics_")
    );

    // get all speaker events
    const speakerEvents = {};
    const textChats = {};
    game.stages.forEach((stage) => {
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
      deliberationId: participantData.deliberationId,
      sampleId: player?.get("sampleId"),
      batchId,
      config: batch?.get("config"),
      timeBatchInitialized: batch?.get("timeInitialized"),
      timeArrived: player?.get("timeArrived"),
      timeIntroSequenceDone: player?.get("timeIntroSequenceDone"),
      timeStarted: game?.get("timeStarted"),
      timeComplete: player?.get("timeComplete") || "Incomplete",
      consent: player?.get("consent"),
      introSequence: player?.get("introSequence"),
      gameId,
      treatment: player?.get("treatment"),
      position: player?.get("position"),
      recordingIds: player?.get("dailyIds"),
      recordingRoomName: game?.get("dailyRoomName"),
      surveys,
      prompts,
      qualtrics,
      etherpad,
      QCSurvey: player?.get("QCSurvey"),
      exitStatus: player?.get("exitStatus"),
      exportErrors,
      speakerEvents,
      textChats,
      cumulativeSpeakingTime: player.get("cumulativeSpeakingTime"),
    };

    fs.appendFileSync(outFileName, `${JSON.stringify(playerData)}\n`, (err) => {
      if (err) {
        console.log(
          `Failed to write science data for player ${player.id} to ${outFileName}`,
          err
        );
      } else {
        console.log(
          `Writing science data for player ${player.id} to ${outFileName}`
        );
      }
    });
    await pushDataToGithub({ batch });
  } catch (err) {
    console.log("Uncaught exception in exportScienceData.js :", err);
  }
}
