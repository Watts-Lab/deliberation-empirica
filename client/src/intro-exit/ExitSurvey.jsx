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
    const newRecord = record;
    newRecord.playerId = player.id;
    newRecord.exitStep = player.exitStep;
    // Todo: add sequence order (intro, exit step number)
    player.set(`survey`, newRecord);
    next();
  };

  return (
    <Survey
      onComplete={onComplete}
      storageName={`${player.id}_${gameID}_${exitStep}_${surveyName}`}
    />
  );
}
