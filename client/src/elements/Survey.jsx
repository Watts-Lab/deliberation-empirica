import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect } from "react";
import * as surveys from "@watts-lab/surveys";
import { useProgressLabel } from "../components/utils";

export function Survey({ surveyName, onSubmit }) {
  const player = usePlayer();
  const progressLabel = useProgressLabel();

  const LoadedSurvey = surveys[surveyName];

  // Todo: if LoadedSurvey is undefined, display a "loading..." message
  if (LoadedSurvey === undefined) {
    onComplete({ error: `Could not load survey: ${surveyName}.` });
    throw new Error(
      `Could not load survey: ${surveyName}. 
      Check that the name is specified properly 
      and is available in your current version of 
      the survey library.
      
      Available surveys are ${Object.keys(surveys).join(", ")}
      `
    );
  }

  const gameID = player.get("gameID") || "noGameId";

  useEffect(() => {
    console.log(`${progressLabel}: Survey ${surveyName}`);
  }, []);

  function onComplete(record) {
    const newRecord = record;

    newRecord.playerId = player.id;
    newRecord.step = progressLabel;
    // Todo: add sequence order (intro, exit step number)
    player.set(`survey_${surveyName}_${progressLabel}`, newRecord);
    onSubmit();
  }

  return (
    <LoadedSurvey
      onComplete={onComplete}
      storageName={`${player.id}_${gameID}_${progressLabel}_${surveyName}`}
    />
  );



  
}
