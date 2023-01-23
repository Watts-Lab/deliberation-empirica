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
  const keys = getKeys(player);
  const entries = keys.filter(filter).map((key) => [key, player.get(key)]);
  return Object.fromEntries(entries);
}

export function exportPlayerData({ player }) {
  // some intro surveys might go into the player record for future use?

  const surveys = filterByKey(player, (key) => key.startsWith("survey_"));

  console.log("player Data", surveys);
}
