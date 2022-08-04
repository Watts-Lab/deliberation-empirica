import React, { useState } from 'react';
import { useGame } from '@empirica/player';
import { SurveyWrapper } from '../../components/SurveyWrapper';
import { scoreFunc } from './team_viability.score'; // TODO: load from surveys repo

export function exitSurveys({ next }) {
  const game = useGame();
  const surveys = game.get('ExitSurveys');
  const [curSurvey, setCurSurvey] = useState(0);

  const onSurveySubmit = () => {
    if (curSurvey + 1 >= surveys.length) {
      next();
    }
    setCurSurvey(curSurvey + 1);
  };

  return (
    <SurveyWrapper surveyJson={surveys[curSurvey]} scoreFunc={scoreFunc} next={onSurveySubmit} />
  );
}
