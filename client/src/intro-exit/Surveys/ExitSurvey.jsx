import { usePlayer } from "@empirica/core/player/classic/react";
import React from "react";
import { TeamViability, 
         ExampleSurvey,
         LonelinessSingleItem,
         Demographics } from "@watts-lab/surveys";

const surveyNameMap = {
  "TeamViability": TeamViability,
  "ExampleSurvey": ExampleSurvey,
  "LonelinessSingleItem": LonelinessSingleItem,
  "Demographics": Demographics
} 

export function ExitSurvey ( { surveyName, next } ) {
  const player = usePlayer();
  const Survey = surveyNameMap[surveyName]

  const onComplete = (record) => {
    player.set("Survey", record);
    next();
  }

  return <Survey onComplete={onComplete} />
};
