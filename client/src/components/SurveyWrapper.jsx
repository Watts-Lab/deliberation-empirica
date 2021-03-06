import React, { useCallback } from "react";
import { Survey, StylesManager, Model } from 'survey-react';
import 'survey-react/modern.min.css';
import surveyStyle from "./SurveyWrapper.css";
import { useGame, usePlayer } from "@empirica/player";

StylesManager.applyTheme("modern");

export default function SurveyWrapper({ surveyJson, scoreFunc, next }) {

    const player = usePlayer();
    const surveyModel = new Model(surveyJson);

    const saveResults = useCallback( sender => {
        const { data } = sender;
        const responses = data;  // is there a better way to do this?
        let result = scoreFunc ? scoreFunc(responses) : {}  // if no scoreFunc defined, default to empty dict
        const record = {
            responses: data, 
            result: result
        };
        player.set('Surveys', record);
        
        next();
    });

    surveyModel.onComplete.add(saveResults);

    return(
        <Survey style={surveyStyle} model={surveyModel} />
    )
}