/*
prototyping a dispatcher algorithm. This is a terrible one.
*/

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function getRandomSelection(arr, num) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, num);
}

export function makeDispatcher({ treatments }) {
  const groupSizes = [];
  treatments.forEach((treatment) => {
    console.log(
      `Loaded ${treatment.name}, ${treatment?.factors?.playerCount} players`
    );
    groupSizes.push(parseInt(treatment.factors.playerCount));
  });
  const maxSize = Math.max(...groupSizes);
  console.log(`Need at least ${maxSize} players ready to launch a game`);

  const dispatcher = ({ playersReady, playersAssigned, playersWaiting }) => {
    console.log(
      `dispatch: ${playersReady.length} ready, ${playersAssigned.length} assigned, ${playersWaiting} waiting`
    );
    if (playersReady.length < maxSize) {
      console.log("not enough players yet");
      return {};
    }
    const treatmentChoiceIndex = getRandomInt(groupSizes.length);
    const treatment = treatments[treatmentChoiceIndex];
    const playerIds = getRandomSelection(
      playersReady,
      treatment.factors.playerCount
    );

    console.log(treatment.name, playerIds);
    return { treatment, playerIds };
  };

  return dispatcher;
}
