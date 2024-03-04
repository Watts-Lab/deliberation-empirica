// I think this can be deleted now

import { info } from "@empirica/core/console";

export function assignPositions({ players, assignPositionsBy, treatment }) {
  const { groupComposition } = treatment;

  // Assign positions
  let scores = [];
  if (assignPositionsBy === undefined || assignPositionsBy === "random") {
    scores = players.map(() => Math.random());
  }

  const positions = Array.from(Array(scores.length).keys()).sort(
    (a, b) => scores[a] - scores[b]
  );

  const identifiers = [];
  players.forEach((player, index) => {
    identifiers.push(player.id);
    const playerPosition = positions[index];
    player.set("position", playerPosition.toString()); // see Layouts position = parseInt(player.get("position"));

    const positionData = groupComposition?.filter(
      (pos) => pos?.position === playerPosition
    )[0];
    player.set("title", positionData?.title || "");

    info(
      `Player ${player.id} assigned position ${playerPosition} and title ${positionData?.title}`
    );
  });
  return identifiers;
}
