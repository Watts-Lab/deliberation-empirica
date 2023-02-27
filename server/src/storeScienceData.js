import { appendFile } from "fs";

const scienceDataDir = process.env.SCIENCE_DATA_DIR;

function getKeys(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const keys = scopes.map((item) => Array.from(item.keys())).flat();
  const setKeys = new Set(keys); // get unique keys;
  return [...setKeys];
}

function filterByKey(player, filter) {
  const allKeys = getKeys(player);
  const filteredKeys = allKeys.filter(filter);
  const entries = filteredKeys.map((key) => [key, player.get(key)]);
  return Object.fromEntries(entries);
}

export function exportScienceData({ player, batch, game }) {
  const batchName = batch?.get("config")?.config?.batchName || "unnamedBatch";
  const batchId = batch?.id;
  const gameId = game?.id;
  const exportErrors = [];

  if (batchId !== player.get("batchId")) {
    console.error(
      `Batch ID: ${batchId} does not match player assigned batch: ${player.get(
        "batchId"
      )}`
    );
    exportErrors.push("Batch ID does not match assigned batch");
  }

  if (gameId !== player.get("gameId")) {
    console.error(
      `Game ID ${gameId} does not match player assigned game ${player.get(
        "gameId"
      )}`
    );
    exportErrors.push("Game ID does not match assigned game");
  }

  const outFileName = `${scienceDataDir}/batch_${batchName}_${batchId}.jsonl`;
  const participantData = player.get("participantData");

  // // some intro surveys might go into the player record for future use?
  const surveys = filterByKey(player, (key) => key.startsWith("survey_"));
  const prompts = filterByKey(player, (key) => key.startsWith("prompt_"));

  /* To add:
  - ready time (at countdown)
  - join experiment time
  - dispatches participated in
  - audio mute history
  - video mute history

  */
  const playerData = {
    deliberationId: participantData.deliberationId,
    batchId,
    config: batch?.get("config"),
    timeArrived: player.get("timeArrived"),
    consent: player.get("consent"),
    gameId,
    treatment: player.get("treatment"),
    position: player.get("position"),
    recordingIds: player.get("dailyIds"),
    recordingRoomName: game?.get("dailyRoomName"),
    surveys,
    prompts,
    exitStatus: player.get("exitStatus"),
    exportErrors,
    // player complete? player furthest stage reached? Stage timings?
  };
  // console.log("data", playerData);

  appendFile(outFileName, `${JSON.stringify(playerData)}\n`, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Writing data for player ${player.id} to ${outFileName}`);
    }
  });
}
