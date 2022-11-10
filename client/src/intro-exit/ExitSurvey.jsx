import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import * as surveys from "@watts-lab/surveys";

export function ExitSurvey({ surveyName, next }) {
  const player = usePlayer();
  const Survey = surveys[surveyName];
  const exitStep = player.exitStep;

  const onComplete = (record) => {
    record.playerId = player.id;
    record.exitStep = exitStep;
    // Todo: add sequence order (intro, exit step number)
    player.set(`Survey_${exitStep}`, record);
    next();
  };

  return <Survey onComplete={onComplete} />;
}
