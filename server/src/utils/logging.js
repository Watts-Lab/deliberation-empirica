import { error, warn, info, log } from "@empirica/core/console";

export function logPlayerCounts(ctx) {
  try {
    const players = ctx.scopesByKind("player");

    let nPlayersInIntroSequence = 0;
    let nPlayersInCountdown = 0;
    let nPlayersInLobby = 0;
    let nPlayersDisconnected = 0;

    let nPlayersInGame = 0;
    let nPlayersInExitSequence = 0;
    let nPlayersCompleted = 0;

    players.forEach((player) => {
      if (player.get("exitStatus") === "complete") {
        nPlayersCompleted += 1;
      } else if (player.get("gameFinished") && player.get("connected")) {
        nPlayersInExitSequence += 1;
      } else if (
        (player.get("gameId") || player.get("assigned")) &&
        player.get("connected")
      ) {
        nPlayersInGame += 1;
      } else if (player.get("introDone") && player.get("connected")) {
        nPlayersInLobby += 1;
      } else if (player.get("inCountdown") && player.get("connected")) {
        nPlayersInCountdown += 1;
      } else if (player.get("connected")) {
        nPlayersInIntroSequence += 1;
      } else if (!player.get("connected")) {
        nPlayersDisconnected += 1;
      } else {
        error("Player in unexpected state:", player);
      }
    });

    info(
      `== ${nPlayersInIntroSequence} in intro steps, ${nPlayersInCountdown} in countdown, ${nPlayersInLobby} in lobby, ${nPlayersInGame} in games, ${nPlayersInExitSequence} in exit sequence, ${nPlayersCompleted} completed, ${nPlayersDisconnected} disconnected incomplete`
    );
  } catch (e) {
    error("Caught error in logPlayerCounts:", e);
  }
}
