import React, { useCallback } from "react";
import { Survey, StylesManager, Model } from 'survey-react';
import 'survey-react/modern.min.css';
import surveyCSS from "./SurveyWrapper.css";
import { useGame, usePlayer } from "@empirica/player";

StylesManager.applyTheme("modern");

export default function SurveyWrapper({ surveyJson, next }) {
    const game = useGame()
    const player = usePlayer();
    const surveyModel = new Model(surveyJson);

    const saveResults = useCallback( sender => {
        const { data } = sender;
        player.set('ExitSurvey', data);
        next();
    });

    surveyModel.onComplete.add(saveResults);

    return(
        <Survey css={surveyCSS} model={surveyModel} />
    )
}