import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import * as surveys from "@watts-lab/surveys";

export function ExitSurvey({ surveyName, next }) {
  const player = usePlayer();
  const Survey = surveys[surveyName];

  const onComplete = (record) => {
    const newRecord = record;
    newRecord.playerId = player.id;
    newRecord.exitStep = player.exitStep;
    // Todo: add sequence order (intro, exit step number)
    player.set(`survey`, newRecord);
    next();
  };

  return <Survey onComplete={onComplete} />;
}
