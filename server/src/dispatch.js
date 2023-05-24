/*
prototyping a dispatcher algorithm. This is a terrible one.
*/

import { isArrayOfStrings } from "./utils";

function shuffle(arr) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled;
}

function getReadyPlayers(players) {
  const playersReady = []; // ready to be assigned to a game
  const playersWaiting = []; // still in intro steps
  const playersAssigned = []; // assigned to games

  players.forEach((player) => {
    if (!player.get("connected")) return;

    if (player.get("gameId") || player.get("assigned")) {
      playersAssigned.push(player.id);
      return;
    }

    if (player.get("introDone")) {
      playersReady.push(player.id);
      return;
    }

    playersWaiting.push(player.id);
  });

  return { playersReady, playersWaiting, playersAssigned };
}

// TODO: add fallback treatments or treatment priorities
export function makeDispatcher({ treatments }) {
  if (treatments.length === 0) {
    throw new Error(
      `Tried to create dispatcher with no treatments, recieved treatments object: ${JSON.stringify(
        treatments
      )}`
    );
  }

  console.log(
    `Creating dispatch with treatments: ${treatments
      .map((t) => t.name)
      .join(", ")}`
  );
  const treatmentQueue = shuffle(treatments);

  const dispatcher = ({ players }) => {
    // we catch any errors from this function in the callbacks/runDispatch function,
    // where we can handle retries with the right timers and information.

    // Todo: does this function want to track participants who have participated in
    // more than one dispatch, so we can prioritize assigning them to groups?
    // It is in theory possible for a player to be at the end of the queue and unassigned
    // by multiple dispatch cycles, which could lead to attrition.

    const { playersReady, playersWaiting, playersAssigned } =
      getReadyPlayers(players);

    if (!isArrayOfStrings(playersReady)) {
      throw new Error(
        "Invalid type in playersReady, expected list of strings, got:",
        playersReady
      );
    }
    // Todo: check the others (if we use them)

    const dispatchList = [];
    let treatment;
    let playerIds;
    let playersNeeded;
    const shuffledReady = shuffle(playersReady);

    console.log(
      `dispatch: ${playersReady.length} ready, ${playersAssigned.length} assigned, ${playersWaiting.length} waiting`
    );

    while (shuffledReady) {
      playersNeeded = treatmentQueue[0].playerCount;
      if (shuffledReady.length < playersNeeded) {
        break;
      }

      if (treatmentQueue.length < 2) {
        // add to queue to make sure it always has items
        treatmentQueue.push(...shuffle(treatments));
      }

      treatment = treatmentQueue.shift(); // pop from the front
      playerIds = shuffledReady.splice(0, playersNeeded);
      playersAssigned.push(...playerIds);

      dispatchList.push({ treatment, playerIds });
    }

    if (dispatchList.length === 0) {
      console.log(`Need ${playersNeeded} players ready`);
    }
    return dispatchList;
  };

  return dispatcher;
}
