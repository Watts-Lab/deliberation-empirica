/**
 * Shared resolver for translating reference strings (`prompt.foo`, `survey.bar.result.score`, etc.)
 * into concrete values pulled from Empirica's player/game state.
 *
 * Pure parsing logic (getReferenceKeyAndPath, getNestedValueByPath) is imported from
 * @deliberation-lab/score. This file keeps the Empirica-coupled source resolution local.
 *
 * Testing: exercised indirectly through the omnibus Cypress test, which covers every
 * reference namespace. When updating the resolver, rerun `cypress/e2e/01_Normal_Paths_Omnibus`.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { getReferenceKeyAndPath, getNestedValueByPath } from "@deliberation-lab/score";

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
