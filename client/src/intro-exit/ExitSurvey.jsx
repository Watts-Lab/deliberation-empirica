import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import * as surveys from "@watts-lab/surveys";

export function ExitSurvey({ surveyName, next }) {
  const player = usePlayer();
  const Survey = surveys[surveyName];

  const onComplete = (record) => {
    record.playerId = player.id;
    player.set("Survey", record);
    next();
  };

  return <Survey onComplete={onComplete} />;
}
