import { appendFile } from "fs";

const scienceDataDir = process.env.SCIENCE_DATA_DIR;
const participantDataDir = process.env.PARTICIPANT_DATA_DIR;

function getKeys(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const keys = scopes.map((item) => Array.from(item.keys())).flat();
  const setKeys = new Set(keys); // get unique keys;
  return [...setKeys];
}

function getEntries(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const entries = scopes.map((item) => Array.from(item.entries())).flat(1);
  return Object.fromEntries(entries);
}

function filterByKey(player, filter) {
  const allKeys = getKeys(player);
  const filteredKeys = allKeys.filter(filter);
  const entries = filteredKeys.map((key) => [key, player.get(key)]);
  return Object.fromEntries(entries);
}

export function exportPlayerData({ player, batch }) {
  const batchName = batch.get("config")?.config?.batchName || "unNamed";
  const batchId = batch.id;
  console.assert(
    batchId === player.get("batchId"),
    "Batch ID does not match player assigned batch"
  );
  const outFileName = `${scienceDataDir}/batch_${batchName}_${batchId}.jsonl`;

  // // some intro surveys might go into the player record for future use?
  const surveys = filterByKey(player, (key) => key.startsWith("survey_"));
  const prompts = filterByKey(player, (key) => key.startsWith("prompt_"));

  const playerData = {
    deliberationId: player.get("deliberationId"),
    config: batch.get("config"),
    gameId: player.get("gameId"),
    batchId,
    treatment: player.get("treatment"),
    exitStatus: player.get("exitStatus"),
    position: player.get("position"),
    recordingIds: player.get("dailyIds"),
    //recordingRoomName: game.get("dailyRoomName"),
    surveys,
    prompts,
    // player complete? player furthest stage reached? Stage timings?
  };

  appendFile(outFileName, `${JSON.stringify(playerData)}\n`, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Writing data for player ${player.id} to ${outFileName}`);
    }
  });

  console.log(`Writing data for player ${player.id} to ${outFileName}`);
}
