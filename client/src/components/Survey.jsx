/* eslint-disable react/jsx-no-bind */
import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useMemo, memo } from "react";
import * as surveys from "@watts-lab/surveys";
import { useProgressLabel } from "./progressLabel";

// Inner component that renders the actual survey
// Memoized to prevent re-renders when parent state changes
const SurveyInner = memo(function SurveyInner({
  LoadedSurvey,
  onComplete,
  storageName,
}) {
  return <LoadedSurvey onComplete={onComplete} storageName={storageName} />;
});

export function Survey({ surveyName, onSubmit }) {
  const player = usePlayer();
  const progressLabel = useProgressLabel();
  const gameID = player.get("gameID") || "noGameId";
  const LoadedSurvey = surveys[surveyName];

  useEffect(() => {
    console.log(`${progressLabel}: Survey ${surveyName}`);
  }, [progressLabel, surveyName]);

  // Memoize storageName to prevent unnecessary re-renders of SurveyInner
  const storageName = useMemo(
    () => `${player.id}_${gameID}_${progressLabel}_${surveyName}`,
    [player.id, gameID, progressLabel, surveyName]
  );

  if (LoadedSurvey === undefined) {
    onSubmit({ error: `Could not load survey: ${surveyName}.` });
    throw new Error(
      `Could not load survey: ${surveyName}.
      Check that the name is specified properly
      and is available in your current version of
      the survey library.

      Available surveys are ${Object.keys(surveys).join(", ")}
      `
    );
  }

  return (
    <SurveyInner
      LoadedSurvey={LoadedSurvey}
      onComplete={onSubmit}
      storageName={storageName}
    />
  );
}
