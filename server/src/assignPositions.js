export function assignPositions({ players, assignPositionsBy }) {
  // Assign positions
  let scores = [];
  if (assignPositionsBy === undefined || assignPositionsBy === "random") {
    scores = players.map(() => Math.random());
  }
  const positions = Array.from(Array(scores.length).keys()).sort(
    (a, b) => scores[a] - scores[b]
  );
  // console.log(`Scores: ${scores}, positions: ${positions}`);

  const identifiers = [];
  players.forEach((player, index) => {
    identifiers.push(player.id);
    player.set("position", positions[index]);
  });
  return identifiers;
}
