/*
prototyping a dispatcher algorithm. This is a terrible one.
*/

function shuffle(arr) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled;
}

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

  // does this want a "previouslyUnassigned"/"Rollover"
  const dispatcher = ({ playersReady, playersAssigned, playersWaiting }) => {
    const dispatchList = [];
    let treatment;
    let playerIds;
    let playersNeeded;
    const shuffledReady = shuffle(playersReady);
    // it is possible for a few players to fall out the end of the queue through
    // multiple dispatch cycles

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

      treatment = treatmentQueue.shift(); // pops from the front
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
