import React, { useCallback } from 'react';
import { Survey, StylesManager, Model } from 'survey-react';
import { usePlayer } from '@empirica/player';
import surveyStyle from './SurveyWrapper.css';
import 'survey-react/modern.min.css';

StylesManager.applyTheme('modern');

export function SurveyWrapper({ surveyJson, scoreFunc, next }) {
  const player = usePlayer();
  const surveyModel = new Model(surveyJson);

  const saveResults = useCallback(sender => {
    const { data: responses } = sender;
    // if no scoreFunc defined, default to empty dict
    const result = scoreFunc ? scoreFunc(responses) : {};
    const record = { responses, result };
    player.set('Surveys', record);

    next();
  });

  surveyModel.onComplete.add(saveResults);

  return (
    <Survey style={surveyStyle} model={surveyModel} />
  );
}
