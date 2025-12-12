/**
 * Shared resolver for translating reference strings (`prompt.foo`, `survey.bar.result.score`, etc.)
 * into concrete values pulled from Empirica's player/game state.
 *
 * This sits outside of React hooks so it can be reused in both hook-based contexts
 * (e.g., useReferenceValues) and non-hook contexts (tracked links, future utilities).
 *
 * Testing: exercised indirectly through the omnibus Cypress test, which covers every
 * reference namespace. When updating the resolver, rerun `cypress/e2e/01_Normal_Paths_Omnibus`.
 */

const getNestedValueByPath = (obj, path = []) =>
  path.reduce((acc, key) => acc?.[key], obj);

// Break a `type.name.path.to.field` string into the storage key + nested path.
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
  } else if (["participantInfo", "discussion", "lobby", "dispatch"].includes(type)) {
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

// Decide where to pull the value from: current player, shared game object, another player, etc.
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
  // Consumers should always pass the current reference string; defensively guard to avoid crashes.
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
