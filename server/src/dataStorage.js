import { appendFile } from "fs";

const scienceDataDir = process.env.PARTICIPANT_DATA_DIR;
const participantDataDir = process.env.PARTICIPANT_DATA_DIR;

function getKeys(player) {
  const scopes = Array.from(player.attributes.attrs.values());
  const keys = scopes.map((item) => Array.from(item.keys())).flat();
  return keys;
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

export function exportPlayerData({ player }) {
  const outFileName = `${scienceDataDir}/batch_${player.get("batchId")}.jsonl`;

  // // some intro surveys might go into the player record for future use?
  const surveys = filterByKey(player, (key) => key.startsWith("survey_"));
  const prompts = filterByKey(player, (key) => key.startsWith("prompt_"));

  const playerData = {
    deliberationId: player.get("deliberationId"),
    gameId: player.get("gameId"),
    batchId: player.get("batchId"),
    surveys,
    prompts,
    position: player.get("position"),
  };
  //console.log("playerData", JSON.stringify(playerData));

  appendFile(outFileName, `${JSON.stringify(playerData)}\n`, (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log(`Writing data for player ${player.id} to ${outFileName}`);
    }
  });

  console.log(`Writing data for player ${player.id} to ${outFileName}`);
}
