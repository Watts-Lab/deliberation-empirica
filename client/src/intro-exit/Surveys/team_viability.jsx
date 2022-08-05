import React, { useEffect } from 'react';
import { useGame } from '@empirica/player';
import { SurveyWrapper } from '../../components/SurveyWrapper';

export function teamViability({ next }) {
  const game = useGame();

  useEffect(() => {
    console.log('Exit: TV Survey');
  }, []);

    return(
        <SurveyWrapper surveyJson={game.get("TVSurvey")} scoreFunc={game.get("TVScoreFunc")} next={next} />
    )
}
