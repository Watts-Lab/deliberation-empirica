import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import * as surveys from "@watts-lab/surveys";

export function ExitSurvey({ surveyName, next }) {
  const player = usePlayer();
  const Survey = surveys[surveyName];
  const exitStep = player.get("exitStep") || "noExitStep";
  const gameID = player.get("gameID") || "noGameId";

  useEffect(() => {
    console.log(`Exit ${exitStep}: Survey ${surveyName}`);
  });

  const onComplete = (record) => {
    record.playerId = player.id;
    record.gameId = gameID;
    record.exitStep = exitStep;
    // Todo: add sequence order (intro, exit step number)
    player.set(`Survey`, record);
    next();
  };

  return (
    <Survey
      onComplete={onComplete}
      storageName={`${player.id}_${gameID}_${exitStep}_${surveyName}`}
    />
  );
}
