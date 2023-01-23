import { usePlayer, useStage } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import * as surveys from "@watts-lab/surveys";

function getProgressLabel({ stage, player }) {
  const exitStep = player.get("exitStep");
  if (exitStep) return `exit_${exitStep}`;

  const stageIndex = stage?.get("index");
  if (stageIndex) return `stage_${stageIndex}`;

  const introStep = player.get("intro");
  return `intro_${introStep}`;
}

export function Survey(surveyName, onSubmit) {
  const player = usePlayer();
  const stage = useStage();

  const LoadedSurvey = surveys[surveyName];

  const gameID = player.get("gameID") || "noGameId";
  const progressLabel = getProgressLabel({ stage, player });

  useEffect(() => {
    console.log(`${progressLabel}: Survey ${surveyName}`);
  });

  const onComplete = (record) => {
    const newRecord = record;
    newRecord.playerId = player.id;
    newRecord.step = progressLabel;
    // Todo: add sequence order (intro, exit step number)
    player.set(`survey_${surveyName}_${progressLabel}`, newRecord);
    onSubmit();
  };

  return (
    <LoadedSurvey
      onComplete={onComplete}
      storageName={`${player.id}_${gameID}_${progressLabel}_${surveyName}`}
    />
  );
}
