import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import { TeamViability } from "@watts-lab/surveys";

const surveyNameMap = {
  "TeamViability": TeamViability,
} 

export function ExitSurvey ( { surveyName, next } ) {
  const player = usePlayer();
  const Survey = surveyNameMap[surveyName]
  console.log("next is", next)

  const onComplete = (record) => {
    player.set("QCSurvey", record);
    next();
  }

  return <Survey onComplete={onComplete} />
};
