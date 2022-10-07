import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import { TeamViability, ExampleSurvey } from "@watts-lab/surveys";

const surveyNameMap = {
  "TeamViability": TeamViability,
  "ExampleSurvey": ExampleSurvey

} 

export function ExitSurvey ( { surveyName, next } ) {
  const player = usePlayer();
  const Survey = surveyNameMap[surveyName]
  console.log("survey is", Survey)
  console.log("next is", next)

  const onComplete = (record) => {
    player.set("QCSurvey", record);
    next();
  }

  return <Survey onComplete={onComplete} />
};
