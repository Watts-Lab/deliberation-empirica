/*
prototyping a dispatcher algorithm. This is a terrible one.
*/

import { warn, info } from "@empirica/core/console";
import { isArrayOfStrings } from "./utils";

function shuffle(arr) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled;
}

// export function makeDispatcher({ treatments }) {
//   if (treatments.length === 0) {
//     throw new Error(
//       `Tried to create dispatcher with no treatments, received treatments object: ${JSON.stringify(
//         treatments
//       )}`
//     );
//   }

//   info(
//     `Creating dispatch with treatments: ${treatments
//       .map((t) => t.name)
//       .join(", ")}`
//   );
//   const treatmentQueue = shuffle(treatments);

//   const dispatcher = ({ playersReady, playersAssigned, playersWaiting }) => {
//     // we catch any errors from this function in the callbacks/runDispatch function,
//     // where we can handle retries with the right timers and information.

//     // Todo: does this function want to track participants who have participated in
//     // more than one dispatch, so we can prioritize assigning them to groups?
//     // It is in theory possible for a player to be at the end of the queue and unassigned
//     // by multiple dispatch cycles, which could lead to attrition.

//     if (!isArrayOfStrings(playersReady)) {
//       throw new Error(
//         "Invalid type in playersReady, expected list of strings, got:",
//         playersReady
//       );
//     }
//     // Todo: check the others (if we use them)

//     const dispatchList = [];
//     let treatment;
//     let playerIds;
//     let playersNeeded;
//     const shuffledReady = shuffle(playersReady);

//     info(
//       `dispatch: ${playersWaiting.length} in intro steps, ${playersReady.length} in lobby, ${playersAssigned.length} in games`
//     );

//     while (shuffledReady) {
//       playersNeeded = treatmentQueue[0].playerCount;
//       if (shuffledReady.length < playersNeeded) {
//         break;
//       }

//       if (treatmentQueue.length < 2) {
//         // add to queue to make sure it always has items
//         treatmentQueue.push(...shuffle(treatments));
//       }

//       treatment = treatmentQueue.shift(); // pop from the front
//       playerIds = shuffledReady.splice(0, playersNeeded);
//       playersAssigned.push(...playerIds);

//       dispatchList.push({ treatment, playerIds });
//     }

//     if (dispatchList.length === 0) {
//       warn(`Need ${playersNeeded} players ready`);
//     }
//     return dispatchList;
//   };

//   return dispatcher;
// }

export function makeDispatcher({ treatments }) {
  if (treatments.length === 0) {
    throw new Error(
      `Tried to create dispatcher with no treatments, received treatments object: ${JSON.stringify(
        treatments
      )}`
    );
  }

  info(
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

    const playersReady = []; // ready to be assigned to a game
    const playersWaiting = []; // still in intro steps
    const playersAssigned = []; // assigned to games

    players.forEach((player) => {
      if (!player.get("connected")) return; // if players aren't currently connected, don't assign to games

      if (player.get("gameId") || player.get("assigned")) {
        playersAssigned.push(player.id);
      } else if (player.get("introDone")) {
        playersReady.push(player.id);
      } else {
        playersWaiting.push(player.id);
      }
    });

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

    info(
      `dispatch: ${playersWaiting.length} in intro steps, ${playersReady.length} in lobby, ${playersAssigned.length} in games`
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
      warn(`Need ${playersNeeded} players ready`);
    }
    return dispatchList;
  };

  return dispatcher;
}
