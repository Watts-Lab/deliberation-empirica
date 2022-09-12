import { useGame } from "@empirica/core/player/classic/react";
import React, { useState } from "react";
import { SurveyWrapper } from "../../components/SurveyWrapper";

export function exitSurveys({ next }) {
  const game = useGame();
  if (!game) {
    return;
  }

  const surveys = game.get("ExitSurveys");
  const surveyScores = game.get("ExitScores");
  const [curSurvey, setCurSurvey] = useState(0);

  const onSurveySubmit = () => {
    if (curSurvey + 1 >= surveys.length) {
      next();
      return;
    }

    setCurSurvey(curSurvey + 1);
  };

  return (
    <SurveyWrapper
      surveyJson={surveys[curSurvey]}
      scoreFunc={surveyScores[curSurvey]}
      next={onSurveySubmit}
    />
  );
}
