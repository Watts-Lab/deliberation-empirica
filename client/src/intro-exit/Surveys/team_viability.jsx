import React, { useEffect } from 'react';
import { useGame } from '@empirica/player';
import { SurveyWrapper } from '../../components/SurveyWrapper';
import { scoreFunc } from './team_viability.score'; // TODO: load from surveys repo

export function teamViability({ next }) {
  const game = useGame();

  useEffect(() => {
    console.log('Exit: TV Survey');
  }, []);

  return (
    <SurveyWrapper surveyJson={game.get('TVSurvey')} scoreFunc={scoreFunc} next={next} />
  );
}
