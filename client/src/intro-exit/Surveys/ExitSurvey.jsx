import React, { useState } from 'react';
import { useGame } from '@empirica/player';
import { SurveyWrapper } from '../../components/SurveyWrapper';

export function exitSurveys({ next }) {
  const game = useGame();
  const surveys = game.get('ExitSurveys');
  const surveyScores = game.get('ExitScores');
  const [curSurvey, setCurSurvey] = useState(0);

  const onSurveySubmit = () => {
    if (curSurvey + 1 >= surveys.length) {
      next();
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
