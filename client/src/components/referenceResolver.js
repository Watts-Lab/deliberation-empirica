const getNestedValueByPath = (obj, path = []) =>
  path.reduce((acc, key) => acc?.[key], obj);

function getReferenceKeyAndPath(reference) {
  const segments = reference.split(".");
  const [type, ...rest] = segments;
  let name;
  let path = [];
  let referenceKey;

  if (["survey", "submitButton", "qualtrics"].includes(type)) {
    [name, ...path] = rest;
    referenceKey = `${type}_${name}`;
  } else if (type === "prompt") {
    [name] = rest;
    referenceKey = `${type}_${name}`;
    path = ["value"];
  } else if (type === "trackedLink") {
    [name, ...path] = rest;
    referenceKey = `trackedLink_${name}`;
  } else if (["urlParams", "connectionInfo", "browserInfo"].includes(type)) {
    path = rest;
    referenceKey = type;
  } else if (["participantInfo", "discussion"].includes(type)) {
    [name, ...path] = rest;
    referenceKey = name;
  } else {
    throw new Error(`Invalid reference type: ${type}`);
  }

  if (!referenceKey) {
    throw new Error(`Reference ${reference} is missing a name segment.`);
  }

  return { referenceKey, path };
}

function getReferenceSources(position, { player, game, players }) {
  switch (position) {
    case "shared":
      return [game];
    case "player":
    case undefined:
      return [player];
    case "all":
    case "any":
    case "percentAgreement":
      return players || [];
    default: {
      const parsedPosition = Number.parseInt(position);
      if (Number.isNaN(parsedPosition)) {
        throw new Error(`Invalid position value: ${position}`);
      }
      return (players || []).filter(
        (p) => Number.parseInt(p.get("position")) === parsedPosition
      );
    }
  }
}

export function resolveReferenceValues({
  reference,
  position,
  player,
  game,
  players,
}) {
  if (!reference) return [];
  const { referenceKey, path } = getReferenceKeyAndPath(reference);
  const sources = getReferenceSources(position, { player, game, players });

  try {
    const referenceObjects = sources.map((source) =>
      source?.get ? source.get(referenceKey) : undefined
    );
    return referenceObjects.map((obj) => getNestedValueByPath(obj, path));
  } catch (error) {
    throw new Error(`Error getting reference value for ${reference}:`, error);
  }
}
