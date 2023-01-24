import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import * as surveys from "@watts-lab/surveys";
import { getProgressLabel } from "../components/progressLabel";

export function Survey(surveyName, onSubmit) {
  const player = usePlayer();
  const progressLabel = getProgressLabel();

  const LoadedSurvey = surveys[surveyName];

  const gameID = player.get("gameID") || "noGameId";

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
