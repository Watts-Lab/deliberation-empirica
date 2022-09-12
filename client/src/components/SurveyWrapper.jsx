import { usePlayer } from "@empirica/core/player/classic/react";
import React, { useCallback, useEffect } from "react";
import { Model, StylesManager, Survey } from "survey-react";
import "survey-react/modern.min.css";
import surveyStyle from "./SurveyWrapper.css";

StylesManager.applyTheme("modern");

export function SurveyWrapper({ surveyJson, scoreFunc, next }) {
  const player = usePlayer();
  const surveyModel = new Model(surveyJson);

  useEffect(() => {
    // runs on first mount
    if (surveyJson.title) console.log(`Exit: ${surveyJson.title}`);
  }, [surveyJson]);

  const saveResults = useCallback(
    (sender) => {
      const { data: responses } = sender;
      // if no scoreFunc defined, default to empty dict
      console.log(scoreFunc);
      const sf = scoreFunc ? new Function("responses", scoreFunc) : null;
      const result = sf ? sf(responses) : {};
      const record = { responses, result };
      player.set("Surveys", record);

      next();
    },
    [scoreFunc]
  );

  surveyModel.onComplete.add(saveResults);

  return <Survey style={surveyStyle} model={surveyModel} />;
}
