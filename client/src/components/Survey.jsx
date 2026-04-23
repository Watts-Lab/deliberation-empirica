/* eslint-disable react/jsx-no-bind */
import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useEffect, useMemo, useRef, memo } from "react";
import * as surveys from "@watts-lab/surveys";
import { useProgressLabel } from "./progressLabel";

// Inner component that renders the actual survey
// Memoized to prevent re-renders when parent state changes
const SurveyInner = memo(({
  LoadedSurvey,
  onComplete,
  storageName,
}) => <LoadedSurvey onComplete={onComplete} storageName={storageName} />);

export function Survey({ surveyName, onSubmit }) {
  const player = usePlayer();
  const progressLabel = useProgressLabel();
  const gameID = player.get("gameID") || "noGameId";
  const LoadedSurvey = surveys[surveyName];
  const loadError =
    LoadedSurvey === undefined
      ? `Could not load survey: ${surveyName}. Check that the name is ` +
        `specified properly and is available in your current version of ` +
        `the survey library. Available surveys are ` +
        `${Object.keys(surveys).join(", ")}`
      : null;

  useEffect(() => {
    console.log(`${progressLabel}: Survey ${surveyName}`);
  }, [progressLabel, surveyName]);

  // Report load errors from an effect rather than during render. Calling
  // onSubmit in the render body duplicates under StrictMode double-render
  // and can loop if the parent reacts to the error by remounting us with
  // the same bad name. A ref guards against firing twice for the same
  // mount.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (loadError && !reportedRef.current) {
      reportedRef.current = true;
      onSubmit({ error: loadError });
    }
  }, [loadError, onSubmit]);

  // Memoize storageName to prevent unnecessary re-renders of SurveyInner
  const storageName = useMemo(
    () => `${player.id}_${gameID}_${progressLabel}_${surveyName}`,
    [player.id, gameID, progressLabel, surveyName]
  );

  if (loadError) {
    // Render an error surface — do NOT throw, as the old code did. Throwing
    // during a survey step orphans the game flow; the parent handles the
    // onSubmit({error}) above.
    return (
      <div role="alert" style={{ color: "var(--stagebook-danger, #dc2626)" }}>
        {loadError}
      </div>
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
